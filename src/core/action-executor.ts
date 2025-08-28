import { ZapperConfig, Process, Container } from "../types";
import { DockerManager } from "../containers";
import { logger } from "../utils/logger";
import { Pm2Executor } from "../process/pm2-executor";

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

export class ActionExecutor {
  constructor(
    private readonly projectName: string,
    private readonly configDir: string | null,
    private readonly config: ZapperConfig,
  ) {}

  private findProcess(name: string): Process | undefined {
    if (this.config.bare_metal && this.config.bare_metal[name]) {
      const p = this.config.bare_metal[name];
      return { ...p, name: p.name || name };
    }
    if (Array.isArray(this.config.processes)) {
      return this.config.processes.find((p) => p.name === name);
    }
    return undefined;
  }

  private findContainer(name: string): [string, Container] | undefined {
    const docker = this.config.docker || this.config.containers;
    if (!docker) return undefined;
    const c = docker[name];
    if (!c) return undefined;
    return [name, c];
  }

  async execute(plan: ActionPlan): Promise<void> {
    const pm2 = new Pm2Executor(this.projectName, this.configDir || undefined);

    for (const action of plan.actions) {
      if (action.serviceType === "bare_metal") {
        const proc = this.findProcess(action.name);
        if (!proc) throw new Error(`Process not found: ${action.name}`);
        if (action.type === "start") {
          await pm2.startProcess(proc, this.projectName);
          logger.info(`Started ${proc.name}`);
        } else {
          await pm2.stopProcess(proc.name);
          logger.info(`Stopped ${proc.name}`);
        }
      } else {
        const pair = this.findContainer(action.name);
        if (!pair) throw new Error(`Docker service not found: ${action.name}`);
        const [name, c] = pair;
        const dockerName = `zap.${this.projectName}.${name}`;

        if (action.type === "start") {
          const ports = Array.isArray(c.ports) ? c.ports : [];
          const volumeBindings: string[] = [];
          const ensureVolumeNames: string[] = [];
          if (Array.isArray(c.volumes)) {
            for (const v of c.volumes) {
              if (typeof v === "string") {
                const [volName, internal] = v.split(":");
                ensureVolumeNames.push(volName);
                volumeBindings.push(`${volName}:${internal}`);
              } else {
                ensureVolumeNames.push(v.name);
                volumeBindings.push(`${v.name}:${v.internal_dir}`);
              }
            }
          }
          for (const vol of ensureVolumeNames)
            await DockerManager.createVolume(vol);

          const envMap = c.resolvedEnv || {};
          const labels = {
            "com.docker.compose.project": this.projectName,
            "com.docker.compose.service": name,
            "com.zapper.project": this.projectName,
            "com.zapper.service": name,
          } as Record<string, string>;

          await DockerManager.startContainer(dockerName, {
            image: c.image,
            ports,
            volumes: volumeBindings,
            networks: c.networks,
            environment: envMap,
            command: c.command,
            labels,
          });
          logger.info(`Started docker ${dockerName}`);
        } else {
          await DockerManager.stopContainer(dockerName);
          logger.info(`Stopped docker ${dockerName}`);
        }
      }
    }
  }
}
