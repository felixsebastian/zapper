import { parseYamlFile } from "../config/yamlParser";
import { EnvResolver } from "../config/EnvResolver";
import { Pm2Executor } from "./process/Pm2Executor";
import { ZapperConfig } from "../config/schemas";
import { Context, Process, Container } from "../types/Context";
import { createContext } from "./createContext";
import path from "path";
import { logger } from "../utils/logger";
import * as fs from "fs";
import { execSync } from "child_process";
import { resolveConfigPath } from "../utils/findUp";
import { Planner } from "./Planner";
import { executeActions } from "./executeActions";
import { confirm } from "../utils/confirm";
import { GitManager, cloneRepos as cloneRepositories } from "./git";
import { getBareMetalTargets } from "../utils";

export class Zapper {
  private context: Context | null = null;
  constructor() {}

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      const resolvedPath = resolveConfigPath(configPath) ?? configPath;
      const projectRoot = path.dirname(path.resolve(resolvedPath));
      const config = parseYamlFile(resolvedPath, projectRoot);

      // Create context from config
      this.context = createContext(config, projectRoot);

      // Resolve environment variables with proper path resolution
      this.context = EnvResolver.resolveContext(this.context);
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  getProject(): string | null {
    return this.context?.projectName ?? null;
  }

  getProjectRoot(): string | null {
    return this.context?.projectRoot ?? null;
  }

  private getProcesses(): Process[] {
    if (!this.context) {
      throw new Error("Context not loaded");
    }
    return this.context.processes;
  }

  private getContainers(): Array<[string, Container]> {
    if (!this.context) throw new Error("Context not loaded");
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

  // Helper method to create a legacy config for backwards compatibility
  // TODO: Remove this once all components are updated to use Context
  private createLegacyConfig(): ZapperConfig {
    if (!this.context) throw new Error("Context not loaded");

    // Convert processes back to bare_metal format
    const bare_metal: Record<string, any> = {};
    for (const process of this.context.processes) {
      bare_metal[process.name] = {
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
      bare_metal,
      docker,
      tasks,
    };
  }

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new Error("Context not loaded");

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (allProcesses.length === 0 && allContainers.length === 0) {
      throw new Error("No processes defined in config");
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
    );

    if (canonical && plan.actions.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new Error("Context not loaded");

    const legacyConfig = this.createLegacyConfig();
    const planner = new Planner(legacyConfig);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan(
      "stop",
      canonical,
      this.context.projectName,
    );

    if (canonical && plan.actions.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.context) throw new Error("Context not loaded");
    const legacyConfig = this.createLegacyConfig();
    const planner = new Planner(legacyConfig);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan(
      "restart",
      canonical,
      this.context.projectName,
    );

    await executeActions(
      legacyConfig,
      this.context.projectName,
      this.context.projectRoot,
      plan,
    );
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    const projectName = this.context?.projectName || "default";
    const projectRoot = this.context?.projectRoot || ".";
    const pm2Executor = new Pm2Executor(projectName, projectRoot);

    const name = this.context
      ? this.resolveServiceName(processName)
      : processName;

    await pm2Executor.showLogs(name, follow);
  }

  async reset(force = false): Promise<void> {
    if (!this.context) throw new Error("Context not loaded");

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
    if (!this.context) throw new Error("Context not loaded");
    const legacyConfig = this.createLegacyConfig();
    await cloneRepositories(
      legacyConfig,
      this.context.projectRoot,
      processNames,
    );
  }

  async runTask(taskName: string): Promise<void> {
    if (!this.context) throw new Error("Context not loaded");

    if (!this.context.tasks || this.context.tasks.length === 0) {
      throw new Error("No tasks defined in config");
    }

    // Convert tasks array back to object format for compatibility
    const tasks: Record<string, any> = {};
    for (const task of this.context.tasks) {
      tasks[task.name] = task;
    }

    const baseCwd = this.context.projectRoot;

    const resolveCwd = (tCwd?: string) => {
      if (!tCwd || tCwd.trim().length === 0) return baseCwd;
      return path.isAbsolute(tCwd) ? tCwd : path.join(baseCwd, tCwd);
    };

    const execTask = (name: string, stack: string[] = []) => {
      if (!tasks[name]) throw new Error(`Task not found: ${name}`);

      if (stack.includes(name)) {
        throw new Error(
          `Circular task reference detected: ${[...stack, name].join(" -> ")}`,
        );
      }

      const task = tasks[name];

      const env = {
        ...process.env,
        ...(task.resolvedEnv || {}),
      } as NodeJS.ProcessEnv;

      const cwd = resolveCwd(task.cwd);
      logger.info(`Running task: ${name}${task.desc ? ` — ${task.desc}` : ""}`);

      for (const cmd of task.cmds) {
        if (typeof cmd === "string") {
          logger.debug(`$ ${cmd}`);
          execSync(cmd, { stdio: "inherit", cwd, env });
        } else if (cmd && typeof cmd === "object" && "task" in cmd) {
          execTask(cmd.task, [...stack, name]);
        } else {
          throw new Error(`Invalid command in task ${name}`);
        }
      }
    };

    execTask(taskName);
  }

  private getBareMetalTargets(): Array<{ name: string; cwd: string }> {
    const legacyConfig = this.createLegacyConfig();
    return getBareMetalTargets(legacyConfig, this.context?.projectRoot || null);
  }

  async gitCheckoutAll(branch: string): Promise<void> {
    const targets = this.getBareMetalTargets();
    await GitManager.checkoutAll(targets, branch);
  }

  async gitPullAll(): Promise<void> {
    const targets = this.getBareMetalTargets();
    await GitManager.pullAll(targets);
  }

  async gitStatusAll(): Promise<void> {
    const targets = this.getBareMetalTargets();
    await GitManager.statusAll(targets);
  }
}
