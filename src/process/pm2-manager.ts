import { spawn } from "child_process";
import { mkdirSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import { Process, ProcessInfo } from "../types";

export class Pm2Manager {
  static async startProcess(
    processConfig: Process,
    projectName: string,
  ): Promise<void> {
    const prefixedName = `zap.${projectName}.${processConfig.name}`;
    const args = ["start", processConfig.cmd, "--name", prefixedName];

    if (processConfig.cwd) {
      args.push("--cwd", processConfig.cwd);
    }

    if (processConfig.env) {
      for (const [key, value] of Object.entries(processConfig.env)) {
        args.push("--env", `${key}=${value}`);
      }
    }

    await this.runPm2Command(args);
  }

  static async startProcessWithTempEcosystem(
    projectName: string,
    processConfig: Process,
    configDir?: string,
  ): Promise<void> {
    if (!configDir) {
      await this.startProcess(processConfig, projectName);
      return;
    }

    const zapDir = path.join(configDir, ".zap");
    const logsDir = path.join(zapDir, "logs");
    mkdirSync(logsDir, { recursive: true });

    const ecosystem = {
      apps: [
        {
          name: `zap.${projectName}.${processConfig.name}`,
          script: processConfig.cmd,
          cwd: processConfig.cwd,
          env: processConfig.env || {},
          error_file: path.join(
            logsDir,
            `${projectName}.${processConfig.name}-error.log`,
          ),
          out_file: path.join(
            logsDir,
            `${projectName}.${processConfig.name}-out.log`,
          ),
          merge_logs: true,
        },
      ],
    } as Record<string, unknown>;

    const tempFile = path.join(
      zapDir,
      `${projectName}.${processConfig.name}.${Date.now()}.ecosystem.json`,
    );
    writeFileSync(tempFile, JSON.stringify(ecosystem));

    try {
      await this.runPm2Command(["start", tempFile]);
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

  static async stopProcess(name: string, projectName?: string): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;
    await this.runPm2Command(["stop", prefixedName]);
  }

  static async restartProcess(
    name: string,
    projectName?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;
    await this.runPm2Command(["restart", prefixedName]);
  }

  static async deleteProcess(
    name: string,
    projectName?: string,
  ): Promise<void> {
    const prefixedName = projectName ? `zap.${projectName}.${name}` : name;
    await this.runPm2Command(["delete", prefixedName]);
  }

  static async getProcessInfo(name: string): Promise<ProcessInfo | null> {
    try {
      const result = await this.runPm2Command(["jlist"]);
      const processes = JSON.parse(result) as ProcessInfo[];
      const process = processes.find((p) => p.name === name);

      if (!process) return null;

      return process;
    } catch (error) {
      return null;
    }
  }

  static async listProcesses(): Promise<ProcessInfo[]> {
    try {
      const output = await this.runPm2Command(["jlist"]);

      const rawList = JSON.parse(output) as Array<Record<string, unknown>>;
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
      }));

      return processes;
    } catch (error) {
      return [];
    }
  }

  private static runPm2Command(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
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
          reject(new Error(`PM2 command failed: ${error}`));
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to run PM2 command: ${err.message}`));
      });
    });
  }
}
