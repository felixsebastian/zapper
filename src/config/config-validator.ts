import { existsSync } from "fs";
import { ZapperConfig, Process, Container, Volume, TaskCmd } from "../types";
import { assertValidName } from "../utils/validators";

export class ConfigValidator {
  static validate(config: ZapperConfig): void {
    this.validateTopLevelKeys(config);
    this.validateProject(config);
    this.validateEnvFiles(config);
    this.validateGitMethod(config);
    this.validateBareMetal(config);
    this.validateDocker(config);
    // Backward compatibility
    this.validateProcesses(config);
    // Tasks
    this.validateTasks(config);

    // Global uniqueness across bare_metal and docker for names and aliases
    const seen = new Map<string, string>();
    const add = (id: string, where: string) => {
      if (seen.has(id)) {
        throw new Error(
          `Duplicate service identifier '${id}'. Names and aliases must be globally unique across bare_metal and docker`,
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
    const containers = config.docker || config.containers;
    if (containers) {
      for (const [name, c] of Object.entries(containers)) {
        add(name, `docker['${name}']`);
        if (Array.isArray(c.aliases))
          for (const a of c.aliases) add(a, `docker['${name}'].aliases`);
      }
    }

    // Require at least one process definition (bare_metal, docker, or legacy processes)
    const hasBareMetal =
      typeof config.bare_metal === "object" &&
      config.bare_metal !== null &&
      Object.keys(config.bare_metal).length > 0;
    const hasLegacyProcesses =
      Array.isArray(config.processes) && config.processes.length > 0;
    const hasDocker =
      typeof (config.docker || config.containers) === "object" &&
      (config.docker || config.containers) !== null &&
      Object.keys(config.docker || config.containers!).length > 0;

    if (!hasBareMetal && !hasLegacyProcesses && !hasDocker) {
      throw new Error(
        "No processes defined. Define at least one in bare_metal, docker, or processes",
      );
    }
  }

  private static validateTopLevelKeys(config: ZapperConfig): void {
    const allowed = new Set([
      "project",
      "env_files",
      "git_method",
      "bare_metal",
      "docker",
      "containers",
      "processes",
      "tasks",
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

  private static validateGitMethod(config: ZapperConfig): void {
    if (config.git_method === undefined) return;
    const allowed = new Set(["http", "ssh", "cli"]);
    if (!allowed.has(config.git_method))
      throw new Error(
        `git_method must be one of http | ssh | cli (got: ${config.git_method})`,
      );
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

  private static validateDocker(config: ZapperConfig): void {
    const containers = config.docker || config.containers;
    if (containers !== undefined) {
      if (typeof containers !== "object" || containers === null) {
        throw new Error("docker must be an object");
      }
      for (const [name, container] of Object.entries(containers)) {
        assertValidName(name, "Service");
        this.validateContainerKeys(container, name);
        // If container.name is provided, enforce it matches key as a strictness rule
        if (container.name && container.name !== name) {
          throw new Error(
            `Docker service name '${container.name}' must match its key '${name}'`,
          );
        }
        this.validateContainer(name, container);
        this.validateAliases(container.aliases, name, "docker");
      }
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
      // internal
      "resolvedEnv",
    ]);
    for (const key of Object.keys(
      container as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key))
        throw new Error(`Unknown key in docker['${name}']: ${key}`);
    }
  }

  private static validateContainer(name: string, container: Container): void {
    if (!container.image) {
      throw new Error(`Docker service ${name} must have an image field`);
    }

    if (container.ports !== undefined) {
      if (!Array.isArray(container.ports)) {
        throw new Error(
          `Docker service ${name} ports must be an array of strings`,
        );
      }
      for (const port of container.ports) {
        if (typeof port !== "string" || port.trim() === "") {
          throw new Error(
            `Docker service ${name} ports must contain non-empty strings`,
          );
        }
      }
    }

    if (container.env !== undefined) {
      if (!Array.isArray(container.env)) {
        throw new Error(
          `Docker service ${name} env must be an array of strings`,
        );
      }
      this.validateInlineEnvArray(container.env, `Docker service ${name} env`);
    }

    if (container.volumes !== undefined) {
      if (!Array.isArray(container.volumes)) {
        throw new Error(`Docker service ${name} volumes must be an array`);
      }
      for (const volume of container.volumes) {
        if (typeof volume === "string") {
          // simplified docker-compose style: "name:/container/path"
          const parts = volume.split(":");
          if (
            parts.length !== 2 ||
            parts[0].trim() === "" ||
            parts[1].trim() === ""
          ) {
            throw new Error(
              `Docker service ${name} volume string must be in 'name:/container/path' form`,
            );
          }
          if (!parts[1].startsWith("/")) {
            throw new Error(
              `Docker service ${name} volume internal path must be absolute: ${parts[1]}`,
            );
          }
        } else {
          this.validateVolume(name, volume);
        }
      }
    }

    if (container.networks !== undefined) {
      if (!Array.isArray(container.networks)) {
        throw new Error(
          `Docker service ${name} networks must be an array of strings`,
        );
      }
      for (const network of container.networks) {
        if (typeof network !== "string" || network.trim() === "") {
          throw new Error(
            `Docker service ${name} networks must contain non-empty strings`,
          );
        }
      }
    }

    if (
      container.command !== undefined &&
      typeof container.command !== "string"
    ) {
      throw new Error(`Docker service ${name} command must be a string`);
    }
  }

  private static validateInlineEnvArray(arr: string[], context: string): void {
    const seen = new Set<string>();
    for (const key of arr) {
      if (typeof key !== "string" || key.trim() === "") {
        throw new Error(`${context} must contain non-empty strings`);
      }
      if (seen.has(key)) {
        throw new Error(
          `Duplicate service identifier '${key}'. Names and aliases must be globally unique across bare_metal and docker`,
        );
      }
      seen.add(key);
    }
  }

  private static validateProcess(process: Process): void {
    if (!process.cmd) {
      throw new Error(
        `Process ${process.name || "unknown"} must have a cmd field`,
      );
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
      "repo",
      "env_files",
      // internal
      "resolvedEnv",
    ]);
    for (const key of Object.keys(
      process as unknown as Record<string, unknown>,
    )) {
      if (!allowed.has(key))
        throw new Error(`Unknown key in bare_metal['${name}']: ${key}`);
    }
  }

  private static validateVolume(serviceName: string, volume: Volume): void {
    if (typeof volume.name !== "string" || volume.name.trim() === "") {
      throw new Error(
        `Docker service ${serviceName} volume name must be a non-empty string`,
      );
    }
    if (
      typeof volume.internal_dir !== "string" ||
      volume.internal_dir.trim() === ""
    ) {
      throw new Error(
        `Docker service ${serviceName} volume internal_dir must be a non-empty string`,
      );
    }
    if (!volume.internal_dir.startsWith("/")) {
      throw new Error(
        `Docker service ${serviceName} volume internal_dir must be an absolute path`,
      );
    }
  }

  private static validateTasks(config: ZapperConfig): void {
    if (config.tasks !== undefined) {
      if (typeof config.tasks !== "object" || config.tasks === null) {
        throw new Error("tasks must be an object");
      }
      for (const [name, task] of Object.entries(config.tasks)) {
        assertValidName(name, "Task");
        this.validateTask(task as any, name);
      }
    }
  }

  private static validateTask(task: any, name: string): void {
    const allowed = new Set([
      "name",
      "desc",
      "cmds",
      "env",
      "cwd",
      "env_files",
      // internal
      "resolvedEnv",
    ]);
    for (const key of Object.keys(task)) {
      if (!allowed.has(key))
        throw new Error(`Unknown key in tasks['${name}']: ${key}`);
    }

    if (!Array.isArray((task as { cmds?: TaskCmd[] }).cmds)) {
      throw new Error(`Task ${name} must have a cmds array`);
    }

    const cmds = (task as { cmds: TaskCmd[] }).cmds;
    for (const cmd of cmds) {
      if (
        typeof cmd !== "string" &&
        !(typeof cmd === "object" && cmd !== null && "task" in cmd)
      ) {
        throw new Error(
          `Task ${name} cmds must be strings or objects with a 'task' field`,
        );
      }
    }
  }

  // Legacy processes validator retained from previous version
  private static validateProcesses(config: ZapperConfig): void {
    if (config.processes !== undefined) {
      if (!Array.isArray(config.processes)) {
        throw new Error("processes must be an array");
      }
      for (const process of config.processes) {
        this.validateProcess(process);
        this.validateProcessKeys(process, process.name || "unknown");
      }
    }
  }

  private static validateAliases(
    aliases: string[] | undefined,
    name: string,
    scope: string,
  ): void {
    if (!Array.isArray(aliases)) return;
    const seen = new Set<string>();
    for (const a of aliases) {
      if (typeof a !== "string" || a.trim() === "")
        throw new Error(
          `Duplicate service identifier '${a}'. Names and aliases must be globally unique across bare_metal and ${scope}`,
        );
      if (seen.has(a))
        throw new Error(
          `Duplicate service identifier '${a}'. Names and aliases must be globally unique across bare_metal and ${scope}`,
        );
      seen.add(a);
    }
  }
}
