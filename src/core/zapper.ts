import { parseYamlFile } from "../config/yamlParser";
import { EnvResolver } from "../config/EnvResolver";
import { Pm2Executor } from "./process/Pm2Executor";
import { ZapperConfig, Process, Container } from "../config/schemas";
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
  private config: ZapperConfig | null = null;
  private configDir: string | null = null;
  constructor() {}

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      const resolvedPath = resolveConfigPath(configPath) ?? configPath;
      this.configDir = path.dirname(path.resolve(resolvedPath));
      this.config = parseYamlFile(resolvedPath);

      if (this.config.env_files && this.config.env_files.length > 0) {
        this.config.env_files = this.config.env_files.map((p) =>
          path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
        );
      }

      this.config = EnvResolver.resolve(this.config);
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  getProject(): string | null {
    return this.config?.project ?? null;
  }

  getConfigDir(): string | null {
    return this.configDir;
  }

  private getProcesses(): Process[] {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    if (
      this.config.bare_metal &&
      Object.keys(this.config.bare_metal).length > 0
    ) {
      return Object.entries(this.config.bare_metal).map(([name, process]) => ({
        ...process,
        name: process.name || name,
      }));
    }

    if (this.config.processes && this.config.processes.length > 0) {
      return this.config.processes;
    }

    return [];
  }

  private getContainers(): Array<[string, Container]> {
    if (!this.config) throw new Error("Config not loaded");
    const dockerServices = this.config.docker || this.config.containers;
    if (!dockerServices) return [];
    return Object.entries(dockerServices).map(([name, c]) => [name, c]);
  }

  private resolveAliasesToCanonical(names?: string[]): string[] | undefined {
    if (!names || !this.config) return names;
    const aliasToName = new Map<string, string>();
    const processes = this.getProcesses();

    for (const p of processes) {
      aliasToName.set(p.name as string, p.name as string);
      if (Array.isArray(p.aliases)) {
        for (const a of p.aliases) aliasToName.set(a, p.name as string);
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

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (allProcesses.length === 0 && allContainers.length === 0) {
      throw new Error("No processes defined in config");
    }

    const planner = new Planner(this.config);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("start", canonical, this.config.project);

    if (canonical && plan.actions.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    await executeActions(
      this.config,
      this.config.project,
      this.configDir,
      plan,
    );
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const planner = new Planner(this.config);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("stop", canonical, this.config.project);

    if (canonical && plan.actions.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    await executeActions(
      this.config,
      this.config.project,
      this.configDir,
      plan,
    );
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");
    const planner = new Planner(this.config);
    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("restart", canonical, this.config.project);

    await executeActions(
      this.config,
      this.config.project,
      this.configDir,
      plan,
    );
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    const projectName = this.config?.project || "default";
    const configDir = this.configDir || ".";
    const pm2Executor = new Pm2Executor(projectName, configDir);

    const name = this.config
      ? this.resolveServiceName(processName)
      : processName;

    await pm2Executor.showLogs(name, follow);
  }

  async reset(force = false): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

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
    const zapDir = path.join(this.configDir!, ".zap");

    if (fs.existsSync(zapDir)) {
      fs.rmSync(zapDir, { recursive: true, force: true });
      logger.info("Removed .zap directory.");
    } else {
      logger.info(".zap directory does not exist.");
    }
  }

  async cloneRepos(processNames?: string[]): Promise<void> {
    if (!this.config || !this.configDir) throw new Error("Config not loaded");
    await cloneRepositories(this.config, this.configDir, processNames);
  }

  async runTask(taskName: string): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    if (!this.config.tasks || Object.keys(this.config.tasks).length === 0) {
      throw new Error("No tasks defined in config");
    }

    const tasks = this.config.tasks;
    const baseCwd = this.configDir || process.cwd();

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
    return getBareMetalTargets(this.config, this.configDir);
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
