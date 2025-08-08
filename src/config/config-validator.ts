import { existsSync } from "fs";
import { ZapperConfig, Process } from "../types";

export class ConfigValidator {
  static validate(config: ZapperConfig): void {
    this.validateProject(config);
    this.validateEnvFiles(config);
    this.validateProcesses(config);
  }

  private static validateProject(config: ZapperConfig): void {
    if (!config.project) {
      throw new Error("Config must have a project field");
    }
  }

  private static validateEnvFiles(config: ZapperConfig): void {
    if (config.env_files !== undefined) {
      if (!Array.isArray(config.env_files)) {
        throw new Error("env_files must be an array of file paths");
      }
      for (const filePath of config.env_files) {
        if (typeof filePath !== "string" || filePath.trim() === "") {
          throw new Error("env_files must contain non-empty string paths");
        }
        if (!existsSync(filePath)) {
          throw new Error(`Env file does not exist: ${filePath}`);
        }
      }
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

    if (process.envs !== undefined) {
      if (!Array.isArray(process.envs)) {
        throw new Error(
          `Process ${process.name} envs must be an array of strings`,
        );
      }
      for (const key of process.envs) {
        if (typeof key !== "string" || key.trim() === "") {
          throw new Error(
            `Process ${process.name} envs must contain non-empty string keys`,
          );
        }
      }
    }
  }
}
