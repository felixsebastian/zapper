import { spawn } from "child_process";
import { ProcessConfig, ProcessInfo } from "../types";

export class Pm2Manager {
  static async startProcess(
    name: string,
    config: ProcessConfig,
    env: Record<string, string>,
  ): Promise<void> {
    const args = [
      "start",
      config.script,
      "--name",
      name,
      "--cwd",
      config.cwd || globalThis.process?.cwd() || ".",
    ];

    if (config.instances) {
      args.push("--instances", config.instances.toString());
    }

    if (config.max_memory) {
      args.push("--max-memory-restart", config.max_memory);
    }

    if (config.min_uptime) {
      args.push("--min-uptime", config.min_uptime);
    }

    if (config.max_restarts) {
      args.push("--max-restarts", config.max_restarts.toString());
    }

    if (config.node_args) {
      args.push("--node-args", config.node_args.join(" "));
    }

    // Add environment variables
    for (const [key, value] of Object.entries(env)) {
      args.push("--env", `${key}=${value}`);
    }

    await this.runPm2Command(args);
  }

  static async stopProcess(name: string): Promise<void> {
    await this.runPm2Command(["stop", name]);
  }

  static async restartProcess(name: string): Promise<void> {
    await this.runPm2Command(["restart", name]);
  }

  static async deleteProcess(name: string): Promise<void> {
    await this.runPm2Command(["delete", name]);
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
      const result = await this.runPm2Command(["jlist"]);
      const processes = JSON.parse(result) as ProcessInfo[];

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
