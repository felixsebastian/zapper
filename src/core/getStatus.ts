import { Pm2Manager } from "./process";
import { DockerManager } from "./docker";
import { Context } from "../types/Context";
import { clearServiceState } from "../config/stateLoader";

type Status = "down" | "pending" | "up";

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function isRunning(rawStatus: string, type: "native" | "docker"): boolean {
  const s = rawStatus.toLowerCase();
  if (type === "native") return s === "online";
  return s === "running";
}

function computeStatus(
  running: boolean,
  startedAtMs: number | undefined,
  healthCheckSecs: number,
): Status {
  if (!running) return "down";
  if (!startedAtMs) return "up";
  const elapsed = (Date.now() - startedAtMs) / 1000;
  return elapsed < healthCheckSecs ? "pending" : "up";
}

export interface ServiceStatus {
  service: string;
  rawName: string;
  status: Status;
  type: "native" | "docker";
}

export interface StatusResult {
  native: ServiceStatus[];
  docker: ServiceStatus[];
}

export async function getStatus(
  context?: Context,
  service?: string,
  all: boolean = false,
): Promise<StatusResult> {
  const pm2List = await Pm2Manager.listProcesses();

  if (!context) {
    const filtered = pm2List.filter(() => {
      if (all) return true;
      return true;
    });

    const native = filtered
      .map((p) => ({
        rawName: p.name,
        service: p.name.split(".").pop() || p.name,
        status: (isRunning(p.status, "native") ? "up" : "down") as Status,
        type: "native" as const,
      }))
      .filter((p) => (!service ? true : p.service === service));

    const allDocker = await DockerManager.listContainers();
    const docker = allDocker
      .map((c) => ({
        rawName: c.name,
        service: c.name.split(".").pop() || c.name,
        status: (isRunning(c.status, "docker") ? "up" : "down") as Status,
        type: "docker" as const,
      }))
      .filter((c) => !!c.rawName)
      .filter((c) => (!service ? true : c.service === service));

    return { native, docker };
  }

  const projectName = context.projectName;
  const serviceStates = context.state.services || {};

  const native: ServiceStatus[] = [];
  for (const proc of context.processes) {
    if (service && proc.name !== service) continue;

    const expectedPm2Name = `zap.${projectName}.${proc.name}`;
    const runningProcess = pm2List.find((p) => p.name === expectedPm2Name);
    const healthCheck = proc.healthCheck ?? 5;

    let status: Status = "down";
    if (runningProcess) {
      const running = isRunning(runningProcess.status, "native");
      const startedAtMs = running ? Date.now() - runningProcess.uptime : undefined;
      status = computeStatus(running, startedAtMs, healthCheck);
    }

    native.push({
      service: proc.name as string,
      rawName: expectedPm2Name,
      status,
      type: "native" as const,
    });
  }

  const docker: ServiceStatus[] = [];
  for (const container of context.containers) {
    if (service && container.name !== service) continue;

    const expectedDockerName = `zap.${projectName}.${container.name}`;
    const containerInfo = await DockerManager.getContainerInfo(expectedDockerName);
    const healthCheck = container.healthCheck ?? 5;
    const serviceState = serviceStates[expectedDockerName];

    let status: Status = "down";

    if (serviceState?.startPid && isPidAlive(serviceState.startPid)) {
      status = "pending";
    } else {
      if (serviceState?.startPid) {
        clearServiceState(context.projectRoot, expectedDockerName);
      }
      if (containerInfo) {
        const running = isRunning(containerInfo.status, "docker");
        const startedAtMs = containerInfo.startedAt
          ? new Date(containerInfo.startedAt).getTime()
          : undefined;
        status = computeStatus(running, startedAtMs, healthCheck);
      }
    }

    docker.push({
      service: container.name as string,
      rawName: expectedDockerName,
      status,
      type: "docker" as const,
    });
  }

  return { native, docker };
}
