import { Process } from "../../types";
import { ExecutionStrategy, ExecutionPlan, ExecutionStep } from "./index";

export class SequentialStrategy implements ExecutionStrategy {
  name = "sequential";

  createPlan(processes: Process[]): ExecutionPlan {
    const steps: ExecutionStep[] = processes.map((process, index) => ({
      process,
      order: index + 1,
      dependencies: [],
      status: "pending",
    }));

    return {
      steps,
      totalSteps: steps.length,
    };
  }

  validatePlan(plan: ExecutionPlan): boolean {
    // Sequential strategy is always valid - no dependencies to check
    return plan.steps.length > 0;
  }
}
