import { readFileSync, existsSync } from "fs";
import path from "path";
import { parse } from "yaml";
import { parse as dotenvParse } from "dotenv";
import { ZapperConfig, Process, Task, Container } from "../utils";
import { logger } from "../utils/logger";

interface RawEnvFile {
  envs?: Array<Record<string, string>>;
}

type InlineEnv = { keys: string[]; pairs: Record<string, string> };

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

    // Process docker env whitelist (preferred over containers)
    const dockerServices = resolvedConfig.docker || resolvedConfig.containers;
    if (dockerServices) {
      for (const [name, container] of Object.entries(dockerServices)) {
        if (!container.name) container.name = name;
        this.resolveContainerEnv(container, mergedEnvFromFiles);
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

  private static splitInlineEnv(entries?: string[]): InlineEnv {
    const result: InlineEnv = { keys: [], pairs: {} };
    if (!Array.isArray(entries)) return result;
    for (const raw of entries) {
      const idx = raw.indexOf("=");
      if (idx === -1) result.keys.push(raw);
      else result.pairs[raw.slice(0, idx)] = raw.slice(idx + 1);
    }
    return result;
  }

  private static resolveProcessEnv(
    proc: Process,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    logger.debug(`Processing process: ${proc.name}`);

    // Local env_files: if present, use them and bypass whitelist
    const local = this.loadAndMergeEnvFiles(proc.env_files);
    const useLocalOnly = Object.keys(local).length > 0;

    if (useLocalOnly) {
      // Overlay inline key=value on top of local
      const inline = this.splitInlineEnv(proc.env);
      proc.resolvedEnv = { ...local, ...inline.pairs };
      logger.debug(
        `Final resolved env for ${proc.name} (local env_files + inline pairs):`,
        proc.resolvedEnv,
      );
      return;
    }

    // Parse inline env into keys (whitelist) and pairs (overrides)
    const inline = this.splitInlineEnv(proc.env);

    const whitelist =
      inline.keys.length > 0
        ? inline.keys
        : Array.isArray(proc.envs)
          ? proc.envs
          : [];

    const envSubset: Record<string, string> = {};
    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      if (value !== undefined) envSubset[key] = value;
    }

    // Overlay inline pairs last
    proc.resolvedEnv = { ...envSubset, ...inline.pairs };
    // Keep env as originally provided (including inline strings) when present
    if (!Array.isArray(proc.env)) proc.env = whitelist;

    logger.debug(`Final resolved env for ${proc.name}:`, proc.resolvedEnv);
  }

  private static resolveContainerEnv(
    container: Container,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    const inline = this.splitInlineEnv(container.env);
    const whitelist = inline.keys;
    const envSubset: Record<string, string> = {};
    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      if (value !== undefined) envSubset[key] = value;
    }
    container.resolvedEnv = { ...envSubset, ...inline.pairs };
    container.env = Array.isArray(container.env) ? container.env : whitelist;
    logger.debug(
      `Final resolved env for docker ${container.name}:`,
      container.resolvedEnv,
    );
  }

  private static resolveTaskEnv(
    task: Task,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    const inline = this.splitInlineEnv(task.env);
    const whitelist = inline.keys;

    const envSubset: Record<string, string> = {};
    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      if (value !== undefined) envSubset[key] = value;
    }

    task.resolvedEnv = { ...envSubset, ...inline.pairs };
    task.env = Array.isArray(task.env) ? task.env : whitelist;
    logger.debug(`Final resolved env for task ${task.name}:`, task.resolvedEnv);
  }

  private static loadAndMergeEnvFiles(
    files?: string[],
  ): Record<string, string> {
    if (!Array.isArray(files) || files.length === 0) return {};

    const merged: Record<string, string> = {};

    for (const file of files) {
      if (!existsSync(file)) continue;
      const ext = path.extname(file).toLowerCase();
      const base = path.basename(file);
      try {
        const content = readFileSync(file, "utf8");
        const isDotenv = base.startsWith(".env") || base.endsWith(".env");
        if (isDotenv) {
          const parsed = dotenvParse(content);
          Object.assign(merged, parsed);
        } else if (ext === ".yaml" || ext === ".yml") {
          const data = parse(content) as RawEnvFile | undefined;
          const envs = Array.isArray(data?.envs) ? data?.envs : [];
          for (const kv of envs) Object.assign(merged, kv);
        }
      } catch (e) {
        logger.debug(`Failed to read env file ${file}: ${e}`);
      }
    }

    return merged;
  }

  static getMergedEnvFromFiles(config: ZapperConfig): Record<string, string> {
    return this.loadAndMergeEnvFiles(config.env_files);
  }

  static getProcessEnv(
    processName: string,
    resolvedConfig: ZapperConfig,
  ): Record<string, string> {
    const proc = resolvedConfig.bare_metal?.[processName];
    if (!proc) throw new Error(`Process ${processName} not found`);
    return proc.resolvedEnv || {};
  }
}
