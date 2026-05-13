import { ZapperConfig } from "../utils";
import { DockerManager } from "./docker";
import { Pm2Executor } from "./process/Pm2Executor";
import {
  Action,
  ActionPlan,
  ExecutionWave,
  ServiceActionEvent,
  ServiceActionReporter,
  ServiceExecutionReport,
} from "../types";
import {
  applyServiceActionEventToExecutionReport,
  emptyServiceExecutionReport,
} from "../utils/serviceActionReport";
import { findProcess } from "./findProcess";
import { findContainer } from "./findContainer";
import { buildServiceName } from "../utils/nameBuilder";
import { DEFAULT_INSTANCE_KEY } from "./instanceResolver";
import { resolveContainerVolumes } from "../config/volumeManager";
import {
  getProjectRootHash,
  getSystemRegistryId,
} from "../system/SystemRegistry";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function checkHealthUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(
  action: Action,
  reporter?: ServiceActionReporter,
): Promise<void> {
  if (action.type !== "start") return;

  const { healthcheck } = action;
  if (typeof healthcheck === "number") {
    await sleep(healthcheck * 1000);
  } else if (typeof healthcheck === "string") {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      if (await checkHealthUrl(healthcheck)) return;
      await sleep(1000);
    }
    reporter?.onEvent({
      type: "service.healthcheck.timeout",
      service: action.name,
      healthcheck,
    });
  }
}

/**
 * Converts a wave into a structured progress event.
 * Groups actions by type and sorts alphabetically.
 */
function waveToEvent(wave: ExecutionWave) {
  const start = wave.actions
    .filter((a) => a.type === "start")
    .map((a) => a.name)
    .sort();

  const stop = wave.actions
    .filter((a) => a.type === "stop")
    .map((a) => a.name)
    .sort();

  return { type: "services.wave" as const, start, stop };
}

function waveCompletedEvent(wave: ExecutionWave): ServiceActionEvent {
  const started = wave.actions
    .filter((a) => a.type === "start")
    .map((a) => a.name)
    .sort();

  const stopped = wave.actions
    .filter((a) => a.type === "stop")
    .map((a) => a.name)
    .sort();

  return { type: "services.wave.completed", started, stopped };
}

async function executeAction(
  action: Action,
  config: ZapperConfig,
  projectName: string,
  pm2: Pm2Executor,
  configDir?: string | null,
): Promise<void> {
  if (action.serviceType === "native") {
    const proc = findProcess(config, action.name);
    if (!proc) throw new Error(`Process not found: ${action.name}`);

    if (action.type === "start") {
      await pm2.startProcess(proc, projectName);
    } else {
      await pm2.stopProcess(proc.name as string);
    }
  } else {
    const pair = findContainer(config, action.name);
    if (!pair) throw new Error(`Docker service not found: ${action.name}`);
    const [name, c] = pair;
    const runtimeConfig = config as ZapperConfig & {
      instanceId?: string;
      instanceKey?: string;
      configPath?: string;
    };
    const instanceId = runtimeConfig.instanceId;
    const instanceKey = runtimeConfig.instanceKey || DEFAULT_INSTANCE_KEY;
    const dockerName = buildServiceName(projectName, name, instanceId);

    if (action.type === "start") {
      const ports = Array.isArray(c.ports) ? c.ports : [];
      const resolvedVolumes = resolveContainerVolumes({
        projectRoot: configDir || ".",
        projectName,
        instanceKey,
        instanceId: instanceId || DEFAULT_INSTANCE_KEY,
        serviceName: name,
        volumes: c.volumes,
      });

      for (const vol of resolvedVolumes.namedVolumesToCreate) {
        await DockerManager.createVolume(vol);
      }

      const envMap = c.resolvedEnv || {};

      const labels = {
        "com.docker.compose.project": projectName,
        "com.docker.compose.service": name,
        "com.zapper.project": projectName,
        "com.zapper.service": name,
        "com.zapper.instance-id": instanceId || "",
        "com.zapper.instance-key": instanceKey,
      } as Record<string, string>;
      if (runtimeConfig.configPath) {
        labels["com.zapper.registry-id"] = getSystemRegistryId(
          configDir || ".",
          runtimeConfig.configPath,
        );
        labels["com.zapper.project-root-hash"] = getProjectRootHash(
          configDir || ".",
        );
      }

      await DockerManager.startContainerAsync(
        dockerName,
        {
          image: c.image,
          ports,
          volumes: resolvedVolumes.bindings,
          networks: c.networks,
          environment: envMap,
          command: c.command,
          labels,
        },
        {
          projectName,
          serviceName: name,
          configDir: configDir || undefined,
        },
      );
    } else {
      await DockerManager.stopContainer(dockerName);
    }
  }
}

export async function executeActions(
  config: ZapperConfig,
  projectName: string,
  configDir: string | null,
  plan: ActionPlan,
  reporter?: ServiceActionReporter,
): Promise<ServiceExecutionReport> {
  const instanceId = (config as ZapperConfig & { instanceId?: string })
    .instanceId;
  const pm2 = new Pm2Executor(projectName, configDir || undefined, instanceId);
  const report = emptyServiceExecutionReport();
  const emit = (event: ServiceActionEvent) => {
    applyServiceActionEventToExecutionReport(report, event);
    reporter?.onEvent(event);
  };

  for (const wave of plan.waves) {
    emit(waveToEvent(wave));

    // Execute all actions in the wave in parallel
    await Promise.all(
      wave.actions.map((action) =>
        executeAction(action, config, projectName, pm2, configDir),
      ),
    );

    emit(waveCompletedEvent(wave));

    // Wait for health checks in parallel
    await Promise.all(
      wave.actions.map((action) => waitForHealth(action, reporter)),
    );
  }

  return report;
}
