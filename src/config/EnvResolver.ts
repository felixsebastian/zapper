import { readFileSync, existsSync } from "fs";
import path from "path";
import { parse } from "yaml";
import { parse as dotenvParse } from "dotenv";
import { expand } from "dotenv-expand";
import {
  ZapperConfig,
  Process as ConfigProcess,
  Task as ConfigTask,
  Container as ConfigContainer,
} from "../config/schemas";
import { Context, Process, Task, Container } from "../types/Context";
import { logger } from "../utils/logger";

interface RawEnvFile {
  envs?: Array<Record<string, string>>;
}

type InlineEnv = { keys: string[]; pairs: Record<string, string> };

export class EnvResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    const resolvedConfig = { ...config };

    const mergedEnvFromFiles = this.loadAndMergeEnvFiles(
      this.pickDefaultEnvFiles(resolvedConfig.env_files),
    );


    if (resolvedConfig.native) {
      for (const [name, proc] of Object.entries(resolvedConfig.native)) {
        if (!proc.name) proc.name = name;
        this.resolveConfigProcessEnv(proc, mergedEnvFromFiles);
      }
    }

    if (resolvedConfig.processes) {
      for (const proc of resolvedConfig.processes) {
        this.resolveConfigProcessEnv(proc, mergedEnvFromFiles);
      }
    }

    const dockerServices = resolvedConfig.docker || resolvedConfig.containers;

    if (dockerServices) {
      for (const [name, container] of Object.entries(dockerServices)) {
        if (!container.name) container.name = name;
        this.resolveConfigContainerEnv(container, mergedEnvFromFiles);
      }
    }

    if (resolvedConfig.tasks) {
      for (const [name, task] of Object.entries(resolvedConfig.tasks)) {
        if (!task.name) task.name = name;
        this.resolveConfigTaskEnv(task, mergedEnvFromFiles);
      }
    }

    return resolvedConfig;
  }

  static resolveContext(context: Context): Context {
    const resolvedContext = { ...context };

    const mergedEnvFromFiles = this.loadAndMergeEnvFiles(
      resolvedContext.envFiles,
    );

    for (const proc of resolvedContext.processes) {
      this.resolveProcessEnv(proc, mergedEnvFromFiles, context.projectRoot);
      if (proc.link)
        proc.link = this.expandString(proc.link, mergedEnvFromFiles);
    }

    for (const container of resolvedContext.containers) {
      this.resolveContainerEnv(container, mergedEnvFromFiles);
      if (container.link)
        container.link = this.expandString(container.link, mergedEnvFromFiles);
    }

    for (const task of resolvedContext.tasks) {
      this.resolveTaskEnv(task, mergedEnvFromFiles, context.projectRoot);
    }

    for (const link of resolvedContext.links) {
      link.url = this.expandString(link.url, mergedEnvFromFiles);
    }

    return resolvedContext;
  }

  private static expandString(
    value: string,
    env: Record<string, string>,
  ): string {
    const result = expand({
      parsed: { ...env, __value__: value },
      processEnv: {},
    });
    return result.parsed?.__value__ ?? value;
  }

  private static splitInlineEnv(entries?: string[] | string): InlineEnv {
    const result: InlineEnv = { keys: [], pairs: {} };
    if (!Array.isArray(entries)) {
      if (typeof entries === "string") {
        throw new Error(
          `EnvResolver received string env reference '${entries}' - this should have been resolved by WhitelistResolver`,
        );
      }
      return result;
    }

    for (const raw of entries) {
      const idx = raw.indexOf("=");
      if (idx === -1) result.keys.push(raw);
      else result.pairs[raw.slice(0, idx)] = raw.slice(idx + 1);
    }

    return result;
  }

  private static resolveConfigProcessEnv(
    proc: ConfigProcess,
    mergedEnvFromFiles: Record<string, string>,
  ): void {
    const local = this.loadAndMergeEnvFiles(proc.env_files);
    const useLocalOnly = Object.keys(local).length > 0;

    if (useLocalOnly) {
      const inline = this.splitInlineEnv(proc.env);
      proc.resolvedEnv = { ...local, ...inline.pairs };


      return;
    }

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

    proc.resolvedEnv = { ...envSubset, ...inline.pairs };
    if (!Array.isArray(proc.env)) proc.env = whitelist;

  }

  private static resolveConfigContainerEnv(
    container: ConfigContainer,
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

    logger.debug(`Final resolved env for docker ${container.name}:`, {
      data: container.resolvedEnv,
    });
  }

  private static resolveConfigTaskEnv(
    task: ConfigTask,
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
    logger.debug(`Final resolved env for task ${task.name}:`, {
      data: task.resolvedEnv,
    });
  }

  private static resolveProcessEnv(
    proc: Process,
    mergedEnvFromFiles: Record<string, string>,
    projectRoot: string,
  ): void {

    let processEnvFiles: string[] | undefined;
    if (proc.env_files && proc.env_files.length > 0) {
      processEnvFiles = proc.env_files.map((p) =>
        path.isAbsolute(p) ? p : path.join(projectRoot, p),
      );
    }

    const local = this.loadAndMergeEnvFiles(processEnvFiles);
    const useLocalOnly = Object.keys(local).length > 0;

    if (useLocalOnly) {
      const inline = this.splitInlineEnv(proc.env);
      proc.resolvedEnv = { ...local, ...inline.pairs };


      return;
    }

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

    proc.resolvedEnv = { ...envSubset, ...inline.pairs };
    if (!Array.isArray(proc.env)) proc.env = whitelist;

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

    logger.debug(`Final resolved env for docker ${container.name}:`, {
      data: container.resolvedEnv,
    });
  }

  private static resolveTaskEnv(
    task: Task,
    mergedEnvFromFiles: Record<string, string>,
    projectRoot: string,
  ): void {
    logger.debug(`Processing task: ${task.name}`);

    let taskEnvFiles: string[] | undefined;
    if (task.env_files && task.env_files.length > 0) {
      taskEnvFiles = task.env_files.map((p) =>
        path.isAbsolute(p) ? p : path.join(projectRoot, p),
      );
    }

    const local = this.loadAndMergeEnvFiles(taskEnvFiles);
    const useLocalOnly = Object.keys(local).length > 0;

    if (useLocalOnly) {
      const inline = this.splitInlineEnv(task.env);
      task.resolvedEnv = { ...local, ...inline.pairs };

      logger.debug(
        `Final resolved env for ${task.name} (local env_files + inline pairs):`,
        { data: task.resolvedEnv },
      );

      return;
    }

    const inline = this.splitInlineEnv(task.env);
    const whitelist = inline.keys;
    const envSubset: Record<string, string> = {};

    for (const key of whitelist) {
      const value = mergedEnvFromFiles[key];
      if (value !== undefined) envSubset[key] = value;
    }

    task.resolvedEnv = { ...envSubset, ...inline.pairs };
    task.env = Array.isArray(task.env) ? task.env : whitelist;

    logger.debug(`Final resolved env for task ${task.name}:`, {
      data: task.resolvedEnv,
    });
  }

  private static loadAndMergeEnvFiles(
    files?: string[],
  ): Record<string, string> {
    if (!Array.isArray(files) || files.length === 0) {
      logger.debug("No env files to load:", { files });
      return {};
    }

    logger.debug("Loading env files:", { files });
    const merged: Record<string, string> = {};

    for (const file of files) {
      if (!existsSync(file)) {
        logger.debug(`Env file does not exist: ${file}`);
        continue;
      }
      const ext = path.extname(file).toLowerCase();
      const base = path.basename(file);

      try {
        const content = readFileSync(file, "utf8");

        // Check if it's a YAML file with special envs array structure
        if (ext === ".yaml" || ext === ".yml") {
          const data = parse(content) as RawEnvFile | undefined;
          const envs = Array.isArray(data?.envs) ? data?.envs : [];
          for (const kv of envs) Object.assign(merged, kv);
        } else {
          // Default: treat all other files as dotenv format (KEY=value pairs with expansion)
          const parsed = dotenvParse(content);
          logger.debug(`Parsed env file ${file}:`, { data: parsed });
          // Merge previous values with new parsed values, with parsed taking precedence
          // This allows variable expansion to reference previously loaded vars
          const combined = { ...merged, ...parsed };
          const expanded = expand({ parsed: combined, processEnv: {} });
          Object.assign(merged, expanded.parsed);
        }
      } catch (e) {
        logger.debug(`Failed to read env file ${file}: ${e}`);
      }
    }
    return merged;
  }

  private static pickDefaultEnvFiles(
    envFiles?: ZapperConfig["env_files"],
  ): string[] | undefined {
    if (!envFiles) return undefined;
    if (Array.isArray(envFiles)) return envFiles;
    return envFiles.default;
  }

  static getProcessEnv(
    processName: string,
    resolvedConfig: ZapperConfig,
  ): Record<string, string> {
    const proc = resolvedConfig.native?.[processName];
    if (!proc) throw new Error(`Process ${processName} not found`);
    return (proc.resolvedEnv as Record<string, string>) || {};
  }

  static getProcessEnvFromContext(
    processName: string,
    context: Context,
  ): Record<string, string> {
    const proc = context.processes.find((p) => p.name === processName);
    if (!proc) throw new Error(`Process ${processName} not found`);
    return proc.resolvedEnv || {};
  }
}
