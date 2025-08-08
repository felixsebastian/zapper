import { Process } from "../../types";

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
}

export interface ExecutionStep {
  process: Process;
  order: number;
  dependencies: string[];
  status: "pending" | "running" | "completed" | "failed";
}

export interface ExecutionStrategy {
  name: string;
  createPlan(processes: Process[]): ExecutionPlan;
  validatePlan(plan: ExecutionPlan): boolean;
}

export interface ProcessExecutor {
  startProcess(process: Process, projectName: string): Promise<void>;
  stopProcess(processName: string): Promise<void>;
  restartProcess(processName: string): Promise<void>;
}
