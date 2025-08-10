import { Process } from "../types";
import {
  ExecutionPlan,
  ExecutionStrategy,
  ProcessExecutor,
} from "./strategies";
import { logger } from "../utils/logger";

export class PlanExecutor {
  constructor(
    private strategy: ExecutionStrategy,
    private executor: ProcessExecutor,
  ) {}

  async executePlan(
    plan: ExecutionPlan,
    operation: "start" | "stop" | "restart",
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
        step.status = "running";
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

        step.status = "completed";
        // per-service success moved to debug
        logger.debug(`${step.process.name} ${opPast}`);
      } catch (error) {
        step.status = "failed";
        logger.error(`Failed to ${operation} ${step.process.name}:`, error);
        throw error;
      }
    }

    logger.success(`All processes ${opPast}.`);
  }

  createPlan(processes: Process[]): ExecutionPlan {
    return this.strategy.createPlan(processes);
  }
}
