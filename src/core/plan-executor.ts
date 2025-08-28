import { logger } from "../utils/logger";
import { ExecutionPlan, ExecutionStep } from "./strategies";
import { Process } from "../types";
import { DockerManager } from "../containers";

export type ActionType = "start" | "stop" | "restart";

export interface Action {
  type: ActionType;
  process: Process;
}

export interface ActionPlan {
  actions: Action[];
}

export class PlanExecutor {
  constructor(
    private strategy: {
      createPlan(processes: Process[]): ExecutionPlan;
      validatePlan(plan: ExecutionPlan): boolean;
    },
    private executor: {
      startProcess(process: Process, projectName: string): Promise<void>;
      stopProcess(processName: string): Promise<void>;
      restartProcess(processName: string): Promise<void>;
      showLogs?(processName: string, follow?: boolean): Promise<void>;
    },
  ) {}

  async executePlan(
    plan: ExecutionPlan,
    operation: ActionType,
    projectName?: string,
  ): Promise<void> {
    if (!this.strategy.validatePlan(plan)) {
      throw new Error("Invalid execution plan");
    }

    const opVerb = operation;
    const opPast =
      opVerb === "stop"
        ? "stopped"
        : opVerb === "start"
          ? "started"
          : "restarted";

    logger.info(
      `${opVerb === "start" ? "Starting" : opVerb === "stop" ? "Stopping" : "Restarting"} ${plan.totalSteps} process${plan.totalSteps === 1 ? "" : "es"}...`,
    );
    logger.debug(`Executing ${operation} plan with ${plan.totalSteps} steps`);

    for (const step of plan.steps) {
      try {
        (step as ExecutionStep).status = "running";
        logger.debug(
          `[${step.order}/${plan.totalSteps}] ${operation}ing ${step.process.name}`,
        );

        switch (operation) {
          case "start":
            if (!projectName)
              throw new Error("Project name is required for start operations");
            await this.executor.startProcess(step.process, projectName);
            break;
          case "stop":
            await this.executor.stopProcess(step.process.name);
            break;
          case "restart":
            await this.executor.restartProcess(step.process.name);
            break;
        }

        (step as ExecutionStep).status = "completed";
        logger.debug(`${step.process.name} ${opPast}`);
      } catch (error) {
        (step as ExecutionStep).status = "failed";
        logger.error(`Failed to ${operation} ${step.process.name}:`, error);
        throw error;
      }
    }

    logger.success(`All processes ${opPast}.`);
  }

  createPlan(processes: Process[]): ExecutionPlan {
    return this.strategy.createPlan(processes);
  }

  async executeActionPlan(
    plan: {
      actions: Array<{
        type: "start" | "stop";
        serviceType: "bare_metal" | "docker";
        name: string;
        process?: Process;
      }>;
    },
    projectName: string,
    lookup: (name: string) => {
      process?: Process;
      container?: { name: string };
    },
  ): Promise<void> {
    // Execute sequentially for now
    for (const action of plan.actions) {
      if (action.serviceType === "bare_metal") {
        const proc = action.process || lookup(action.name).process;
        if (!proc) throw new Error(`Process not found for ${action.name}`);
        if (action.type === "start")
          await this.executor.startProcess(proc, projectName);
        else await this.executor.stopProcess(proc.name);
      } else {
        const dockerName = `zap.${projectName}.${action.name}`;
        if (action.type === "start") {
          // For docker start via executor, Zapper still prepares full config; this path is unused for now
          await DockerManager.restartContainer(dockerName);
        } else {
          await DockerManager.stopContainer(dockerName);
        }
      }
    }
  }
}
