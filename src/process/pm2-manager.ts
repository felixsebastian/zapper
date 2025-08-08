import { spawn } from "child_process";
import { Process, ProcessInfo } from "../types";

export class Pm2Manager {
  static async startProcess(processConfig: Process): Promise<void> {
    const args = ["start", processConfig.cmd, "--name", processConfig.name];

    if (processConfig.cwd) {
      args.push("--cwd", processConfig.cwd);
    }

    // Add environment variables
    if (processConfig.env) {
      for (const [key, value] of Object.entries(processConfig.env)) {
        args.push("--env", `${key}=${value}`);
      }
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
