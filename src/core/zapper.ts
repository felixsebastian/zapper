import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { SequentialStrategy } from "./strategies/sequential-strategy";
import { PlanExecutor } from "../core/plan-executor";
import { Pm2Executor } from "../process/pm2-executor";
import { ZapperConfig, Process, Container, ContainerVolume } from "../types";
import path from "path";
import { logger } from "../utils/logger";
import * as fs from "fs";
import { execSync } from "child_process";
import { resolveConfigPath } from "../utils/find-up";
import { DockerManager } from "../containers";

export class Zapper {
  private config: ZapperConfig | null = null;
  private planExecutor: PlanExecutor | null = null;
  private configDir: string | null = null;

  constructor() {}

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      const resolvedPath = resolveConfigPath(configPath) ?? configPath;
      this.configDir = path.dirname(path.resolve(resolvedPath));
      this.config = YamlParser.parse(resolvedPath);

      // Normalize env_files to absolute paths relative to the config file directory
      if (this.config.env_files && this.config.env_files.length > 0) {
        this.config.env_files = this.config.env_files.map((p) =>
          path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
        );
      }

      // Normalize per-process env_files
      if (this.config.bare_metal) {
        for (const [name, proc] of Object.entries(this.config.bare_metal)) {
          if (!proc.name) proc.name = name;
          if (proc.env_files && proc.env_files.length > 0) {
            proc.env_files = proc.env_files.map((p) =>
              path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
            );
          }
        }
      }
      if (this.config.processes && this.config.processes.length > 0) {
        for (const proc of this.config.processes) {
          if (proc.env_files && proc.env_files.length > 0) {
            proc.env_files = proc.env_files.map((p) =>
              path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
            );
          }
        }
      }

      // Normalize per-task env_files
      if (this.config.tasks) {
        for (const [name, task] of Object.entries(this.config.tasks)) {
          if (!task.name) task.name = name;
          if (task.env_files && task.env_files.length > 0) {
            task.env_files = task.env_files.map((p) =>
              path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
            );
          }
        }
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

  getProject(): string | null {
    return this.config?.project ?? null;
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

  private getContainers(): Array<[string, Container]> {
    if (!this.config) throw new Error("Config not loaded");
    if (!this.config.containers) return [];
    return Object.entries(this.config.containers).map(([name, c]) => [name, c]);
  }

  private resolveAliasesToCanonical(names?: string[]): string[] | undefined {
    if (!names || !this.config) return names;
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

  async startProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();
    if (allProcesses.length === 0 && allContainers.length === 0) {
      throw new Error("No processes defined in config");
    }

    const canonical = this.resolveAliasesToCanonical(processNames);

    const processesToStart = canonical
      ? allProcesses.filter((p) => canonical.includes(p.name))
      : allProcesses;
    const containersToStart = canonical
      ? allContainers.filter(([name]) => canonical.includes(name))
      : allContainers;

    if (
      canonical &&
      processesToStart.length === 0 &&
      containersToStart.length === 0
    ) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    if (processesToStart.length > 0) {
      const plan = this.planExecutor!.createPlan(processesToStart);
      await this.planExecutor!.executePlan(plan, "start", this.config.project);
    }

    // Start containers
    for (const [name, c] of containersToStart) {
      const containerName = `${this.config.project}-${name}`;

      const toVolumeBinding = (v: ContainerVolume): string =>
        typeof v === "string" ? v : `${v.name}:${v.internal_dir}`;

      const envMap = c.resolvedEnv || {};

      await DockerManager.startContainer(containerName, {
        image: c.image,
        ports: c.ports,
        volumes: Array.isArray(c.volumes)
          ? (c.volumes as ContainerVolume[]).map(toVolumeBinding)
          : undefined,
        networks: c.networks,
        environment: envMap,
        command: c.command,
      });
      logger.info(`Started container ${containerName}`);
    }
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    const canonical = this.resolveAliasesToCanonical(processNames);

    const processesToStop = canonical
      ? allProcesses.filter((p) => canonical.includes(p.name))
      : allProcesses;
    const containersToStop = canonical
      ? allContainers.filter(([name]) => canonical.includes(name))
      : allContainers;

    if (processesToStop.length > 0) {
      const plan = this.planExecutor!.createPlan(processesToStop);
      await this.planExecutor!.executePlan(plan, "stop");
    }

    for (const [name] of containersToStop) {
      const containerName = `${this.config!.project}-${name}`;
      try {
        await DockerManager.stopContainer(containerName);
        logger.info(`Stopped container ${containerName}`);
      } catch (e) {
        logger.warn(`Failed to stop container ${containerName}: ${e}`);
      }
    }
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const canonical = this.resolveAliasesToCanonical(processNames);
    const allProcesses = this.getProcesses();

    const processesToRestart = canonical
      ? allProcesses.filter((p) => canonical.includes(p.name))
      : allProcesses;
    if (processesToRestart.length === 0) {
      throw new Error("No processes to restart");
    }

    const plan = this.planExecutor!.createPlan(processesToRestart);
    await this.planExecutor!.executePlan(plan, "restart");
  }

  async showLogs(processName?: string, follow: boolean = false): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();

    if (!processName && allProcesses.length + allContainers.length > 1) {
      throw new Error(
        "Multiple services defined. Please specify a service name to show logs for",
      );
    }

    const target = processName
      ? this.resolveServiceName(processName)
      : processName;

    if (target) {
      // Try processes first
      const p = allProcesses.find((x) => x.name === target);
      if (p) {
        const pm2 = new Pm2Executor(this.config.project, this.configDir || ".");
        await pm2.showLogs(p.name, follow);
        return;
      }
      // Containers: not supported via PM2; fall back to docker logs by name
      const c = allContainers.find(([name]) => name === target);
      if (c) {
        logger.info(
          "Log streaming for containers is not implemented yet. Use docker logs",
        );
        return;
      }

      throw new Error(`Service not found: ${target}`);
    }

    // Single process scenario
    if (allProcesses.length === 1) {
      const pm2 = new Pm2Executor(this.config.project, this.configDir || ".");
      await pm2.showLogs(allProcesses[0].name, follow);
      return;
    }

    throw new Error("No services defined");
  }

  async reset(): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    // Stop all processes and containers best-effort
    try {
      await this.stopProcesses();
    } catch (e) {
      logger.warn(`Failed to stop some services: ${e}`);
    }

    // Remove PM2 logs folder
    const logsDir = path.join(this.configDir as string, ".zap", "logs");
    try {
      if (fs.existsSync(logsDir))
        fs.rmSync(logsDir, { recursive: true, force: true });
    } catch (e) {
      logger.warn(`Failed to remove logs dir: ${e}`);
    }

    logger.info("Reset complete");
  }

  async cloneRepos(processNames?: string[]): Promise<void> {
    if (!this.config || !this.configDir) throw new Error("Config not loaded");

    const method = this.config.git_method || "ssh";

    const allBareMetal = this.config.bare_metal
      ? Object.entries(this.config.bare_metal).map(([name, p]) => ({
          ...p,
          name: p.name || name,
        }))
      : [];

    const canonical = this.resolveAliasesToCanonical(processNames);
    const targets = canonical
      ? allBareMetal.filter((p) => canonical.includes(p.name))
      : allBareMetal;

    if (targets.length === 0) {
      logger.info("No bare_metal services to clone");
      return;
    }

    for (const svc of targets) {
      if (!svc.repo) {
        logger.debug(`Skipping ${svc.name}: no repo field`);
        continue;
      }

      const destDir = (() => {
        const cwd = svc.cwd && svc.cwd.trim().length > 0 ? svc.cwd : svc.name;
        return path.isAbsolute(cwd)
          ? cwd
          : path.join(this.configDir as string, cwd);
      })();

      const repoSpec = svc.repo;

      const ensureDir = (dir: string) => {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      };

      const isGitRepo = (dir: string) => fs.existsSync(path.join(dir, ".git"));
      const isEmptyDir = (dir: string) => {
        try {
          const files = fs.readdirSync(dir);
          return files.length === 0;
        } catch {
          return true;
        }
      };

      const toSshUrl = (spec: string) => {
        if (spec.startsWith("git@") || spec.startsWith("ssh://")) return spec;
        if (spec.startsWith("http://") || spec.startsWith("https://"))
          return spec; // assume provided URL desired as-is
        return `git@github.com:${spec}.git`;
      };

      const toHttpUrl = (spec: string) => {
        if (spec.startsWith("http://") || spec.startsWith("https://"))
          return spec;
        if (spec.startsWith("git@"))
          return `https://github.com/${spec.split(":")[1]?.replace(/\.git$/, "")}.git`;
        return `https://github.com/${spec}.git`;
      };

      const cloneWithGit = (url: string, dir: string) => {
        const parent = path.dirname(dir);
        ensureDir(parent);
        const folderName = path.basename(dir);
        const parentIsRepo = isGitRepo(dir);

        if (!fs.existsSync(dir) || isEmptyDir(dir)) {
          logger.info(`Cloning ${svc.name} -> ${dir}`);
          execSync(`git clone ${url} ${folderName}`, {
            cwd: parent,
            stdio: "inherit",
          });
        } else if (parentIsRepo || isGitRepo(dir)) {
          logger.info(`Pulling ${svc.name} in ${dir}`);
          execSync(`git -C ${dir} pull --ff-only`, { stdio: "inherit" });
        } else {
          logger.warn(
            `Destination ${dir} exists and is not empty. Skipping ${svc.name}.`,
          );
        }
      };

      const cloneWithGh = (spec: string, dir: string) => {
        const parent = path.dirname(dir);
        ensureDir(parent);
        const target = dir;
        if (!fs.existsSync(dir) || isEmptyDir(dir)) {
          logger.info(`Cloning (gh) ${svc.name} -> ${target}`);
          execSync(`gh repo clone ${spec} ${target}`, { stdio: "inherit" });
        } else if (isGitRepo(dir)) {
          logger.info(`Pulling ${svc.name} in ${dir}`);
          execSync(`git -C ${dir} pull --ff-only`, { stdio: "inherit" });
        } else {
          logger.warn(
            `Destination ${dir} exists and is not empty. Skipping ${svc.name}.`,
          );
        }
      };

      try {
        if (method === "cli") cloneWithGh(repoSpec, destDir);
        else if (method === "http") cloneWithGit(toHttpUrl(repoSpec), destDir);
        else cloneWithGit(toSshUrl(repoSpec), destDir);
      } catch (e) {
        logger.warn(`Failed to clone ${svc.name}: ${e}`);
      }
    }
  }

  async runTask(taskName: string): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");
    if (!this.config.tasks || Object.keys(this.config.tasks).length === 0)
      throw new Error("No tasks defined in config");

    const tasks = this.config.tasks;
    const baseCwd = this.configDir || process.cwd();

    const resolveCwd = (tCwd?: string) => {
      if (!tCwd || tCwd.trim().length === 0) return baseCwd;
      return path.isAbsolute(tCwd) ? tCwd : path.join(baseCwd, tCwd);
    };

    const execTask = (name: string, stack: string[] = []) => {
      if (!tasks[name]) throw new Error(`Task not found: ${name}`);
      if (stack.includes(name))
        throw new Error(
          `Circular task reference detected: ${[...stack, name].join(" -> ")}`,
        );

      const t = tasks[name];
      const env = {
        ...process.env,
        ...(t.resolvedEnv || {}),
      } as NodeJS.ProcessEnv;
      const cwd = resolveCwd(t.cwd);

      logger.info(`Running task: ${name}${t.desc ? ` — ${t.desc}` : ""}`);
      for (const cmd of t.cmds) {
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
}
