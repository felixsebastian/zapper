import { Container, StoredVolume, Volume } from "./schemas";
import { loadState, saveState } from "./stateLoader";
import { DEFAULT_INSTANCE_KEY, ensureInstance } from "../core/instanceResolver";

export interface ManagedVolumeSpec {
  serviceName: string;
  internalDir: string;
}

export interface ResolvedVolumes {
  bindings: string[];
  namedVolumesToCreate: string[];
}

type ContainerVolume = NonNullable<Container["volumes"]>[number];

function getVolumeKey(spec: ManagedVolumeSpec): string {
  return `${spec.serviceName}:${spec.internalDir}`;
}

function slugify(value: string): string {
  const slug = value
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "volume";
}

export function generateManagedVolumeName(
  projectName: string,
  instanceId: string,
  index: number,
): string {
  return ["zap", slugify(projectName), slugify(instanceId), `vol${index}`].join(
    ".",
  );
}

function getNextVolumeIndex(existingNames: Iterable<string>): number {
  let maxIndex = 0;
  for (const name of existingNames) {
    const match = name.match(/\.vol(\d+)$/);
    if (!match) continue;
    const parsed = parseInt(match[1], 10);
    if (!Number.isNaN(parsed)) {
      maxIndex = Math.max(maxIndex, parsed);
    }
  }
  return maxIndex + 1;
}

export function loadVolumesForInstance(
  projectRoot: string,
  instanceKey: string = DEFAULT_INSTANCE_KEY,
): Record<string, StoredVolume> {
  return loadState(projectRoot).instances?.[instanceKey]?.volumes || {};
}

export function saveVolumesForInstance(
  projectRoot: string,
  instanceKey: string = DEFAULT_INSTANCE_KEY,
  volumes: Record<string, StoredVolume>,
): void {
  const state = loadState(projectRoot);
  const instance = state.instances?.[instanceKey];
  const ensured = instance?.id
    ? { id: instance.id, created: false }
    : ensureInstance(projectRoot, instanceKey);
  const refreshed = ensured.created ? loadState(projectRoot) : state;
  const refreshedInstance = refreshed.instances?.[instanceKey];
  const refreshedId = refreshedInstance?.id || ensured.id;

  saveState(projectRoot, {
    instances: {
      ...(refreshed.instances || {}),
      [instanceKey]: {
        ...(refreshedInstance || {}),
        id: refreshedId,
        volumes,
      },
    },
  });
}

export function initializeManagedVolumes(
  projectRoot: string,
  projectName: string,
  instanceKey: string,
  instanceId: string,
  specs: ManagedVolumeSpec[],
  options: { prune?: boolean } = {},
): Record<string, string> {
  const uniqueSpecs = new Map<string, ManagedVolumeSpec>();
  for (const spec of specs) {
    uniqueSpecs.set(getVolumeKey(spec), spec);
  }

  const existing = loadVolumesForInstance(projectRoot, instanceKey);
  const next: Record<string, string> = {};
  const nextState: Record<string, StoredVolume> =
    options.prune === false ? { ...existing } : {};
  const existingBySpec = new Map<string, string>();

  for (const [volumeName, volume] of Object.entries(existing)) {
    existingBySpec.set(
      getVolumeKey({
        serviceName: volume.service,
        internalDir: volume.internal_dir,
      }),
      volumeName,
    );
  }

  const usedNames = new Set(Object.keys(existing));
  let nextIndex = getNextVolumeIndex(usedNames);

  for (const key of uniqueSpecs.keys()) {
    const spec = uniqueSpecs.get(key)!;
    const existingVolumeName = existingBySpec.get(key);
    if (existingVolumeName) {
      next[key] = existingVolumeName;
      nextState[existingVolumeName] = {
        service: spec.serviceName,
        internal_dir: spec.internalDir,
      };
      continue;
    }

    let generated = generateManagedVolumeName(
      projectName,
      instanceId,
      nextIndex,
    );
    nextIndex += 1;
    while (usedNames.has(generated)) {
      generated = generateManagedVolumeName(projectName, instanceId, nextIndex);
      nextIndex += 1;
    }
    usedNames.add(generated);
    next[key] = generated;
    nextState[generated] = {
      service: spec.serviceName,
      internal_dir: spec.internalDir,
    };
  }

  saveVolumesForInstance(projectRoot, instanceKey, nextState);
  return next;
}

export function resetManagedVolumesForInstance(
  projectRoot: string,
  instanceKey: string = DEFAULT_INSTANCE_KEY,
): Record<string, StoredVolume> {
  const existing = loadVolumesForInstance(projectRoot, instanceKey);
  saveVolumesForInstance(projectRoot, instanceKey, {});
  return existing;
}

export function findStaleManagedVolumes(
  projectRoot: string,
  instanceKey: string,
  currentSpecs: ManagedVolumeSpec[],
): Record<string, StoredVolume> {
  const currentKeys = new Set(currentSpecs.map((spec) => getVolumeKey(spec)));
  const stale: Record<string, StoredVolume> = {};

  for (const [volumeName, volume] of Object.entries(
    loadVolumesForInstance(projectRoot, instanceKey),
  )) {
    const key = getVolumeKey({
      serviceName: volume.service,
      internalDir: volume.internal_dir,
    });
    if (!currentKeys.has(key)) {
      stale[volumeName] = volume;
    }
  }

  return stale;
}

export function pruneStaleManagedVolumesForInstance(
  projectRoot: string,
  instanceKey: string,
  currentSpecs: ManagedVolumeSpec[],
): Record<string, StoredVolume> {
  const stale = findStaleManagedVolumes(projectRoot, instanceKey, currentSpecs);
  if (Object.keys(stale).length === 0) return stale;

  const staleNames = new Set(Object.keys(stale));
  const remaining: Record<string, StoredVolume> = {};
  for (const [volumeName, volume] of Object.entries(
    loadVolumesForInstance(projectRoot, instanceKey),
  )) {
    if (!staleNames.has(volumeName)) {
      remaining[volumeName] = volume;
    }
  }

  saveVolumesForInstance(projectRoot, instanceKey, remaining);
  return stale;
}

function isPathOnlyVolume(volume: ContainerVolume): boolean {
  if (typeof volume !== "string") return !volume.name;
  const parsed = parseVolumeString(volume);
  return !parsed.source && parsed.internalDir.startsWith("/");
}

function parseVolumeString(volume: string): {
  source?: string;
  internalDir: string;
  suffix?: string;
} {
  const [source, internalDir, suffix] = volume.split(":");
  if (!internalDir) return { internalDir: source };
  if (source.startsWith("/") && !internalDir.startsWith("/")) {
    return { internalDir: source, suffix: internalDir };
  }
  return { source, internalDir, suffix };
}

function appendMode(binding: string, mode?: string): string {
  return mode ? `${binding}:${mode}` : binding;
}

function isBindMountSource(source: string): boolean {
  return (
    source.startsWith("/") ||
    source.startsWith("./") ||
    source.startsWith("../") ||
    source === "." ||
    source === ".." ||
    source.startsWith("~/")
  );
}

export function collectManagedVolumeSpecs(
  containers: Array<{ name: string; volumes?: Container["volumes"] }>,
): ManagedVolumeSpec[] {
  const specs: ManagedVolumeSpec[] = [];

  for (const container of containers) {
    for (const volume of container.volumes || []) {
      if (!isPathOnlyVolume(volume)) continue;

      const internalDir =
        typeof volume === "string"
          ? parseVolumeString(volume).internalDir
          : volume.internal_dir;
      specs.push({ serviceName: container.name, internalDir });
    }
  }

  return specs;
}

export function resolveContainerVolumes({
  projectRoot,
  projectName,
  instanceKey = DEFAULT_INSTANCE_KEY,
  instanceId,
  serviceName,
  volumes,
}: {
  projectRoot: string;
  projectName: string;
  instanceKey?: string;
  instanceId: string;
  serviceName: string;
  volumes?: Container["volumes"];
}): ResolvedVolumes {
  const bindings: string[] = [];
  const namedVolumesToCreate: string[] = [];
  const managedSpecs: ManagedVolumeSpec[] = [];

  for (const volume of volumes || []) {
    if (typeof volume === "string") {
      const parsed = parseVolumeString(volume);
      if (!parsed.source) {
        managedSpecs.push({ serviceName, internalDir: parsed.internalDir });
        continue;
      }

      bindings.push(volume);
      if (!isBindMountSource(parsed.source)) {
        namedVolumesToCreate.push(parsed.source);
      }
      continue;
    }

    const namedVolume = volume as Volume;
    if (namedVolume.name) {
      namedVolumesToCreate.push(namedVolume.name);
      bindings.push(
        appendMode(
          `${namedVolume.name}:${namedVolume.internal_dir}`,
          namedVolume.mode,
        ),
      );
      continue;
    }

    managedSpecs.push({
      serviceName,
      internalDir: namedVolume.internal_dir,
    });
  }

  if (managedSpecs.length > 0) {
    const managedVolumes = initializeManagedVolumes(
      projectRoot,
      projectName,
      instanceKey,
      instanceId,
      managedSpecs,
      { prune: false },
    );

    for (const spec of managedSpecs) {
      const volumeName = managedVolumes[getVolumeKey(spec)];
      namedVolumesToCreate.push(volumeName);
      const sourceVolume = (volumes || []).find((volume) => {
        if (typeof volume === "string") {
          const parsed = parseVolumeString(volume);
          return !parsed.source && parsed.internalDir === spec.internalDir;
        }
        return !volume.name && volume.internal_dir === spec.internalDir;
      });
      const mode =
        typeof sourceVolume === "string"
          ? parseVolumeString(sourceVolume).suffix
          : sourceVolume?.mode;
      bindings.push(appendMode(`${volumeName}:${spec.internalDir}`, mode));
    }
  }

  return {
    bindings,
    namedVolumesToCreate: Array.from(new Set(namedVolumesToCreate)),
  };
}
