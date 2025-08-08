import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { SequentialStrategy } from "./strategies/sequential-strategy";
import { PlanExecutor } from "./plan-executor";
import { Pm2Executor } from "../process/pm2-executor";
import { ZapperConfig, Process } from "../types";

export class Zapper {
  private config: ZapperConfig | null = null;
  private planExecutor: PlanExecutor | null = null;

  constructor() {
    // PlanExecutor will be initialized after config is loaded
  }

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      this.config = YamlParser.parse(configPath);
      ConfigValidator.validate(this.config);
      this.config = EnvResolver.resolve(this.config);

      // Initialize planExecutor with project name
      const strategy = new SequentialStrategy();
      const executor = new Pm2Executor(this.config.project);
      this.planExecutor = new PlanExecutor(strategy, executor);
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const processesToStart = processNames
      ? this.config.processes.filter((p) => processNames.includes(p.name))
      : this.config.processes;

    const plan = this.planExecutor!.createPlan(processesToStart);
    await this.planExecutor!.executePlan(plan, "start", this.config.project);
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const processesToStop = processNames
      ? this.config.processes.filter((p) => processNames.includes(p.name))
      : this.config.processes;

    const plan = this.planExecutor!.createPlan(processesToStop);
    await this.planExecutor!.executePlan(plan, "stop");
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const processesToRestart = processNames
      ? this.config.processes.filter((p) => processNames.includes(p.name))
      : this.config.processes;

    const plan = this.planExecutor!.createPlan(processesToRestart);
    await this.planExecutor!.executePlan(plan, "restart");
  }

  async getProcessStatus(processName?: string): Promise<Process[]> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const processesToCheck = processName
      ? this.config.processes.filter((p) => p.name === processName)
      : this.config.processes;

    return processesToCheck;
  }
}
