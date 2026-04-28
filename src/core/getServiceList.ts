import { Context } from "../types/Context";
import { getStatus } from "./getStatus";
import { loadPortsForInstance } from "../config/portsManager";
import {
  collectManagedVolumeSpecs,
  getContainerVolumeBindings,
  loadVolumesForInstance,
} from "../config/volumeManager";
import { DockerManager } from "./docker";
import { Pm2Manager } from "./process/Pm2Manager";
import { parseServiceName } from "../utils/nameBuilder";
import { StoredVolume } from "../config/schemas";

export interface ServiceListEntry {
  type: "native" | "docker";
  service: string;
  status: "down" | "pending" | "up";
  ports: string[];
  volumes: string[];
  cwd?: string;
  cmd: string;
}

export interface ServiceListResult {
  services: ServiceListEntry[];
  resources?: ResourceInventory;
}

export interface ResourceInventory {
  instances: InstanceResourceInventory[];
  alien: ResourceInventoryEntry[];
  dangling: ResourceInventoryEntry[];
  staleVolumes: StaleVolumeEntry[];
}

export interface InstanceResourceInventory {
  instanceKey: string;
  instanceId: string;
  pm2: string[];
  containers: string[];
  volumes: string[];
}

export interface ResourceInventoryEntry {
  type: "pm2" | "container" | "volume";
  name: string;
  reason: string;
}

export interface StaleVolumeEntry {
  name: string;
  service: string;
  internalDir: string;
}

function normalizePorts(
  ports: string[] | undefined,
  statePorts: Record<string, string> | undefined,
): string[] {
  if (!ports || ports.length === 0) return [];
  return ports.map((port) => {
    let resolved = port;
    if (statePorts) {
      for (const [name, value] of Object.entries(statePorts)) {
        const token = `$${name}`;
        if (resolved.includes(token)) {
          resolved = resolved.split(token).join(value);
        }
      }
    }
    return resolved;
  });
}

function extractProcessPorts(
  context: Context,
  env: Record<string, string>,
): string[] {
  if (!context.ports || context.ports.length === 0) return [];
  return context.ports
    .filter((name) => env[name] !== undefined)
    .map((name) => `${name}=${env[name]}`);
}

function parseManagedVolumeName(
  name: string,
): { project: string; instanceId: string } | null {
  const parts = name.split(".");
  if (parts.length !== 4) return null;
  if (parts[0] !== "zap" || !/^vol\d+$/.test(parts[3])) return null;
  return { project: parts[1], instanceId: parts[2] };
}

function getStaleVolumeEntries(
  volumes: Record<string, StoredVolume>,
  currentSpecs: Set<string>,
): StaleVolumeEntry[] {
  return Object.entries(volumes)
    .filter(([, volume]) => {
      return !currentSpecs.has(`${volume.service}:${volume.internal_dir}`);
    })
    .map(([name, volume]) => ({
      name,
      service: volume.service,
      internalDir: volume.internal_dir,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function getResourceInventory(
  context: Context,
): Promise<ResourceInventory> {
  const stateInstances = context.state.instances || {};
  const configuredServices = new Set([
    ...context.processes.map((process) => process.name),
    ...context.containers.map((container) => container.name),
  ]);
  const currentSpecs = collectManagedVolumeSpecs(context.containers);
  const currentSpecKeys = new Set(
    currentSpecs.map((spec) => `${spec.serviceName}:${spec.internalDir}`),
  );

  const [pm2Processes, dockerContainers, dockerVolumes] = await Promise.all([
    Pm2Manager.listProcesses(),
    DockerManager.listContainers(),
    DockerManager.listVolumes(),
  ]);

  const instances = new Map<string, InstanceResourceInventory>();
  for (const [instanceKey, instance] of Object.entries(stateInstances)) {
    instances.set(instance.id, {
      instanceKey,
      instanceId: instance.id,
      pm2: [],
      containers: [],
      volumes: Object.keys(instance.volumes || {}).sort(),
    });
  }

  const alien: ResourceInventoryEntry[] = [];
  const dangling: ResourceInventoryEntry[] = [];

  const classifyServiceResource = (type: "pm2" | "container", name: string) => {
    const parsed = parseServiceName(name);
    if (!parsed || parsed.project !== context.projectName) return;

    const instanceId = parsed.instanceId;
    if (!instanceId) {
      alien.push({ type, name, reason: "legacy unscoped resource" });
      return;
    }

    const instance = instances.get(instanceId);
    if (!instance) {
      alien.push({ type, name, reason: "instance not in this repo state" });
      return;
    }

    if (type === "pm2") {
      instance.pm2.push(name);
    } else {
      instance.containers.push(name);
    }

    if (!configuredServices.has(parsed.service)) {
      dangling.push({
        type,
        name,
        reason: `service "${parsed.service}" is not in current zap.yaml`,
      });
    }
  };

  for (const process of pm2Processes) {
    classifyServiceResource("pm2", process.name);
  }
  for (const container of dockerContainers) {
    classifyServiceResource("container", container.name);
  }

  for (const volume of dockerVolumes) {
    const parsed = parseManagedVolumeName(volume.name);
    if (!parsed || parsed.project !== context.projectName) continue;

    const instance = instances.get(parsed.instanceId);
    if (!instance) {
      alien.push({
        type: "volume",
        name: volume.name,
        reason: "instance not in this repo state",
      });
      continue;
    }

    if (!instance.volumes.includes(volume.name)) {
      instance.volumes.push(volume.name);
      dangling.push({
        type: "volume",
        name: volume.name,
        reason: "Docker volume is not tracked in current repo state",
      });
    }
  }

  const staleVolumes = getStaleVolumeEntries(
    stateInstances[context.instanceKey]?.volumes || {},
    currentSpecKeys,
  );
  for (const volume of staleVolumes) {
    dangling.push({
      type: "volume",
      name: volume.name,
      reason: `${volume.service}:${volume.internalDir} is not in current zap.yaml`,
    });
  }

  return {
    instances: Array.from(instances.values())
      .map((instance) => ({
        ...instance,
        pm2: Array.from(new Set(instance.pm2)).sort(),
        containers: Array.from(new Set(instance.containers)).sort(),
        volumes: Array.from(new Set(instance.volumes)).sort(),
      }))
      .sort((a, b) => a.instanceKey.localeCompare(b.instanceKey)),
    alien: alien.sort((a, b) => a.name.localeCompare(b.name)),
    dangling: dangling.sort((a, b) => a.name.localeCompare(b.name)),
    staleVolumes,
  };
}

export async function getServiceList(
  context: Context,
  service?: string | string[],
  options: { extended?: boolean } = {},
): Promise<ServiceListResult> {
  const statusResult = await getStatus(context, service, false);

  const nativeStatus = new Map(
    statusResult.native.map((item) => [item.service, item.status]),
  );
  const dockerStatus = new Map(
    statusResult.docker.map((item) => [item.service, item.status]),
  );

  const nativeEntries: ServiceListEntry[] = context.processes.map((proc) => ({
    type: "native",
    service: proc.name,
    status: nativeStatus.get(proc.name) ?? "down",
    ports: extractProcessPorts(context, proc.resolvedEnv || {}),
    volumes: [],
    cwd: proc.cwd,
    cmd: proc.cmd,
  }));

  const instancePorts = context.instance?.ports;
  const loadedPorts =
    instancePorts && Object.keys(instancePorts).length > 0
      ? instancePorts
      : loadPortsForInstance(context.projectRoot, context.instanceKey);
  const instanceVolumes = context.instance?.volumes;
  const loadedVolumes =
    instanceVolumes && Object.keys(instanceVolumes).length > 0
      ? instanceVolumes
      : loadVolumesForInstance(context.projectRoot, context.instanceKey);
  const dockerEntries: ServiceListEntry[] = context.containers.map(
    (container) => ({
      type: "docker",
      service: container.name,
      status: dockerStatus.get(container.name) ?? "down",
      ports: normalizePorts(container.ports, loadedPorts),
      volumes: getContainerVolumeBindings(
        container.name,
        container.volumes,
        loadedVolumes,
      ),
      cmd: container.command || container.image,
    }),
  );

  const serviceSet =
    service === undefined
      ? undefined
      : new Set(Array.isArray(service) ? service : [service]);

  const services = [...nativeEntries, ...dockerEntries].filter((item) =>
    serviceSet ? serviceSet.has(item.service) : true,
  );

  return {
    services,
    resources: options.extended
      ? await getResourceInventory(context)
      : undefined,
  };
}
