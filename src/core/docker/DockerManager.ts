import { runDocker } from "./runDocker";

interface DockerConfig {
  image: string;
  ports?: string[];
  volumes?: string[];
  networks?: string[];
  environment?: Record<string, string>;
  command?: string;
  labels?: Record<string, string>;
}

interface DockerContainer {
  id: string;
  name: string;
  status: string;
  ports: string[];
  networks: string[];
  created: string;
}

export class DockerManager {
  static async startContainer(
    name: string,
    config: DockerConfig,
  ): Promise<void> {
    // Ensure a clean slate: remove any existing container with this name
    try {
      await runDocker(["rm", "-f", name]);
    } catch (e) {
      // ignore if container doesn't exist
    }
    const args = ["run", "-d", "--name", name];

    if (config.labels)
      for (const [k, v] of Object.entries(config.labels))
        args.push("--label", `${k}=${v}`);
    if (config.ports) for (const p of config.ports) args.push("-p", p);
    if (config.volumes) for (const v of config.volumes) args.push("-v", v);
    if (config.networks)
      for (const n of config.networks) args.push("--network", n);
    if (config.environment)
      for (const [k, v] of Object.entries(config.environment))
        args.push("-e", `${k}=${v}`);

    args.push(config.image);
    if (config.command) args.push(config.command);

    await runDocker(args);
  }

  static async stopContainer(name: string): Promise<void> {
    // Prefer removing containers entirely to avoid name conflicts on next start
    await runDocker(["rm", "-f", name]);
  }

  static async restartContainer(name: string): Promise<void> {
    await runDocker(["restart", name]);
  }

  static async removeContainer(name: string): Promise<void> {
    await runDocker(["rm", "-f", name]);
  }

  static async getContainerInfo(name: string): Promise<DockerContainer | null> {
    try {
      const result = await runDocker([
        "inspect",
        "--format",
        "{{json .}}",
        name,
      ]);
      const raw = JSON.parse(result) as Record<string, unknown>;
      const state = raw["State"] as Record<string, unknown> | undefined;
      const net = raw["NetworkSettings"] as Record<string, unknown> | undefined;
      const networks =
        (net?.["Networks"] as Record<string, unknown> | undefined) || {};

      return {
        id: (raw["Id"] as string) || "",
        name: ((raw["Name"] as string) || "").replace(/^\//, ""),
        status: (state?.["Status"] as string) || "",
        ports: [],
        networks: Object.keys(networks),
        created: (raw["Created"] as string) || "",
      };
    } catch (error) {
      return null;
    }
  }

  static async listContainers(): Promise<DockerContainer[]> {
    try {
      const result = await runDocker(["ps", "-a", "--format", "{{json .}}"]);
      const lines = result
        .trim()
        .split("\n")
        .filter((l) => l.trim().length > 0);
      const containers = lines.map(
        (line) => JSON.parse(line) as Record<string, unknown>,
      );
      return containers.map((raw) => ({
        id: (raw["ID"] as string) || (raw["Id"] as string) || "",
        name: (raw["Names"] as string) || (raw["Name"] as string) || "",
        status: (raw["Status"] as string) || "",
        ports: raw["Ports"]
          ? Array.isArray(raw["Ports"])
            ? (raw["Ports"] as string[])
            : [String(raw["Ports"])]
          : [],
        networks: raw["Networks"]
          ? Array.isArray(raw["Networks"])
            ? (raw["Networks"] as string[])
            : [String(raw["Networks"])]
          : [],
        created:
          (raw["CreatedAt"] as string) || (raw["Created"] as string) || "",
      }));
    } catch (error) {
      return [];
    }
  }

  static async createNetwork(name: string): Promise<void> {
    try {
      await runDocker(["network", "create", name]);
    } catch (error) {
      // ignore if exists
    }
  }

  static async removeNetwork(name: string): Promise<void> {
    try {
      await runDocker(["network", "rm", name]);
    } catch (error) {
      // ignore if missing
    }
  }

  static async createVolume(name: string): Promise<void> {
    try {
      await runDocker(["volume", "create", name]);
    } catch (error) {
      // ignore if exists
    }
  }
}
