import { execSync } from "child_process";
import { logger } from "../../utils/logger";
import * as fs from "fs";
import * as path from "path";

export interface GitTarget {
  name: string;
  cwd: string;
}

export class GitManager {
  static isGitRepo(dir: string): boolean {
    try {
      return fs.existsSync(path.join(dir, ".git"));
    } catch {
      return false;
    }
  }

  static async checkoutAll(
    targets: GitTarget[],
    branch: string,
  ): Promise<void> {
    const failed: string[] = [];

    for (const target of targets) {
      if (!this.isGitRepo(target.cwd)) continue;

      try {
        const status = execSync("git status --porcelain", { cwd: target.cwd })
          .toString()
          .trim();

        if (status.length > 0) {
          const ts = new Date().toISOString().replace(/[:.]/g, "-");
          execSync(`git add -A`, { cwd: target.cwd, stdio: "inherit" });

          execSync(`git commit -m "[WIP] ${ts}"`, {
            cwd: target.cwd,
            stdio: "inherit",
          });
        }

        execSync(`git fetch --all`, { cwd: target.cwd, stdio: "inherit" });

        execSync(`git checkout ${branch}`, {
          cwd: target.cwd,
          stdio: "inherit",
        });
      } catch (e) {
        logger.warn(`Failed to checkout in ${target.name}: ${e}`);
        failed.push(target.name);
      }
    }

    if (failed.length > 0) {
      logger.warn(`Failed for repos: ${failed.join(", ")}`);
    }
  }

  static async pullAll(targets: GitTarget[]): Promise<void> {
    const failed: string[] = [];

    for (const target of targets) {
      if (!this.isGitRepo(target.cwd)) continue;

      try {
        execSync(`git pull --ff-only`, { cwd: target.cwd, stdio: "inherit" });
      } catch (e) {
        logger.warn(`Failed to pull in ${target.name}: ${e}`);
        failed.push(target.name);
      }
    }

    if (failed.length > 0) {
      logger.warn(`Failed for repos: ${failed.join(", ")}`);
    }
  }

  static async statusAll(targets: GitTarget[]): Promise<void> {
    for (const target of targets) {
      if (!this.isGitRepo(target.cwd)) continue;

      try {
        const branch = execSync(`git rev-parse --abbrev-ref HEAD`, {
          cwd: target.cwd,
        })
          .toString()
          .trim();

        const dirty =
          execSync(`git status --porcelain`, { cwd: target.cwd })
            .toString()
            .trim().length > 0;

        logger.info(`${target.name}: ${branch}  ${dirty ? "dirty" : "clean"}`);
      } catch (e) {
        logger.warn(`Failed to get status in ${target.name}: ${e}`);
      }
    }
  }

  static async stashAll(targets: GitTarget[]): Promise<void> {
    const failed: string[] = [];

    for (const target of targets) {
      if (!this.isGitRepo(target.cwd)) continue;

      try {
        const status = execSync("git status --porcelain", { cwd: target.cwd })
          .toString()
          .trim();

        if (status.length > 0) {
          execSync(`git stash`, { cwd: target.cwd, stdio: "inherit" });
          logger.info(`Stashed changes in ${target.name}`);
        } else {
          logger.debug(`No changes to stash in ${target.name}`);
        }
      } catch (e) {
        logger.warn(`Failed to stash in ${target.name}: ${e}`);
        failed.push(target.name);
      }
    }

    if (failed.length > 0) {
      logger.warn(`Failed for repos: ${failed.join(", ")}`);
    }
  }
}
