import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { SequentialStrategy } from "./strategies/sequential-strategy";
import { PlanExecutor } from "./plan-executor";
import { Pm2Executor } from "../process/pm2-executor";
import { ZapperConfig, Process } from "../types";
import path from "path";
import { logger } from "../utils/logger";

export class Zapper {
  private config: ZapperConfig | null = null;
  private planExecutor: PlanExecutor | null = null;
  private configDir: string | null = null;

  constructor() {}

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      this.configDir = path.dirname(path.resolve(configPath));
      this.config = YamlParser.parse(configPath);

      // Normalize env_files to absolute paths relative to the config file directory
      if (this.config.env_files && this.config.env_files.length > 0) {
        this.config.env_files = this.config.env_files.map((p) =>
          path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
        );
      }

      ConfigValidator.validate(this.config);
      this.config = EnvResolver.resolve(this.config);

      const strategy = new SequentialStrategy();
      const executor = new Pm2Executor(this.config.project, this.configDir);
      this.planExecutor = new PlanExecutor(strategy, executor);
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  private getProcesses(): Process[] {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    // Prefer bare_metal over legacy processes
    if (
      this.config.bare_metal &&
      Object.keys(this.config.bare_metal).length > 0
    ) {
      return Object.entries(this.config.bare_metal).map(([name, process]) => ({
        ...process,
        name: process.name || name, // Ensure name is set
      }));
    }

    if (this.config.processes && this.config.processes.length > 0) {
      return this.config.processes;
    }

    return [];
  }

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    if (allProcesses.length === 0) {
      throw new Error("No processes defined in config");
    }

    const processesToStart = processNames
      ? allProcesses.filter((p) => processNames.includes(p.name))
      : allProcesses;

    const mergedYamlEnvs = EnvResolver.getMergedEnvFromFiles(this.config);
    logger.debug("merged yaml envs:", mergedYamlEnvs);

    for (const p of processesToStart) {
      const whitelist = Array.isArray(p.env) ? p.env : [];
      const whitelistWithValues = Object.fromEntries(
        whitelist.map((k) => [k, mergedYamlEnvs[k] ?? "(missing)"]),
      );
      logger.debug(
        `process ${p.name} whitelist (with values):`,
        whitelistWithValues,
      );
      logger.debug(`process ${p.name} resolved env:`, p.resolvedEnv || {});
    }

    const plan = this.planExecutor!.createPlan(processesToStart);
    await this.planExecutor!.executePlan(plan, "start", this.config.project);
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const processesToStop = processNames
      ? allProcesses.filter((p) => processNames.includes(p.name))
      : allProcesses;

    const plan = this.planExecutor!.createPlan(processesToStop);
    await this.planExecutor!.executePlan(plan, "stop");
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const processesToRestart = processNames
      ? allProcesses.filter((p) => processNames.includes(p.name))
      : allProcesses;

    const plan = this.planExecutor!.createPlan(processesToRestart);
    await this.planExecutor!.executePlan(plan, "restart");
  }

  async getProcessStatus(processName?: string): Promise<Process[]> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const processesToCheck = processName
      ? allProcesses.filter((p) => p.name === processName)
      : allProcesses;

    return processesToCheck;
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    // For logs, we don't need to check the config - we can show logs for any PM2 process
    // Use a default project name if config is not loaded
    const projectName = this.config?.project || "default";
    const configDir = this.configDir || ".";

    const pm2Executor = new Pm2Executor(projectName, configDir);
    await pm2Executor.showLogs(processName, follow);
  }
}
