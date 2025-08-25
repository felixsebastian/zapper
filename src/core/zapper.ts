import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { SequentialStrategy } from "./strategies/sequential-strategy";
import { PlanExecutor } from "./plan-executor";
import { Pm2Executor } from "../process/pm2-executor";
import { ZapperConfig, Process } from "../types";
import path from "path";
import { logger } from "../utils/logger";
import * as fs from "fs";
import { execSync } from "child_process";
import { resolveConfigPath } from "../utils/find-up";

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
    if (allProcesses.length === 0) {
      throw new Error("No processes defined in config");
    }

    const canonical = this.resolveAliasesToCanonical(processNames);

    const processesToStart = canonical
      ? allProcesses.filter((p) => canonical.includes(p.name))
      : allProcesses;

    if (canonical && processesToStart.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    const mergedYamlEnvs = EnvResolver.getMergedEnvFromFiles(this.config);
    logger.debug("merged yaml envs:", mergedYamlEnvs);

    for (const p of processesToStart) {
      const whitelist = Array.isArray(p.env) ? p.env : [];
      const whitelistWithValues = Object.fromEntries(
        whitelist.map((k) => [k, mergedYamlEnvs[k] ?? "(missing)"]),
      );
      logger.debug(
        `process ${p.name} whitelist (with values):`,
        whitelistWithValues,
      );
      logger.debug(`process ${p.name} resolved env:`, p.resolvedEnv || {});
    }

    const plan = this.planExecutor!.createPlan(processesToStart);
    await this.planExecutor!.executePlan(plan, "start", this.config.project);
  }

  async stopProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const canonical = this.resolveAliasesToCanonical(processNames);
    const processesToStop = canonical
      ? allProcesses.filter((p) => canonical.includes(p.name))
      : allProcesses;

    if (canonical && processesToStop.length === 0) {
      throw new Error(
        `Service not found: ${processNames?.join(", ")}. Check names or aliases`,
      );
    }

    const plan = this.planExecutor!.createPlan(processesToStop);
    await this.planExecutor!.executePlan(plan, "stop");
  }

  async restartProcesses(processNames?: string[]): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const canonical = this.resolveAliasesToCanonical(processNames);
    await this.stopProcesses(canonical);
    await this.startProcesses(canonical);
  }

  async getProcessStatus(processName?: string): Promise<Process[]> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const allProcesses = this.getProcesses();
    const target = processName
      ? this.resolveServiceName(processName)
      : undefined;
    const processesToCheck = target
      ? allProcesses.filter((p) => p.name === target)
      : allProcesses;

    return processesToCheck;
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    // For logs, we don't need to check the config - we can show logs for any PM2 process
    // Use a default project name if config is not loaded
    const projectName = this.config?.project || "default";
    const configDir = this.configDir || ".";

    const pm2Executor = new Pm2Executor(projectName, configDir);

    // Try to resolve alias if config is available; otherwise pass-through
    const name = this.config
      ? this.resolveServiceName(processName)
      : processName;
    await pm2Executor.showLogs(name, follow);
  }

  async reset(): Promise<void> {
    if (!this.configDir) throw new Error("Config not loaded");

    // Stop all processes defined in config (best-effort)
    try {
      await this.stopProcesses();
    } catch (e) {
      logger.warn(`Failed to stop processes: ${e}`);
    }

    // Remove .zap directory
    const fs = await import("fs");
    const zapDir = path.join(this.configDir, ".zap");
    try {
      if (fs.existsSync(zapDir))
        fs.rmSync(zapDir, { recursive: true, force: true });
      logger.info(`Removed ${zapDir}`);
    } catch (e) {
      logger.warn(`Failed to remove ${zapDir}: ${e}`);
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
}
