import { Process } from "../types";
import {
  ExecutionPlan,
  ExecutionStrategy,
  ProcessExecutor,
} from "./strategies";

declare const console: {
  log: (...args: unknown[]) => void;
};

export class PlanExecutor {
  constructor(
    private strategy: ExecutionStrategy,
    private executor: ProcessExecutor,
  ) {}

  async executePlan(
    plan: ExecutionPlan,
    operation: "start" | "stop" | "restart",
  ): Promise<void> {
    if (!this.strategy.validatePlan(plan)) {
      throw new Error("Invalid execution plan");
    }

    console.log(`Executing ${operation} plan with ${plan.totalSteps} steps...`);

    for (const step of plan.steps) {
      try {
        step.status = "running";
        console.log(
          `[${step.order}/${plan.totalSteps}] ${operation}ing ${step.process.name}...`,
        );

        switch (operation) {
          case "start":
            await this.executor.startProcess(step.process);
            break;
          case "stop":
            await this.executor.stopProcess(step.process.name);
            break;
          case "restart":
            await this.executor.restartProcess(step.process.name);
            break;
        }

        step.status = "completed";
        console.log(`✅ ${step.process.name} ${operation}ed successfully`);
      } catch (error) {
        step.status = "failed";
        console.log(`❌ Failed to ${operation} ${step.process.name}: ${error}`);
        throw error;
      }
    }

    console.log(`🎉 All processes ${operation}ed successfully!`);
  }

  createPlan(processes: Process[]): ExecutionPlan {
    return this.strategy.createPlan(processes);
  }
}
