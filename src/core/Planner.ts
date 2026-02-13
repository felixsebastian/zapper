import { ZapperConfig, Process, Container } from "../config/schemas";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";
import { ActionPlan, ExecutionWave } from "../types";
import { DependencyGraph } from "./DependencyGraph";
import { buildServiceName } from "../utils/nameBuilder";

export class Planner {
  constructor(private readonly config: ZapperConfig) {}

  private getProcesses(): Process[] {
    const { native, processes } = this.config;

    if (native && Object.keys(native).length > 0) {
      return Object.entries(native).map(([name, process]) => ({
        ...process,
        name: process.name || name,
      }));
    }

    return Array.isArray(processes) ? processes : [];
  }

  private getContainers(): Array<[string, Container]> {
    const dockerServices = this.config.docker || this.config.containers;
    if (!dockerServices) return [];
    return Object.entries(dockerServices).map(([name, c]) => [name, c]);
  }

  private buildGraph(): DependencyGraph {
    const graph = new DependencyGraph();
    for (const process of this.getProcesses()) {
      graph.addProcess(process.name as string, process);
    }
    for (const [name, container] of this.getContainers()) {
      graph.addContainer(name, container);
    }
    return graph;
  }

  private resolveDependencies(
    targets: string[],
    allProcesses: Process[],
    allContainers: Array<[string, Container]>,
  ): { processes: Process[]; containers: Array<[string, Container]> } {
    const resolved = new Set<string>();
    const toResolve = [...targets];

    // Create a map for quick dependency lookup
    const dependencyMap = new Map<string, string[]>();
    for (const process of allProcesses) {
      dependencyMap.set(process.name as string, process.depends_on ?? []);
    }
    for (const [name, container] of allContainers) {
      dependencyMap.set(name, container.depends_on ?? []);
    }

    // Recursively resolve dependencies
    while (toResolve.length > 0) {
      const current = toResolve.pop()!;
      if (resolved.has(current)) continue;

      resolved.add(current);

      // Add dependencies to resolve list
      const deps = dependencyMap.get(current) ?? [];
      for (const dep of deps) {
        if (!resolved.has(dep)) {
          toResolve.push(dep);
        }
      }
    }

    return {
      processes: allProcesses.filter((p) => resolved.has(p.name as string)),
      containers: allContainers.filter(([name]) => resolved.has(name)),
    };
  }

  private filterByProfile(
    processes: Process[],
    containers: Array<[string, Container]>,
    activeProfile?: string,
  ): { processes: Process[]; containers: Array<[string, Container]> } {
    return {
      processes: processes.filter((p) => {
        if (!Array.isArray(p.profiles) || p.profiles.length === 0) return true;
        if (!activeProfile) return true; // Include all services when no profile is active
        return p.profiles.includes(activeProfile);
      }),
      containers: containers.filter(([, c]) => {
        if (!Array.isArray(c.profiles) || c.profiles.length === 0) return true;
        if (!activeProfile) return true; // Include all services when no profile is active
        return c.profiles.includes(activeProfile);
      }),
    };
  }

  async plan(
    op: "start" | "stop" | "restart",
    targets: string[] | undefined,
    projectName: string,
    forceStart = false,
    activeProfile?: string,
  ): Promise<ActionPlan> {
    if (op === "restart") {
      const stopPlan = await this.plan(
        "stop",
        targets,
        projectName,
        false,
        activeProfile,
      );
      const startPlan = await this.plan(
        "start",
        targets,
        projectName,
        true,
        activeProfile,
      );
      return { waves: [...stopPlan.waves, ...startPlan.waves] };
    }

    const graph = this.buildGraph();
    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    const pm2List = await Pm2Manager.listProcesses();
    const runningPm2 = new Set(
      pm2List
        .filter((p) => p.status.toLowerCase() === "online")
        .map((p) => p.name as string),
    );
    const instanceId = (this.config as ZapperConfig & { instanceId?: string })
      .instanceId;
    const isPm2Running = (name: string) =>
      runningPm2.has(buildServiceName(projectName, name, instanceId));

    const isDockerRunning = async (name: string): Promise<boolean> => {
      const info = await DockerManager.getContainerInfo(
        buildServiceName(projectName, name, instanceId),
      );
      return (
        !!info &&
        (info.status.toLowerCase() === "running" ||
          info.status.toLowerCase().includes("up"))
      );
    };

    if (op === "start") {
      let selectedProcesses: Process[];
      let selectedContainers: Array<[string, Container]>;

      if (targets && targets.length > 0) {
        const resolved = this.resolveDependencies(
          targets,
          allProcesses,
          allContainers,
        );
        selectedProcesses = resolved.processes;
        selectedContainers = resolved.containers;
      } else {
        const filtered = this.filterByProfile(
          allProcesses,
          allContainers,
          activeProfile,
        );
        selectedProcesses = filtered.processes;
        selectedContainers = filtered.containers;
      }

      const servicesToStart = new Set<string>();
      for (const p of selectedProcesses) {
        if (forceStart || !isPm2Running(p.name as string)) {
          servicesToStart.add(p.name as string);
        }
      }
      for (const [name] of selectedContainers) {
        if (forceStart || !(await isDockerRunning(name))) {
          servicesToStart.add(name);
        }
      }

      if (servicesToStart.size === 0) return { waves: [] };

      const waves = graph.computeStartWaves(servicesToStart);

      if (!targets) {
        const stopWaves = await this.planProfileStops(
          projectName,
          activeProfile,
          allProcesses,
          allContainers,
          isPm2Running,
          isDockerRunning,
        );
        return { waves: [...stopWaves, ...waves] };
      }

      return { waves };
    }

    let selectedProcesses: Process[];
    let selectedContainers: Array<[string, Container]>;

    if (targets && targets.length > 0) {
      selectedProcesses = allProcesses.filter((p) =>
        targets.includes(p.name as string),
      );
      selectedContainers = allContainers.filter(([name]) =>
        targets.includes(name),
      );
    } else {
      selectedProcesses = allProcesses;
      selectedContainers = allContainers;
    }

    const servicesToStop = new Set<string>();
    for (const p of selectedProcesses) {
      if (isPm2Running(p.name as string)) servicesToStop.add(p.name as string);
    }
    for (const [name] of selectedContainers) {
      if (await isDockerRunning(name)) servicesToStop.add(name);
    }

    if (servicesToStop.size === 0) return { waves: [] };

    const waves = graph.computeStopWaves(servicesToStop);
    return { waves };
  }

  private async planProfileStops(
    projectName: string,
    activeProfile: string | undefined,
    allProcesses: Process[],
    allContainers: Array<[string, Container]>,
    isPm2Running: (name: string) => boolean,
    isDockerRunning: (name: string) => Promise<boolean>,
  ): Promise<ExecutionWave[]> {
    const stopActions: ExecutionWave[] = [];

    for (const process of allProcesses) {
      const hasProfiles =
        Array.isArray(process.profiles) && process.profiles.length > 0;
      const shouldRun =
        !hasProfiles ||
        (activeProfile &&
          process.profiles &&
          process.profiles.includes(activeProfile));

      if (!shouldRun && isPm2Running(process.name as string)) {
        stopActions.push({
          actions: [
            {
              type: "stop",
              serviceType: "native",
              name: process.name as string,
              healthcheck: process.healthcheck ?? 5,
            },
          ],
        });
      }
    }

    for (const [name, container] of allContainers) {
      const hasProfiles =
        Array.isArray(container.profiles) && container.profiles.length > 0;
      const shouldRun =
        !hasProfiles ||
        (activeProfile &&
          container.profiles &&
          container.profiles.includes(activeProfile));

      if (!shouldRun && (await isDockerRunning(name))) {
        stopActions.push({
          actions: [
            {
              type: "stop",
              serviceType: "docker",
              name,
              healthcheck: container.healthcheck ?? 5,
            },
          ],
        });
      }
    }

    return stopActions;
  }
}
