import { spawn } from "child_process";
import {
  mkdirSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  existsSync,
} from "fs";
import path from "path";
import { Process } from "../../config/schemas";
import { ProcessInfo } from "../../types/index";
import { logger } from "../../utils/logger";

export class Pm2Manager {
  // Track wrapper scripts by process name for cleanup
  private static wrapperScripts = new Map<string, string>();

  static async startProcess(
    processConfig: Process,
    projectName: string,
  ): Promise<void> {
    // Always use ecosystem approach for consistency
    await this.startProcessWithTempEcosystem(
      projectName,
      processConfig,
      globalThis.process?.cwd(),
    );
  }

  static async startProcessWithTempEcosystem(
    projectName: string,
    processConfig: Process,
    configDir?: string,
  ): Promise<void> {
    if (!configDir) {
      throw new Error("Config directory is required for process management");
    }

    // Delete any existing processes with the same name to prevent duplicates
    await this.deleteAllMatchingProcesses(
      processConfig.name as string,
      projectName,
      configDir,
    );

    const zapDir = path.join(configDir, ".zap");
    const logsDir = path.join(zapDir, "logs");
    mkdirSync(logsDir, { recursive: true });

    // Create a minimal wrapper script for PM2 to execute
    const wrapperScript = this.createWrapperScript(
      projectName,
      processConfig,
      configDir,
    );

    logger.debug(
      `Creating ecosystem for ${processConfig.name as string} with env whitelist:`,
      processConfig.env,
    );

    logger.debug(
      `Final env for PM2 ecosystem:`,
      processConfig.resolvedEnv ?? {},
    );

    const ecosystem = {
      apps: [
        {
          name: `zap.${projectName}.${processConfig.name as string}`,
          script: wrapperScript,
          interpreter: "/bin/bash",
          cwd: (() => {
            if (!processConfig.cwd) return configDir;
            const resolved = path.isAbsolute(processConfig.cwd)
              ? processConfig.cwd
              : path.join(configDir, processConfig.cwd);
            if (!existsSync(resolved)) {
              logger.warn(
                `cwd path does not exist for ${processConfig.name as string}: ${resolved} (skipping)`,
              );
              return configDir;
            }
            return resolved;
          })(),
          env: { ...(process.env || {}), ...(processConfig.resolvedEnv || {}) },
          error_file: path.join(
            logsDir,
            `${projectName}.${processConfig.name as string}-error.log`,
          ),
          out_file: path.join(
            logsDir,
            `${projectName}.${processConfig.name as string}-out.log`,
          ),
          merge_logs: true,
        },
      ],
    } as Record<string, unknown>;

    const tempFile = path.join(
      zapDir,
      `${projectName}.${processConfig.name as string}.${Date.now()}.ecosystem.json`,
    );

    const ecosystemJson = JSON.stringify(ecosystem, null, 2);
    logger.debug(`Ecosystem JSON for ${processConfig.name as string}:`);
    logger.debug("─".repeat(50));
    logger.debug(ecosystemJson);
    logger.debug("─".repeat(50));

    writeFileSync(tempFile, ecosystemJson);

    try {
      await this.runPm2Command(["start", tempFile]);

      // Store wrapper script path for cleanup when stopping
      const processKey = `${projectName}.${processConfig.name as string}`;
      this.wrapperScripts.set(processKey, wrapperScript);
    } finally {
      try {
        unlinkSync(tempFile);
      } catch (e) {
        void e;
      }
    }
  }

  static async startProcessFromEcosystem(ecosystemPath: string): Promise<void> {
    const args = ["start", ecosystemPath];
    await this.runPm2Command(args);
  }

  static async stopProcess(
    name: string,
    projectName?: string,
    configDir?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;
    await this.runPm2Command(["stop", prefixedName]);

    // Clean up wrapper script if it exists
    if (projectName) {
      const processKey = `${projectName}.${name}`;
      const wrapperScript = this.wrapperScripts.get(processKey);
      if (wrapperScript) {
        try {
          unlinkSync(wrapperScript);
          this.wrapperScripts.delete(processKey);
          logger.debug(`Cleaned up wrapper script for ${processKey}`);
        } catch (e) {
          logger.warn(
            `Failed to clean up wrapper script for ${processKey}: ${e}`,
          );
        }
      }

      // Clean up log files
      await this.cleanupLogs(projectName, name, configDir);

      // Best-effort cleanup of any matching wrapper scripts left from previous runs
      this.cleanupWrapperScripts(projectName, name, configDir);
    }
  }

  static async restartProcess(
    name: string,
    projectName?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;

    // Clean up old wrapper script before restarting
    if (projectName) {
      const processKey = `${projectName}.${name}`;
      const oldWrapperScript = this.wrapperScripts.get(processKey);
      if (oldWrapperScript) {
        try {
          unlinkSync(oldWrapperScript);
          logger.debug(`Cleaned up old wrapper script for ${processKey}`);
        } catch (e) {
          logger.warn(
            `Failed to clean up old wrapper script for ${processKey}: ${e}`,
          );
        }
      }
    }

    try {
      await this.runPm2Command(["restart", prefixedName]);
    } catch (error) {
      // If restart fails, the process might not exist, so we should clean up the wrapper script entry
      if (projectName) {
        const processKey = `${projectName}.${name}`;
        this.wrapperScripts.delete(processKey);
        logger.debug(
          `Cleaned up wrapper script entry for ${processKey} after restart failure`,
        );
      }
      throw error;
    }
  }

  static async deleteProcess(
    name: string,
    projectName?: string,
    configDir?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;
    await this.runPm2Command(["delete", prefixedName]);

    // Clean up wrapper script if it exists
    if (projectName) {
      const processKey = `${projectName}.${name}`;
      const wrapperScript = this.wrapperScripts.get(processKey);
      if (wrapperScript) {
        try {
          unlinkSync(wrapperScript);
          this.wrapperScripts.delete(processKey);
          logger.debug(`Cleaned up wrapper script for ${processKey}`);
        } catch (e) {
          logger.warn(
            `Failed to clean up wrapper script for ${processKey}: ${e}`,
          );
        }
      }

      // Clean up log files
      await this.cleanupLogs(projectName, name, configDir);

      // Best-effort cleanup of any matching wrapper scripts left from previous runs
      this.cleanupWrapperScripts(projectName, name, configDir);
    }
  }

  static async deleteAllMatchingProcesses(
    name: string,
    projectName?: string,
    configDir?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;

    try {
      // Get all processes and find matching ones
      const processes = await this.listProcesses();
      const matchingProcesses = processes.filter(
        (p) => p.name === prefixedName,
      );

      if (matchingProcesses.length === 0) {
        logger.debug(`No processes found matching ${prefixedName}`);
        return;
      }

      logger.debug(
        `Deleting ${matchingProcesses.length} process(es) matching ${prefixedName}`,
      );

      // Delete each matching process
      for (const process of matchingProcesses) {
        await this.runPm2Command(["delete", process.name]);
      }

      // Clean up wrapper script
      if (projectName) {
        const processKey = `${projectName}.${name}`;
        const wrapperScript = this.wrapperScripts.get(processKey);
        if (wrapperScript) {
          try {
            unlinkSync(wrapperScript);
            this.wrapperScripts.delete(processKey);
            logger.debug(`Cleaned up wrapper script for ${processKey}`);
          } catch (e) {
            logger.warn(
              `Failed to clean up wrapper script for ${processKey}: ${e}`,
            );
          }
        }

        // Clean up log files
        await this.cleanupLogs(projectName, name, configDir);

        // Best-effort cleanup of any matching wrapper scripts left from previous runs
        this.cleanupWrapperScripts(projectName, name, configDir);
      }
    } catch (error) {
      logger.warn(`Error deleting processes: ${error}`);
    }
  }

  private static async cleanupLogs(
    projectName: string,
    processName: string,
    configDir?: string,
  ): Promise<void> {
    try {
      const { rmSync, unlinkSync, existsSync } = await import("fs");
      const logsDir = path.join(configDir || ".", ".zap", "logs");

      // Remove the specific log files
      const outLogPath = path.join(
        logsDir,
        `${projectName}.${processName}-out.log`,
      );
      const errorLogPath = path.join(
        logsDir,
        `${projectName}.${processName}-error.log`,
      );

      if (existsSync(outLogPath)) {
        unlinkSync(outLogPath);
        logger.debug(`Cleaned up stdout log: ${outLogPath}`);
      }

      if (existsSync(errorLogPath)) {
        unlinkSync(errorLogPath);
        logger.debug(`Cleaned up stderr log: ${errorLogPath}`);
      }

      // Try to remove the logs directory if it's empty
      try {
        const { readdirSync } = await import("fs");
        const remainingFiles = readdirSync(logsDir);
        if (remainingFiles.length === 0) {
          rmSync(logsDir, { recursive: true, force: true });
          logger.debug(`Cleaned up empty logs directory: ${logsDir}`);
        }
      } catch (e) {
        // Directory not empty or other error, that's fine
      }
    } catch (error) {
      // Log cleanup errors but don't fail the operation
      logger.warn(`Failed to clean up logs: ${error}`);
    }
  }

  private static cleanupWrapperScripts(
    projectName: string,
    processName: string,
    configDir?: string,
  ): void {
    try {
      const zapDir = path.join(configDir || ".", ".zap");
      if (!existsSync(zapDir)) return;
      const files = readdirSync(zapDir);
      const prefix = `${projectName}.${processName}.`;
      for (const file of files) {
        if (file.startsWith(prefix) && file.endsWith(".sh")) {
          const fullPath = path.join(zapDir, file);
          try {
            unlinkSync(fullPath);
            logger.debug(`Cleaned up wrapper script: ${fullPath}`);
          } catch (e) {
            logger.warn(`Failed to remove wrapper script ${fullPath}: ${e}`);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }

  private static sanitizeJsonOutput(output: string): string {
    // PM2 occasionally prepends warnings to stdout; strip until first JSON token
    const firstArray = output.indexOf("[");
    const firstObject = output.indexOf("{");
    let idx = -1;
    if (firstArray !== -1 && firstObject !== -1)
      idx = Math.min(firstArray, firstObject);
    else idx = Math.max(firstArray, firstObject);
    return idx > 0 ? output.slice(idx) : output;
  }

  static async showLogs(
    name: string,
    projectName?: string,
    follow: boolean = false,
    configDir?: string,
  ): Promise<void> {
    // Try different naming patterns to find the process
    let prefixedName = name;
    let processInfo = null;

    // First try the name as-is (for non-Zapper PM2 processes)
    processInfo = await this.getProcessInfo(name);
    if (processInfo) {
      prefixedName = name;
    } else if (projectName) {
      // If not found, try with Zapper prefix
      prefixedName = `zap.${projectName}.${name}`;
      processInfo = await this.getProcessInfo(prefixedName);
    }

    try {
      if (!processInfo) {
        logger.warn(
          `Process not found. Tried: ${name}${projectName ? ` and zap.${projectName}.${name}` : ""}`,
        );
        return;
      }

      logger.debug(
        `Showing logs for ${prefixedName}${follow ? " (following)" : ""}`,
      );

      // Get log file paths from PM2
      const logFiles = await this.getLogFilePaths(
        prefixedName,
        projectName,
        configDir,
      );
      if (!logFiles) {
        logger.warn(`Could not find log files for ${prefixedName}`);
        return;
      }

      // Show logs directly from files
      await this.showLogsFromFiles(logFiles, follow);
    } catch (error) {
      logger.warn(`Error showing logs: ${error}`);
    }
  }

  static async getProcessInfo(name: string): Promise<ProcessInfo | null> {
    try {
      const output = await this.runPm2Command(["jlist", "--silent"]);
      const sanitized = this.sanitizeJsonOutput(output);
      const processes = JSON.parse(sanitized) as ProcessInfo[];

      const process = processes.find((p) => p.name === name);

      return process || null;
    } catch (error) {
      return null;
    }
  }

  static async listProcesses(): Promise<ProcessInfo[]> {
    try {
      const output = await this.runPm2Command(["jlist", "--silent"]);

      const rawList = JSON.parse(this.sanitizeJsonOutput(output)) as Array<
        Record<string, unknown>
      >;
      const processes: ProcessInfo[] = rawList.map((proc) => ({
        name: String(proc["name"]),
        pid: Number(proc["pid"]),
        status: String((proc["pm2_env"] as Record<string, unknown>)["status"]),
        uptime:
          Date.now() -
          Number((proc["pm2_env"] as Record<string, unknown>)["pm_uptime"]),
        memory: Number((proc["monit"] as Record<string, unknown>)["memory"]),
        cpu: Number((proc["monit"] as Record<string, unknown>)["cpu"]),
        restarts: Number(
          (proc["pm2_env"] as Record<string, unknown>)["restart_time"],
        ),
        cwd: String(
          (proc["pm2_env"] as Record<string, unknown>)["pm_cwd"] || "",
        ),
      }));

      return processes;
    } catch (error) {
      return [];
    }
  }

  private static async getLogFilePaths(
    processName: string,
    projectName?: string,
    configDir?: string,
  ): Promise<{ stdout: string; stderr: string } | null> {
    try {
      // For Zapper-managed processes, use our custom log paths
      if (projectName && processName.startsWith(`zap.${projectName}.`)) {
        const logsDir = path.join(configDir || ".", ".zap", "logs");
        const baseName = processName.replace(`zap.${projectName}.`, "");
        const stdoutPath = path.join(
          logsDir,
          `${projectName}.${baseName}-out.log`,
        );
        const stderrPath = path.join(
          logsDir,
          `${projectName}.${baseName}-error.log`,
        );

        return { stdout: stdoutPath, stderr: stderrPath };
      }

      // For non-Zapper processes, fall back to PM2's default paths
      const output = await this.runPm2Command(["jlist", "--silent"]);
      const processes = JSON.parse(this.sanitizeJsonOutput(output)) as Array<
        Record<string, unknown>
      >;

      const process = processes.find((p) => p.name === processName);

      if (!process) {
        logger.warn(`Process not found: ${processName}`);
        return null;
      }

      const pm2Env = process.pm2_env as Record<string, unknown>;
      const stdoutPath = String(pm2Env.pm_out_log_path || "");
      const stderrPath = String(pm2Env.pm_err_log_path || "");

      if (!stdoutPath && !stderrPath) {
        logger.warn(`No log paths found for process ${processName}`);
        return null;
      }

      return { stdout: stdoutPath, stderr: stderrPath };
    } catch (error) {
      logger.warn(`Error getting log file paths: ${error}`);
      return null;
    }
  }

  private static async showLogsFromFiles(
    logFiles: { stdout: string; stderr: string },
    follow: boolean,
  ): Promise<void> {
    try {
      const { spawn } = await import("child_process");
      const { existsSync } = await import("fs");

      // Check if log files exist
      if (!existsSync(logFiles.stdout) && !existsSync(logFiles.stderr)) {
        logger.warn(`No log files found for this process`);
        return;
      }

      if (follow) {
        const tails: Array<ReturnType<typeof spawn>> = [];
        const RED = "\x1b[31m";
        const RESET = "\x1b[0m";

        const startTail = (
          filePath: string,
          isError: boolean,
        ): ReturnType<typeof spawn> => {
          const child = spawn("tail", ["-n", "10", "-f", filePath], {
            stdio: ["ignore", "pipe", "inherit"],
          });

          let buffer = "";
          child.stdout.on("data", (data) => {
            buffer += data.toString();
            const parts = buffer.split(/\r?\n/);
            buffer = parts.pop() || "";
            for (const line of parts) {
              if (!line) continue;
              if (isError)
                globalThis.process?.stdout?.write(`${RED}${line}${RESET}\n`);
              else globalThis.process?.stdout?.write(line + "\n");
            }
          });

          child.on("error", (err) => {
            logger.warn(`tail error for ${filePath}: ${err}`);
          });

          return child;
        };

        if (existsSync(logFiles.stdout))
          tails.push(startTail(logFiles.stdout, false));
        if (existsSync(logFiles.stderr))
          tails.push(startTail(logFiles.stderr, true));

        await new Promise<void>((resolve) => {
          let exiting = false;
          const cleanup = () => {
            if (exiting) return;
            exiting = true;
            for (const t of tails) {
              try {
                t.kill("SIGINT");
              } catch (e) {
                void e;
              }
            }
            resolve();
          };

          for (const t of tails) t.on("close", cleanup);
          globalThis.process?.on("SIGINT", cleanup);
        });
      } else {
        // Static logs - show last few lines from each file
        if (existsSync(logFiles.stdout)) {
          logger.debug(`STDOUT logs:`);
          const result = await this.runCommand("tail", [
            "-20",
            logFiles.stdout,
          ]);
          logger.info(result);
        }

        if (existsSync(logFiles.stderr)) {
          logger.debug(`STDERR logs:`);
          const result = await this.runCommand("tail", [
            "-20",
            logFiles.stderr,
          ]);
          logger.info(result);
        }
      }
    } catch (error) {
      logger.warn(`Error showing logs from files: ${error}`);
    }
  }

  private static async runCommand(
    command: string,
    args: string[],
  ): Promise<string> {
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: "pipe" });

      let output = "";
      child.stdout.on("data", (data: { toString(): string }) => {
        output += data.toString();
      });

      child.stderr.on("data", (data: { toString(): string }) => {
        output += data.toString();
      });

      child.on("close", (code: number) => {
        if (code === 0) resolve(output);
        else reject(new Error(`Command failed with code ${code}`));
      });

      child.on("error", reject);
    });
  }

  private static async runPm2CommandFollow(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running: pm2 ${args.join(" ")}`);
      const child = spawn("pm2", args, { stdio: ["pipe", "pipe", "pipe"] });

      child.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            // Strip PM2 prefix (e.g., "555|zap.le | hello world" -> "hello world")
            const strippedLine = line.replace(/^\d+\|[^|]*\|\s*/, "");
            globalThis.process?.stdout?.write(strippedLine + "\n");
          }
        }
      });

      child.stderr.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            // Strip PM2 prefix from stderr as well
            const strippedLine = line.replace(/^\d+\|[^|]*\|\s*/, "");
            globalThis.process?.stderr?.write(strippedLine + "\n");
          }
        }
      });

      child.on("error", (error) => {
        reject(error);
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `PM2 command exited with code ${code} (args: ${args.join(" ")})`,
            ),
          );
        }
      });

      // Handle process interruption
      globalThis.process?.on("SIGINT", () => {
        child.kill("SIGINT");
        resolve();
      });
    });
  }

  private static async runPm2CommandStream(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running: pm2 ${args.join(" ")}`);
      const child = spawn("pm2", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      child.stdout.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            // Strip PM2 prefix (e.g., "555|zap.le | hello world" -> "hello world")
            const strippedLine = line.replace(/^\d+\|[^|]*\|\s*/, "");
            globalThis.process?.stdout?.write(strippedLine + "\n");
          }
        }
      });

      child.stderr.on("data", (data) => {
        const lines = data.toString().split("\n");
        for (const line of lines) {
          if (line.trim()) {
            // Strip PM2 prefix from stderr as well
            const strippedLine = line.replace(/^\d+\|[^|]*\|\s*/, "");
            globalThis.process?.stderr?.write(strippedLine + "\n");
          }
        }
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `PM2 command failed with code ${code} (args: ${args.join(" ")})`,
            ),
          );
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to run PM2 command: ${err.message}`));
      });
    });
  }

  private static runPm2Command(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      logger.debug(`Running: pm2 ${args.join(" ")}`);
      const child = spawn("pm2", args, {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let output = "";
      let error = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        error += data.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          reject(
            new Error(
              `PM2 command failed (args: ${args.join(" ")}, code: ${code})\nstdout: ${output}\nstderr: ${error}`,
            ),
          );
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to run PM2 command: ${err.message}`));
      });
    });
  }

  private static createWrapperScript(
    projectName: string,
    processConfig: Process,
    configDir: string,
  ): string {
    const zapDir = path.join(configDir, ".zap");
    const timestamp = Date.now();
    const fileName = `${projectName}.${processConfig.name as string}.${timestamp}.sh`;
    const filePath = path.join(zapDir, fileName);

    let content = "#!/bin/bash\n";
    if (processConfig.source) {
      content += `source ${processConfig.source}\n`;
    }

    content += `${processConfig.cmd}\n`;

    writeFileSync(filePath, content, { mode: 0o755 });
    return filePath;
  }
}
