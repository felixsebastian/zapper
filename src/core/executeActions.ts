import { ZapperConfig } from "../utils";
import { DockerManager } from "./docker";
import { logger } from "../utils/logger";
import { Pm2Executor } from "./process/Pm2Executor";
import { ActionPlan } from "../types";
import { findProcess } from "./findProcess";
import { findContainer } from "./findContainer";

export async function executeActions(
  config: ZapperConfig,
  projectName: string,
  configDir: string | null,
  plan: ActionPlan,
): Promise<void> {
  const pm2 = new Pm2Executor(projectName, configDir || undefined);

  for (const action of plan.actions) {
    if (action.serviceType === "bare_metal") {
      const proc = findProcess(config, action.name);
      if (!proc) throw new Error(`Process not found: ${action.name}`);

      if (action.type === "start") {
        await pm2.startProcess(proc, projectName);
        logger.info(`Started ${proc.name as string}`);
      } else {
        await pm2.stopProcess(proc.name as string);
        logger.info(`Stopped ${proc.name as string}`);
      }
    } else {
      const pair = findContainer(config, action.name);
      if (!pair) throw new Error(`Docker service not found: ${action.name}`);
      const [name, c] = pair;
      const dockerName = `zap.${projectName}.${name}`;

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

        for (const vol of ensureVolumeNames) {
          await DockerManager.createVolume(vol);
        }

        const envMap = c.resolvedEnv || {};

        const labels = {
          "com.docker.compose.project": projectName,
          "com.docker.compose.service": name,
          "com.zapper.project": projectName,
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

        logger.info(`Started ${name}`);
      } else {
        await DockerManager.stopContainer(dockerName);
        logger.info(`Stopped ${name}`);
      }
    }
  }
}
