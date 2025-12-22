/* eslint-disable @typescript-eslint/no-explicit-any */
import { parseYamlFile } from "../config/yamlParser";
import { EnvResolver } from "../config/EnvResolver";
import { Pm2Executor } from "./process/Pm2Executor";
import { DockerManager } from "./docker";
import { ZapperConfig } from "../config/schemas";
import { Context, Process, Container } from "../types/Context";
import { createContext } from "./createContext";
import path from "path";
import { logger } from "../utils/logger";
import * as fs from "fs";
import { resolveConfigPath } from "../utils/findUp";
import { Planner } from "./Planner";
import { executeActions } from "./executeActions";
import { confirm } from "../utils/confirm";
import { GitManager, cloneRepos as cloneRepositories } from "./git";
import { getNativeTargets } from "../utils";
import {
  ContextNotLoadedError,
  ServiceNotFoundError,
  ContainerNotRunningError,
} from "../errors";

export class Zapper {
  private context: Context | null = null;
  constructor() {}

  async loadConfig(
    configPath: string = "zap.yaml",
    cliOptions?: Record<string, any>,
  ): Promise<void> {
    const resolvedPath = resolveConfigPath(configPath) ?? configPath;
    const projectRoot = path.dirname(path.resolve(resolvedPath));
    const config = parseYamlFile(resolvedPath);

    // Apply CLI overrides to config
    const configWithOverrides = this.applyCliOverrides(config, cliOptions);

    // Create context from config
    this.context = createContext(configWithOverrides, projectRoot);

    // Resolve environment variables with proper path resolution
    this.context = EnvResolver.resolveContext(this.context);
  }

  private applyCliOverrides(
    config: ZapperConfig,
    cliOptions?: Record<string, any>,
  ): ZapperConfig {
    if (!cliOptions) return config;

    const configWithOverrides = { ...config };

    // Handle git method CLI overrides
    if (cliOptions.http && cliOptions.ssh) {
      throw new Error("Cannot specify both --http and --ssh options");
    }
    if (cliOptions.http) {
      configWithOverrides.git_method = "http";
    } else if (cliOptions.ssh) {
      configWithOverrides.git_method = "ssh";
    }

    return configWithOverrides;
  }

  getProject(): string | null {
    return this.context?.projectName ?? null;
  }

  getProjectRoot(): string | null {
    return this.context?.projectRoot ?? null;
  }

  getContext(): Context | null {
    return this.context;
  }

  private getProcesses(): Process[] {
    if (!this.context) {
      throw new ContextNotLoadedError();
    }
    return this.context.processes;
  }

  private getContainers(): Array<[string, Container]> {
    if (!this.context) throw new ContextNotLoadedError();
    return this.context.containers.map((c) => [c.name, c]);
  }

  private resolveAliasesToCanonical(names?: string[]): string[] | undefined {
    if (!names || !this.context) return names;
    const aliasToName = new Map<string, string>();
    const processes = this.getProcesses();

    for (const p of processes) {
      aliasToName.set(p.name, p.name);
      if (Array.isArray(p.aliases)) {
        for (const a of p.aliases) aliasToName.set(a, p.name);
      }
    }

    const containers = this.getContainers();

    for (const [name, c] of containers) {
      aliasToName.set(name, name);
      if (Array.isArray(c.aliases))
        for (const a of c.aliases) aliasToName.set(a, name);
    }

    return names.map((n) => aliasToName.get(n) || n);
  }

  resolveServiceName(name: string): string {
    const resolved = this.resolveAliasesToCanonical([name]);
    return resolved && resolved.length > 0 ? resolved[0] : name;
  }

  private buildTaskAliasMap(): Record<string, string> {
    if (!this.context || !this.context.tasks) return {};

    const aliasToName = new Map<string, string>();

    for (const task of this.context.tasks) {
      aliasToName.set(task.name, task.name);
      if (Array.isArray(task.aliases)) {
        for (const alias of task.aliases) {
          aliasToName.set(alias, task.name);
        }
      }
    }

    return Object.fromEntries(aliasToName);
  }

  // Helper method to create a legacy config for backwards compatibility
  // TODO: Remove this once all components are updated to use Context
  private createLegacyConfig(): ZapperConfig {
    if (!this.context) throw new ContextNotLoadedError();

    // Convert processes to native format
    const native: Record<string, any> = {};
    for (const process of this.context.processes) {
      native[process.name] = {
        ...process,
        name: process.name, // Keep the name field for compatibility
      };
    }

    // Convert containers back to docker format
    const docker: Record<string, any> = {};
    for (const container of this.context.containers) {
      docker[container.name] = {
        ...container,
        name: container.name, // Keep the name field for compatibility
      };
    }

    // Convert tasks back to tasks format
    const tasks: Record<string, any> = {};
    for (const task of this.context.tasks) {
      tasks[task.name] = {
        ...task,
        name: task.name, // Keep the name field for compatibility
      };
    }

    return {
      project: this.context.projectName,
      env_files: this.context.envFiles,
      git_method: this.context.gitMethod,
      native,
      docker,
      tasks,
    };
  }

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (allProcesses.length === 0 && allContainers.length === 0) {
      throw new ServiceNotFoundError("any", "No processes defined in config");
    }

    // TODO: Update Planner to work with Context
    // For now, we'll need a temporary legacy config for backwards compatibility
    const legacyConfig = this.createLegacyConfig();
    const planner = new Planner(legacyConfig);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan(
      "start",
      canonical,
      this.context.projectName,
      false,
      this.context.state.activeProfile,
    );

    const hasActions = plan.waves.some((w) => w.actions.length > 0);
    if (canonical && !hasActions) {
      throw new ServiceNotFoundError(processNames?.join(", ") || "unknown");
    }

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();

    const legacyConfig = this.createLegacyConfig();
    const planner = new Planner(legacyConfig);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan(
      "stop",
      canonical,
      this.context.projectName,
      false,
      this.context.state.activeProfile,
    );

    const hasActions = plan.waves.some((w) => w.actions.length > 0);
    if (canonical && !hasActions) {
      throw new ServiceNotFoundError(processNames?.join(", ") || "unknown");
    }

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();
    const legacyConfig = this.createLegacyConfig();
    const planner = new Planner(legacyConfig);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan(
      "restart",
      canonical,
      this.context.projectName,
      false,
      this.context.state.activeProfile,
    );

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();

    const projectName = this.context.projectName;
    const projectRoot = this.context.projectRoot;
    const resolvedName = this.resolveServiceName(processName);

    const isContainer = this.context.containers.some(
      (c) => c.name === resolvedName,
    );
    const isProcess = this.context.processes.some(
      (p) => p.name === resolvedName,
    );

    if (isContainer) {
      const dockerName = `zap.${projectName}.${resolvedName}`;
      const exists = await DockerManager.containerExists(dockerName);
      if (!exists) throw new ContainerNotRunningError(resolvedName, dockerName);
      await DockerManager.showLogs(dockerName, follow);
    } else if (isProcess) {
      const pm2Executor = new Pm2Executor(projectName, projectRoot);
      await pm2Executor.showLogs(resolvedName, follow);
    } else {
      throw new ServiceNotFoundError(processName);
    }
  }

  async reset(force = false): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();

    const proceed = force
      ? true
      : await confirm(
          "This will stop all processes and remove the .zap directory. Continue?",
        );

    if (!proceed) {
      logger.info("Aborted.");
      return;
    }

    await this.stopProcesses();
    const zapDir = path.join(this.context.projectRoot, ".zap");

    if (fs.existsSync(zapDir)) {
      fs.rmSync(zapDir, { recursive: true, force: true });
      logger.info("Removed .zap directory.");
    } else {
      logger.info(".zap directory does not exist.");
    }
  }

  async cloneRepos(processNames?: string[]): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();
    const legacyConfig = this.createLegacyConfig();
    await cloneRepositories(
      legacyConfig,
      this.context.projectRoot,
      processNames,
    );
  }

  async runTask(
    taskName: string,
    params?: { named: Record<string, string>; rest: string[] },
  ): Promise<void> {
    if (!this.context) throw new ContextNotLoadedError();

    if (!this.context.tasks || this.context.tasks.length === 0) {
      throw new ServiceNotFoundError(taskName, "No tasks defined in config");
    }

    // Build task alias map for resolution
    const taskAliasMap = this.buildTaskAliasMap();
    const resolvedTaskName = taskAliasMap[taskName];

    if (!resolvedTaskName) {
      throw new ServiceNotFoundError(taskName);
    }

    // Convert tasks array back to object format for TaskRunner
    const tasks: Record<string, any> = {};
    for (const task of this.context.tasks) {
      tasks[task.name] = task;
    }

    // Use TaskRunner for execution with interpolation support
    const { TaskRunner } = await import("./tasks/TaskRunner");
    TaskRunner.runTask(tasks, this.context.projectRoot, resolvedTaskName, {
      delimiters: this.context.taskDelimiters,
      params,
    });
  }

  private getNativeTargets(): Array<{ name: string; cwd: string }> {
    const legacyConfig = this.createLegacyConfig();
    return getNativeTargets(legacyConfig, this.context?.projectRoot || null);
  }

  async gitCheckoutAll(branch: string): Promise<void> {
    const targets = this.getNativeTargets();
    await GitManager.checkoutAll(targets, branch);
  }

  async gitPullAll(): Promise<void> {
    const targets = this.getNativeTargets();
    await GitManager.pullAll(targets);
  }

  async gitStatusAll(): Promise<void> {
    const targets = this.getNativeTargets();
    await GitManager.statusAll(targets);
  }
}
