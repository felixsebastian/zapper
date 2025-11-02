import { ZapperConfig, Process, Container } from "../config/schemas";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";
import { Action, ActionPlan } from "../types";

export class Planner {
  constructor(private readonly config: ZapperConfig) {}

  private getProcesses(): Process[] {
    const { bare_metal, processes } = this.config;

    if (bare_metal && Object.keys(bare_metal).length > 0) {
      return Object.entries(bare_metal).map(([name, process]) => ({
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

  private select(
    op: "start" | "stop",
    targets?: string[],
    activeProfile?: string,
  ): {
    processes: Process[];
    containers: Array<[string, Container]>;
  } {
    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (op === "start") {
      if (targets && targets.length > 0) {
        // When targeting specific services, ignore profile filtering
        return {
          processes: allProcesses.filter((p) =>
            targets.includes(p.name as string),
          ),
          containers: allContainers.filter(([name]) => targets.includes(name)),
        };
      }

      // Only filter by active profile when doing startAll (no targets)
      return {
        processes: allProcesses.filter((p) => {
          // Services with no profiles always start
          if (!Array.isArray(p.profiles) || p.profiles.length === 0) {
            return true;
          }
          // Services with profiles only start if active profile matches
          return activeProfile && p.profiles.includes(activeProfile);
        }),
        containers: allContainers.filter(([, c]) => {
          // Services with no profiles always start
          if (!Array.isArray(c.profiles) || c.profiles.length === 0) {
            return true;
          }
          // Services with profiles only start if active profile matches
          return activeProfile && c.profiles.includes(activeProfile);
        }),
      };
    }

    // stop: don't apply profiles filter
    if (targets && targets.length > 0) {
      return {
        processes: allProcesses.filter((p) =>
          targets.includes(p.name as string),
        ),
        containers: allContainers.filter(([name]) => targets.includes(name)),
      };
    }

    return { processes: allProcesses, containers: allContainers };
  }

  private async planStartAllWithProfile(
    projectName: string,
    activeProfile: string,
    forceStart: boolean,
    actions: Action[],
  ): Promise<void> {
    // Get current state once
    const pm2List = await Pm2Manager.listProcesses();
    const runningPm2 = new Set(
      pm2List
        .filter((p) => p.status.toLowerCase() === "online")
        .map((p) => p.name as string),
    );

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    // Single loop for processes: decide START|STOP|SKIP
    for (const process of allProcesses) {
      const expectedPm2Name = `zap.${projectName}.${process.name}`;
      const isRunning = runningPm2.has(expectedPm2Name);

      const hasProfiles =
        Array.isArray(process.profiles) && process.profiles.length > 0;
      const shouldRun =
        !hasProfiles ||
        (process.profiles && process.profiles.includes(activeProfile));

      if (shouldRun && (forceStart || !isRunning)) {
        // Should be running but isn't -> START
        actions.push({
          type: "start",
          serviceType: "bare_metal",
          name: process.name as string,
        });
      } else if (!shouldRun && isRunning) {
        // Shouldn't be running but is -> STOP
        actions.push({
          type: "stop",
          serviceType: "bare_metal",
          name: process.name as string,
        });
      }
      // Otherwise SKIP (already in correct state)
    }

    // Single loop for containers: decide START|STOP|SKIP
    for (const [name, container] of allContainers) {
      const info = await DockerManager.getContainerInfo(
        `zap.${projectName}.${name}`,
      );
      const isRunning =
        !!info &&
        (info.status.toLowerCase() === "running" ||
          info.status.toLowerCase().includes("up"));

      const hasProfiles =
        Array.isArray(container.profiles) && container.profiles.length > 0;
      const shouldRun =
        !hasProfiles ||
        (container.profiles && container.profiles.includes(activeProfile));

      if (shouldRun && (forceStart || !isRunning)) {
        // Should be running but isn't -> START
        actions.push({
          type: "start",
          serviceType: "docker",
          name: name,
        });
      } else if (!shouldRun && isRunning) {
        // Shouldn't be running but is -> STOP
        actions.push({
          type: "stop",
          serviceType: "docker",
          name: name,
        });
      }
      // Otherwise SKIP (already in correct state)
    }
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
      return { actions: [...stopPlan.actions, ...startPlan.actions] };
    }

    const actions: Action[] = [];

    if (op === "start" && (!targets || targets.length === 0) && activeProfile) {
      // For startAll with active profile: go through ALL services and decide START|STOP|SKIP
      await this.planStartAllWithProfile(
        projectName,
        activeProfile,
        forceStart,
        actions,
      );
    } else {
      // For targeted operations or no active profile: use the old selection-based logic
      const selection = this.select(op, targets, activeProfile);

      const pm2List = await Pm2Manager.listProcesses();
      const runningPm2 = new Set(
        pm2List
          .filter((p) => p.status.toLowerCase() === "online")
          .map((p) => p.name as string),
      );
      const isPm2Running = (name: string) =>
        runningPm2.has(`zap.${projectName}.${name}`);

      if (op === "start") {
        for (const p of selection.processes) {
          if (forceStart || !isPm2Running(p.name as string))
            actions.push({
              type: "start",
              serviceType: "bare_metal",
              name: p.name as string,
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

          if (forceStart || !running)
            actions.push({ type: "start", serviceType: "docker", name });
        }
      } else if (op === "stop") {
        for (const p of selection.processes) {
          if (isPm2Running(p.name as string)) {
            actions.push({
              type: "stop",
              serviceType: "bare_metal",
              name: p.name as string,
            });
          }
        }

        for (const [name] of selection.containers) {
          const info = await DockerManager.getContainerInfo(
            `zap.${projectName}.${name}`,
          );

          const running =
            !!info &&
            (info.status.toLowerCase() === "running" ||
              info.status.toLowerCase().includes("up"));

          if (running) {
            actions.push({ type: "stop", serviceType: "docker", name });
          }
        }
      }
    }

    return { actions };
  }
}
