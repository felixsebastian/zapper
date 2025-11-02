import { Pm2Manager } from "./process";
import { DockerManager } from "./docker";
import { Context } from "../types/Context";

function normalizeStatus(
  status: string,
  type: "bare_metal" | "docker",
): string {
  const s = status.toLowerCase();

  if (type === "bare_metal") {
    if (s === "online") return "up";
    if (
      s === "stopped" ||
      s === "stopping" ||
      s === "errored" ||
      s === "error" ||
      s === "not started"
    )
      return "down";
    return "down"; // Default to down for unknown statuses
  } else {
    // Docker
    if (s.includes("up")) return "up";
    if (
      s.includes("exited") ||
      s.includes("dead") ||
      s.includes("restarting") ||
      s === "not started"
    )
      return "down";
    return "down"; // Default to down for unknown statuses
  }
}

export interface ServiceStatus {
  service: string;
  rawName: string;
  status: string;
  type: "bare_metal" | "docker";
}

export interface StatusResult {
  bareMetal: ServiceStatus[];
  docker: ServiceStatus[];
}

export async function getStatus(
  context?: Context,
  service?: string,
  all: boolean = false,
): Promise<StatusResult> {
  const pm2List = await Pm2Manager.listProcesses();
  const allDocker = await DockerManager.listContainers();

  // If no context is provided, fall back to original behavior
  if (!context) {
    const filtered = pm2List.filter(() => {
      if (all) return true;
      return true; // Show all since we don't have project context
    });

    const bareMetal = filtered
      .map((p) => ({
        rawName: p.name,
        service: p.name.split(".").pop() || p.name,
        status: normalizeStatus(p.status, "bare_metal"),
        type: "bare_metal" as const,
      }))
      .filter((p) => (!service ? true : p.service === service));

    const docker = allDocker
      .map((c) => {
        const name =
          (c as unknown as Record<string, string>)["name"] ||
          (c as unknown as Record<string, string>)["Names"] ||
          "";
        const rawStatus =
          (c as unknown as Record<string, string>)["status"] ||
          (c as unknown as Record<string, string>)["Status"] ||
          "";
        return {
          rawName: name,
          service: name.split(".").pop() || name,
          status: normalizeStatus(rawStatus, "docker"),
          type: "docker" as const,
        };
      })
      .filter((c) => !!c.rawName)
      .filter((c) => (!service ? true : c.service === service));

    return { bareMetal, docker };
  }

  // With context, show all defined services
  const projectName = context.projectName;

  // Create status for all processes defined in config
  const bareMetal: ServiceStatus[] = [];
  for (const process of context.processes) {
    if (service && process.name !== service) continue;

    const expectedPm2Name = `zap.${projectName}.${process.name}`;
    const runningProcess = pm2List.find((p) => p.name === expectedPm2Name);

    const rawStatus = runningProcess ? runningProcess.status : "not started";
    const isRunning = rawStatus !== "not started";
    const hasProfiles =
      Array.isArray(process.profiles) && process.profiles.length > 0;

    // Filter out stopped processes that are in profiles (disabled by default)
    if (!isRunning && hasProfiles) continue;

    bareMetal.push({
      service: process.name,
      rawName: expectedPm2Name,
      status: normalizeStatus(rawStatus, "bare_metal"),
      type: "bare_metal" as const,
    });
  }

  // Create status for all containers defined in config
  const docker: ServiceStatus[] = [];
  for (const container of context.containers) {
    if (service && container.name !== service) continue;

    const expectedDockerName = `zap.${projectName}.${container.name}`;
    const runningContainer = allDocker.find((c) => {
      const name =
        (c as unknown as Record<string, string>)["name"] ||
        (c as unknown as Record<string, string>)["Names"] ||
        "";
      return name === expectedDockerName;
    });

    const rawStatus = runningContainer
      ? (runningContainer as unknown as Record<string, string>)["status"] ||
        (runningContainer as unknown as Record<string, string>)["Status"] ||
        "unknown"
      : "not started";

    const isRunning = rawStatus !== "not started";
    const hasProfiles =
      Array.isArray(container.profiles) && container.profiles.length > 0;

    // Filter out stopped containers that are in profiles (disabled by default)
    if (!isRunning && hasProfiles) continue;

    docker.push({
      service: container.name,
      rawName: expectedDockerName,
      status: normalizeStatus(rawStatus, "docker"),
      type: "docker" as const,
    });
  }

  return { bareMetal, docker };
}
