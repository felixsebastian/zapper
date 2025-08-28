import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { Pm2Executor } from "../process/pm2-executor";
import { ZapperConfig, Process, Container } from "../types";
import path from "path";
import { logger } from "../utils/logger";
import * as fs from "fs";
import { execSync } from "child_process";
import { resolveConfigPath } from "../utils/find-up";
import { Planner } from "./planner";
import { ActionExecutor } from "./action-executor";

export class Zapper {
  private config: ZapperConfig | null = null;
  private configDir: string | null = null;

  constructor() {}

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      const resolvedPath = resolveConfigPath(configPath) ?? configPath;
      this.configDir = path.dirname(path.resolve(resolvedPath));
      this.config = YamlParser.parse(resolvedPath);

      if (this.config.env_files && this.config.env_files.length > 0) {
        this.config.env_files = this.config.env_files.map((p) =>
          path.isAbsolute(p) ? p : path.join(this.configDir as string, p),
        );
      }

      ConfigValidator.validate(this.config);
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
    if (!this.config) throw new Error("Config not loaded");

    const allProcesses = this.getProcesses();
    const allContainers = this.getContainers();
    if (allProcesses.length === 0 && allContainers.length === 0)
      throw new Error("No processes defined in config");

    const planner = new Planner(this.config);
    const executor = new ActionExecutor(
      this.config.project,
      this.configDir,
      this.config,
    );

    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("start", canonical, this.config.project);
    if (canonical && plan.actions.length === 0)
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );

    await executor.execute(plan);
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const planner = new Planner(this.config);
    const executor = new ActionExecutor(
      this.config.project,
      this.configDir,
      this.config,
    );

    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("stop", canonical, this.config.project);
    if (canonical && plan.actions.length === 0)
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );

    await executor.execute(plan);
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) throw new Error("Config not loaded");

    const planner = new Planner(this.config);
    const executor = new ActionExecutor(
      this.config.project,
      this.configDir,
      this.config,
    );

    const canonical = this.resolveAliasesToCanonical(processNames);
    const plan = await planner.plan("restart", canonical, this.config.project);

    await executor.execute(plan);
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
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const proceed = force
      ? true
      : await new Promise<boolean>((resolve) => {
          process.stdout.write(
            "This will stop all processes and remove the .zap directory. Continue? (y/N) ",
          );
          process.stdin.resume();
          process.stdin.setEncoding("utf8");
          process.stdin.once("data", (data: string) => {
            const answer = data.trim().toLowerCase();
            resolve(answer === "y" || answer === "yes");
          });
        });

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

  // Git utilities for bare_metal repos
  private getBareMetalTargets(): Array<{ name: string; cwd: string }> {
    if (!this.config || !this.configDir) return [];
    const entries = this.config.bare_metal
      ? Object.entries(this.config.bare_metal)
      : [];
    return entries
      .filter(([, p]) => !!p.repo)
      .map(([name, p]) => {
        const cwd = p.cwd && p.cwd.trim().length > 0 ? p.cwd : name;
        const resolved = path.isAbsolute(cwd)
          ? cwd
          : path.join(this.configDir as string, cwd);
        return { name, cwd: resolved };
      });
  }

  private isGitRepo(dir: string): boolean {
    try {
      return fs.existsSync(path.join(dir, ".git"));
    } catch {
      return false;
    }
  }

  async gitCheckoutAll(branch: string): Promise<void> {
    const targets = this.getBareMetalTargets();
    for (const t of targets) {
      if (!this.isGitRepo(t.cwd)) continue;
      try {
        const status = execSync("git status --porcelain", { cwd: t.cwd })
          .toString()
          .trim();
        if (status.length > 0) {
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          execSync(`git add -A`, { cwd: t.cwd, stdio: "inherit" });
          execSync(`git commit -m "[WIP] ${ts}"`, {
            cwd: t.cwd,
            stdio: "inherit",
          });
        }
        execSync(`git fetch --all`, { cwd: t.cwd, stdio: "inherit" });
        execSync(`git checkout ${branch}`, { cwd: t.cwd, stdio: "inherit" });
      } catch (e) {
        logger.warn(`Failed to checkout in ${t.name}: ${e}`);
      }
    }
  }

  async gitPullAll(): Promise<void> {
    const targets = this.getBareMetalTargets();
    for (const t of targets) {
      if (!this.isGitRepo(t.cwd)) continue;
      try {
        execSync(`git pull --ff-only`, { cwd: t.cwd, stdio: "inherit" });
      } catch (e) {
        logger.warn(`Failed to pull in ${t.name}: ${e}`);
      }
    }
  }

  async gitStatusAll(): Promise<void> {
    const targets = this.getBareMetalTargets();
    for (const t of targets) {
      if (!this.isGitRepo(t.cwd)) continue;
      try {
        const branch = execSync(`git rev-parse --abbrev-ref HEAD`, {
          cwd: t.cwd,
        })
          .toString()
          .trim();
        const dirty =
          execSync(`git status --porcelain`, { cwd: t.cwd }).toString().trim()
            .length > 0;
        logger.info(`${t.name}: ${branch}  ${dirty ? "dirty" : "clean"}`);
      } catch (e) {
        logger.warn(`Failed to get status in ${t.name}: ${e}`);
      }
    }
  }
}
