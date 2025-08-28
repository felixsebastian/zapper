import { ZapperConfig, Process, Container } from "../types";
import { Pm2Manager } from "../process/pm2-manager";
import { DockerManager } from "../containers";

export type ServiceType = "bare_metal" | "docker";
export type ActionType = "start" | "stop";

export interface Action {
  type: ActionType;
  serviceType: ServiceType;
  name: string;
}

export interface ActionPlan {
  actions: Action[];
}

export class Planner {
  constructor(private readonly config: ZapperConfig) {}

  private getProcesses(): Process[] {
    const { bare_metal, processes } = this.config;
    if (bare_metal && Object.keys(bare_metal).length > 0) {
      return Object.entries(bare_metal).map(([name, p]) => ({
        ...p,
        name: p.name || name,
      }));
    }
    return Array.isArray(processes) ? processes : [];
  }

  private getContainers(): Array<[string, Container]> {
    const dockerServices = this.config.docker || this.config.containers;
    if (!dockerServices) return [];
    return Object.entries(dockerServices).map(([name, c]) => [name, c]);
  }

  private select(
    op: "start" | "stop",
    targets?: string[],
  ): {
    processes: Process[];
    containers: Array<[string, Container]>;
  } {
    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (op === "start") {
      if (targets && targets.length > 0) {
        return {
          processes: allProcesses.filter((p) => targets.includes(p.name)),
          containers: allContainers.filter(([name]) => targets.includes(name)),
        };
      }
      return {
        processes: allProcesses.filter(
          (p) => !Array.isArray(p.profiles) || p.profiles.length === 0,
        ),
        containers: allContainers.filter(
          ([, c]) => !Array.isArray(c.profiles) || c.profiles.length === 0,
        ),
      };
    }

    // stop: don't apply profiles filter
    if (targets && targets.length > 0) {
      return {
        processes: allProcesses.filter((p) => targets.includes(p.name)),
        containers: allContainers.filter(([name]) => targets.includes(name)),
      };
    }
    return { processes: allProcesses, containers: allContainers };
  }

  async plan(
    op: "start" | "stop" | "restart",
    targets: string[] | undefined,
    projectName: string,
  ): Promise<ActionPlan> {
    // For restart, we currently implement as stop + start of the same set
    if (op === "restart") {
      const stopPlan = await this.plan("stop", targets, projectName);
      const names = stopPlan.actions.map((a) => a.name);
      const startPlan = await this.plan("start", names, projectName);
      return { actions: [...stopPlan.actions, ...startPlan.actions] };
    }

    const selection = this.select(op, targets);

    const pm2List = await Pm2Manager.listProcesses();
    const runningPm2 = new Set(
      pm2List
        .filter((p) => p.status.toLowerCase() === "online")
        .map((p) => p.name),
    );
    const isPm2Running = (name: string) =>
      runningPm2.has(`zap.${projectName}.${name}`);

    const actions: Action[] = [];

    if (op === "start") {
      for (const p of selection.processes) {
        if (!isPm2Running(p.name))
          actions.push({
            type: "start",
            serviceType: "bare_metal",
            name: p.name,
          });
      }
      for (const [name] of selection.containers) {
        const info = await DockerManager.getContainerInfo(
          `zap.${projectName}.${name}`,
        );
        const running =
          !!info &&
          (info.status.toLowerCase() === "running" ||
            info.status.toLowerCase().includes("up"));
        if (!running)
          actions.push({ type: "start", serviceType: "docker", name });
      }
    } else if (op === "stop") {
      for (const p of selection.processes) {
        if (isPm2Running(p.name))
          actions.push({
            type: "stop",
            serviceType: "bare_metal",
            name: p.name,
          });
      }
      for (const [name] of selection.containers) {
        const info = await DockerManager.getContainerInfo(
          `zap.${projectName}.${name}`,
        );
        const running =
          !!info &&
          (info.status.toLowerCase() === "running" ||
            info.status.toLowerCase().includes("up"));
        if (running)
          actions.push({ type: "stop", serviceType: "docker", name });
      }
    }

    return { actions };
  }
}
