import { spawn } from "child_process";
import { ContainerConfig, ContainerInfo } from "../types";

export class DockerManager {
  static async startContainer(
    name: string,
    config: ContainerConfig,
  ): Promise<void> {
    const args = ["run", "-d", "--name", name];

    if (config.ports) {
      for (const port of config.ports) {
        args.push("-p", port);
      }
    }

    if (config.volumes) {
      for (const volume of config.volumes) {
        args.push("-v", volume);
      }
    }

    if (config.networks) {
      for (const network of config.networks) {
        args.push("--network", network);
      }
    }

    if (config.environment) {
      for (const [key, value] of Object.entries(config.environment)) {
        args.push("-e", `${key}=${value}`);
      }
    }

    args.push(config.image);

    if (config.command) {
      args.push(config.command);
    }

    await this.runDockerCommand(args);
  }

  static async stopContainer(name: string): Promise<void> {
    await this.runDockerCommand(["stop", name]);
  }

  static async restartContainer(name: string): Promise<void> {
    await this.runDockerCommand(["restart", name]);
  }

  static async removeContainer(name: string): Promise<void> {
    await this.runDockerCommand(["rm", "-f", name]);
  }

  static async getContainerInfo(name: string): Promise<ContainerInfo | null> {
    try {
      const result = await this.runDockerCommand([
        "inspect",
        "--format",
        "{{json .}}",
        name,
      ]);

      const container = JSON.parse(result) as ContainerInfo;

      return {
        id: container.id || "",
        name: container.name || "",
        status: container.status || "",
        ports: container.ports || [],
        networks: container.networks || [],
        created: container.created || "",
      };
    } catch (error) {
      return null;
    }
  }

  static async listContainers(): Promise<ContainerInfo[]> {
    try {
      const result = await this.runDockerCommand([
        "ps",
        "-a",
        "--format",
        "{{json .}}",
      ]);

      const containers = result
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as ContainerInfo);

      return containers.map((container) => ({
        id: container.id || "",
        name: container.name || "",
        status: container.status || "",
        ports: container.ports || [],
        networks: container.networks || [],
        created: container.created || "",
      }));
    } catch (error) {
      return [];
    }
  }

  static async createNetwork(name: string): Promise<void> {
    try {
      await this.runDockerCommand(["network", "create", name]);
    } catch (error) {
      // Network might already exist, ignore error
    }
  }

  static async removeNetwork(name: string): Promise<void> {
    try {
      await this.runDockerCommand(["network", "rm", name]);
    } catch (error) {
      // Network might not exist, ignore error
    }
  }

  private static runDockerCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", args, {
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
          reject(new Error(`Docker command failed: ${error}`));
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Failed to run Docker command: ${err.message}`));
      });
    });
  }
}
