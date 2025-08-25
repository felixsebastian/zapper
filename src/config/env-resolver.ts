import { readFileSync, existsSync } from "fs";
import path from "path";
import { parse } from "yaml";
import { parse as dotenvParse } from "dotenv";
import { ZapperConfig, Process, Task } from "../types";
import { logger } from "../utils/logger";

interface RawEnvFile {
  envs?: Array<Record<string, string>>;
}

export class EnvResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    const resolvedConfig = { ...config };

    const mergedEnvFromFiles = this.loadAndMergeEnvFiles(
      resolvedConfig.env_files,
    );

    logger.debug("Merged env files:", mergedEnvFromFiles);

    // Process bare_metal processes (preferred)
    if (resolvedConfig.bare_metal) {
      for (const [name, proc] of Object.entries(resolvedConfig.bare_metal)) {
        // Ensure the process has a name field
        if (!proc.name) {
          proc.name = name;
        }
        this.resolveProcessEnv(proc, mergedEnvFromFiles);
      }
    }

    // Process legacy processes (backward compatibility)
    if (resolvedConfig.processes) {
      for (const proc of resolvedConfig.processes) {
        this.resolveProcessEnv(proc, mergedEnvFromFiles);
      }
    }

    // Resolve tasks env whitelist
    if (resolvedConfig.tasks) {
      for (const [name, task] of Object.entries(resolvedConfig.tasks)) {
        if (!task.name) task.name = name;
        this.resolveTaskEnv(task, mergedEnvFromFiles);
      }
    }

    return resolvedConfig;
  }

  private static resolveProcessEnv(
    proc: Process,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    logger.debug(`Processing process: ${proc.name}`);

    // Normalize: prefer 'env' (whitelist). If missing, fallback to legacy 'envs'.
    const whitelist = Array.isArray(proc.env)
      ? proc.env
      : Array.isArray(proc.envs)
        ? proc.envs
        : [];

    logger.debug(`Process env whitelist:`, whitelist);

    const envSubset: Record<string, string> = {};
    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      logger.debug(`Looking for env var ${key}, found:`, value);
      if (value !== undefined) envSubset[key] = value;
    }

    proc.resolvedEnv = envSubset;
    // Ensure env remains the whitelist for downstream usage/logging
    proc.env = whitelist;

    logger.debug(`Final resolved env for ${proc.name}:`, proc.resolvedEnv);
  }

  private static resolveTaskEnv(
    task: Task,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    const whitelist = Array.isArray(task.env) ? task.env : [];
    const envSubset: Record<string, string> = {};
    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      if (value !== undefined) envSubset[key] = value;
    }
    task.resolvedEnv = envSubset;
    task.env = whitelist;
    logger.debug(`Final resolved env for task ${task.name}:`, task.resolvedEnv);
  }

  static getMergedEnvFromFiles(config: ZapperConfig): Record<string, string> {
    return this.loadAndMergeEnvFiles(config.env_files);
  }

  private static loadAndMergeEnvFiles(
    envFiles?: string[],
  ): Record<string, string> {
    const merged: Record<string, string> = {};
    if (!envFiles || envFiles.length === 0) return merged;

    logger.debug("Loading env files:", envFiles);

    for (const filePath of envFiles) {
      try {
        if (!existsSync(filePath)) {
          logger.warn(`Env file does not exist: ${filePath}`);
          continue;
        }

        logger.debug(`Reading env file: ${filePath}`);

        const baseName = path.basename(filePath);
        const isDotenvFile =
          baseName.startsWith(".env") || baseName.endsWith(".env");
        if (isDotenvFile) {
          const content = readFileSync(filePath, "utf8");
          const envVars = dotenvParse(content) || {};
          logger.debug(`Loaded .env vars:`, envVars);

          for (const [key, value] of Object.entries(envVars)) {
            if (value !== undefined) {
              merged[key] = String(value);
              logger.debug(`Added env var: ${key} = ${value}`);
            }
          }
        } else {
          const content = readFileSync(filePath, "utf8");
          logger.debug(`File content:`, content);

          const parsed = parse(content) as RawEnvFile | undefined;
          logger.debug(`Parsed content:`, parsed);

          if (!parsed || !parsed.envs) {
            logger.debug(`No envs found in ${filePath}`);
            continue;
          }

          for (const entry of parsed.envs) {
            logger.debug(`Processing env entry:`, entry);
            for (const [k, v] of Object.entries(entry)) {
              merged[k] = String(v);
              logger.debug(`Added env var: ${k} = ${v}`);
            }
          }
        }
      } catch (error) {
        throw new Error(`Failed to load env file ${filePath}: ${error}`);
      }
    }

    logger.debug("Final merged env vars:", merged);
    return merged;
  }

  static getProcessEnv(
    processName: string,
    config: ZapperConfig,
  ): Record<string, string> {
    // Check bare_metal first, then fallback to legacy processes
    let process = config.bare_metal?.[processName];
    if (!process) {
      process = config.processes?.find((p) => p.name === processName);
    }
    if (!process) throw new Error(`Process ${processName} not found`);
    return process.resolvedEnv || {};
  }
}
