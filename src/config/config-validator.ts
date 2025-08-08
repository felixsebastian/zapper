import { ZapperConfig, Process } from "../types";

export class ConfigValidator {
  static validate(config: ZapperConfig): void {
    this.validateProject(config);
    this.validateProcesses(config);
  }

  private static validateProject(config: ZapperConfig): void {
    if (!config.project) {
      throw new Error("Config must have a project field");
    }
  }

  private static validateProcesses(config: ZapperConfig): void {
    if (!config.processes || config.processes.length === 0) {
      throw new Error("Config must have at least one process defined");
    }

    for (const process of config.processes) {
      this.validateProcess(process);
    }
  }

  private static validateProcess(process: Process): void {
    if (!process.name) {
      throw new Error("Process must have a name field");
    }

    if (!process.cmd) {
      throw new Error(`Process ${process.name} must have a cmd field`);
    }
  }
}
