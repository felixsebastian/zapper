import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZapperConfig } from "../types";

interface RawEnvFile {
  envs?: Array<Record<string, string>>;
}

export class EnvResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    const resolvedConfig = { ...config };

    const mergedEnvFromFiles = this.loadAndMergeEnvFiles(
      resolvedConfig.env_files,
    );

    for (const proc of resolvedConfig.processes) {
      if (proc.envs && proc.envs.length > 0) {
        const envSubset: Record<string, string> = {};
        for (const key of proc.envs) {
          const value = mergedEnvFromFiles[key];
          if (value !== undefined) envSubset[key] = value;
        }
        proc.env = this.interpolateEnvVars(envSubset);
      } else if (proc.env) {
        proc.env = this.interpolateEnvVars(proc.env);
      }
    }

    return resolvedConfig;
  }

  static getMergedEnvFromFiles(config: ZapperConfig): Record<string, string> {
    return this.loadAndMergeEnvFiles(config.env_files);
  }

  private static loadAndMergeEnvFiles(
    envFiles?: string[],
  ): Record<string, string> {
    const merged: Record<string, string> = {};
    if (!envFiles || envFiles.length === 0) return merged;

    for (const filePath of envFiles) {
      try {
        const content = readFileSync(filePath, "utf8");
        const parsed = parse(content) as RawEnvFile | undefined;
        if (!parsed || !parsed.envs) continue;
        for (const entry of parsed.envs) {
          for (const [k, v] of Object.entries(entry)) {
            merged[k] = String(v);
          }
        }
      } catch (error) {
        throw new Error(`Failed to load env file ${filePath}: ${error}`);
      }
    }
    return merged;
  }

  private static interpolateEnvVars(
    env: Record<string, string>,
  ): Record<string, string> {
    const resolved: Record<string, string> = {} as Record<string, string>;

    for (const [key, value] of Object.entries(env)) {
      resolved[key] = this.interpolateString(value);
    }

    return resolved;
  }

  private static interpolateString(str: string): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = globalThis.process?.env?.[varName];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${varName} is not defined`);
      }
      return envValue;
    });
  }

  static getProcessEnv(
    processName: string,
    config: ZapperConfig,
  ): Record<string, string> {
    const process = config.processes.find((p) => p.name === processName);
    if (!process) {
      throw new Error(`Process ${processName} not found`);
    }

    return process.env || {};
  }
}
