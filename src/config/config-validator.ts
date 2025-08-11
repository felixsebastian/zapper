import { existsSync } from "fs";
import { ZapperConfig, Process, Container, Volume } from "../types";
import { assertValidName } from "../utils/validators";

export class ConfigValidator {
  static validate(config: ZapperConfig): void {
    this.validateTopLevelKeys(config);
    this.validateProject(config);
    this.validateEnvFiles(config);
    this.validateBareMetal(config);
    this.validateContainers(config);
    // Backward compatibility
    this.validateProcesses(config);

    // Global uniqueness across bare_metal and containers for names and aliases
    const seen = new Map<string, string>();
    const add = (id: string, where: string) => {
      if (seen.has(id)) {
        throw new Error(
          `Duplicate service identifier '${id}'. Names and aliases must be globally unique across bare_metal and containers`,
        );
      }
      seen.set(id, where);
    };

    if (config.bare_metal) {
      for (const [name, proc] of Object.entries(config.bare_metal)) {
        add(name, `bare_metal['${name}']`);
        if (Array.isArray(proc.aliases))
          for (const a of proc.aliases) add(a, `bare_metal['${name}'].aliases`);
      }
    }
    if (config.containers) {
      for (const [name, c] of Object.entries(config.containers)) {
        add(name, `containers['${name}']`);
        if (Array.isArray(c.aliases))
          for (const a of c.aliases) add(a, `containers['${name}'].aliases`);
      }
    }

    // Require at least one process definition (bare_metal, containers, or legacy processes)
    const hasBareMetal =
      typeof config.bare_metal === "object" &&
      config.bare_metal !== null &&
      Object.keys(config.bare_metal).length > 0;
    const hasLegacyProcesses =
      Array.isArray(config.processes) && config.processes.length > 0;
    const hasContainers =
      typeof config.containers === "object" &&
      config.containers !== null &&
      Object.keys(config.containers).length > 0;
    if (!hasBareMetal && !hasLegacyProcesses && !hasContainers) {
      throw new Error("bare_metal must have at least one process defined");
    }
  }

  private static validateTopLevelKeys(config: ZapperConfig): void {
    const allowed = new Set([
      "project",
      "env_files",
      "bare_metal",
      "containers",
      "processes",
    ]);
    for (const key of Object.keys(
      config as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key)) throw new Error(`Unknown top-level key: ${key}`);
    }
  }

  private static validateProject(config: ZapperConfig): void {
    if (!config.project) {
      throw new Error("Config must have a project field");
    }
    assertValidName(config.project, "Project");
  }

  private static validateEnvFiles(config: ZapperConfig): void {
    if (config.env_files !== undefined) {
      if (!Array.isArray(config.env_files)) {
        throw new Error("env_files must be an array of file paths");
      }
      for (const filePath of config.env_files) {
        if (typeof filePath !== "string" || filePath.trim() === "") {
          throw new Error("env_files must contain non-empty string paths");
        }
        if (!existsSync(filePath)) {
          throw new Error(`Env file does not exist: ${filePath}`);
        }
      }
    }
  }

  private static validateBareMetal(config: ZapperConfig): void {
    if (config.bare_metal !== undefined) {
      if (typeof config.bare_metal !== "object" || config.bare_metal === null) {
        throw new Error("bare_metal must be an object");
      }
      if (Object.keys(config.bare_metal).length === 0) {
        throw new Error("bare_metal must have at least one process defined");
      }
      for (const [name, process] of Object.entries(config.bare_metal)) {
        assertValidName(name, "Service");
        // Ensure the process has a name field matching the key
        if (!process.name) process.name = name;
        if (process.name !== name)
          throw new Error(
            `Process name '${process.name}' must match its key '${name}'`,
          );
        this.validateProcess(process);
        this.validateProcessKeys(process, name);
        this.validateAliases(process.aliases, name, "bare_metal");
      }
    }
  }

  private static validateContainers(config: ZapperConfig): void {
    if (config.containers !== undefined) {
      if (typeof config.containers !== "object" || config.containers === null) {
        throw new Error("containers must be an object");
      }
      for (const [name, container] of Object.entries(config.containers)) {
        assertValidName(name, "Service");
        this.validateContainerKeys(container, name);
        // If container.name is provided, enforce it matches key as a strictness rule
        if (container.name && container.name !== name) {
          throw new Error(
            `Container name '${container.name}' must match its key '${name}'`,
          );
        }
        this.validateContainer(name, container);
        this.validateAliases(container.aliases, name, "containers");
      }
    }
  }

  private static validateContainer(name: string, container: Container): void {
    if (!container.image) {
      throw new Error(`Container ${name} must have an image field`);
    }

    if (container.ports !== undefined) {
      if (!Array.isArray(container.ports)) {
        throw new Error(`Container ${name} ports must be an array of strings`);
      }
      for (const port of container.ports) {
        if (typeof port !== "string" || port.trim() === "") {
          throw new Error(
            `Container ${name} ports must contain non-empty strings`,
          );
        }
      }
    }

    if (container.env !== undefined) {
      if (!Array.isArray(container.env)) {
        throw new Error(`Container ${name} env must be an array of strings`);
      }
      for (const key of container.env) {
        if (typeof key !== "string" || key.trim() === "") {
          throw new Error(
            `Container ${name} env must contain non-empty string keys`,
          );
        }
      }
    }

    if (container.volumes !== undefined) {
      if (!Array.isArray(container.volumes)) {
        throw new Error(`Container ${name} volumes must be an array`);
      }
      for (const volume of container.volumes) {
        this.validateVolume(name, volume);
      }
    }

    if (container.networks !== undefined) {
      if (!Array.isArray(container.networks)) {
        throw new Error(
          `Container ${name} networks must be an array of strings`,
        );
      }
      for (const network of container.networks) {
        if (typeof network !== "string" || network.trim() === "") {
          throw new Error(
            `Container ${name} networks must contain non-empty strings`,
          );
        }
      }
    }
  }

  private static validateVolume(containerName: string, volume: Volume): void {
    // Unknown keys in volume
    const allowed = new Set(["name", "internal_dir"]);
    for (const key of Object.keys(
      volume as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key))
        throw new Error(
          `Unknown key in volume for containers['${containerName}']: ${key}`,
        );
    }

    if (!volume.name) {
      throw new Error(
        `Container ${containerName} volume must have a name field`,
      );
    }
    if (!volume.internal_dir) {
      throw new Error(
        `Container ${containerName} volume must have an internal_dir field`,
      );
    }
  }

  private static validateProcesses(config: ZapperConfig): void {
    // Backward compatibility - only validate if bare_metal is not present
    if (config.bare_metal === undefined && config.processes !== undefined) {
      if (!Array.isArray(config.processes)) {
        throw new Error("processes must be an array");
      }
      if (config.processes.length === 0) {
        throw new Error("Config must have at least one process defined");
      }
      const seen = new Set<string>();
      for (const [index, process] of config.processes.entries()) {
        this.validateProcess(process);
        this.validateProcessKeys(process, `processes[${index}]`);
        if (seen.has(process.name))
          throw new Error(
            `Duplicate process name '${process.name}' in processes`,
          );
        seen.add(process.name);
      }
    }
  }

  private static validateProcess(process: Process): void {
    if (!process.name) {
      throw new Error("Process must have a name field");
    }
    assertValidName(process.name, "Service");

    if (!process.cmd) {
      throw new Error(`Process ${process.name} must have a cmd field`);
    }

    // Prefer 'env' whitelist; allow legacy 'envs'
    const whitelist = Array.isArray(process.env)
      ? process.env
      : Array.isArray(process.envs)
        ? process.envs
        : undefined;

    if (whitelist !== undefined) {
      if (!Array.isArray(whitelist)) {
        throw new Error(
          `Process ${process.name} env must be an array of strings`,
        );
      }
      for (const key of whitelist) {
        if (typeof key !== "string" || key.trim() === "") {
          throw new Error(
            `Process ${process.name} env must contain non-empty string keys`,
          );
        }
      }
    }
  }

  private static validateProcessKeys(process: Process, name: string): void {
    const allowed = new Set([
      "name",
      "cmd",
      "cwd",
      "env",
      "envs",
      "aliases",
      "resolvedEnv",
      "source",
    ]);
    for (const key of Object.keys(
      process as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key))
        throw new Error(`Unknown key in bare_metal['${name}']: ${key}`);
    }
  }

  private static validateContainerKeys(
    container: Container,
    name: string,
  ): void {
    const allowed = new Set([
      "name",
      "image",
      "ports",
      "env",
      "volumes",
      "networks",
      "command",
      "aliases",
    ]);
    for (const key of Object.keys(
      container as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key))
        throw new Error(`Unknown key in containers['${name}']: ${key}`);
    }
  }

  private static validateAliases(
    aliases: unknown,
    baseName: string,
    section: "bare_metal" | "containers",
  ): void {
    if (aliases === undefined) return;
    if (!Array.isArray(aliases))
      throw new Error(
        `Aliases for ${section}['${baseName}'] must be an array of strings`,
      );

    const local = new Set<string>();
    for (const a of aliases) {
      if (typeof a !== "string" || a.trim() === "")
        throw new Error(
          `Aliases for ${section}['${baseName}'] must contain non-empty strings`,
        );
      assertValidName(a, "Service alias");
      if (a === baseName)
        throw new Error(
          `Alias '${a}' for ${section}['${baseName}'] cannot equal its service name`,
        );
      if (local.has(a))
        throw new Error(`Duplicate alias '${a}' for ${section}['${baseName}']`);
      local.add(a);
    }
  }
}
