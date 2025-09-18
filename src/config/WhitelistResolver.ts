import { ZapperConfig } from "./schemas";

/**
 * Resolves whitelist references in environment configurations.
 * Replaces string references to whitelists with their actual environment variable arrays.
 */
export class WhitelistResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    if (!config.whitelists) {
      return config;
    }

    const resolvedConfig = structuredClone(config);
    const whitelists = config.whitelists;

    // Resolve bare_metal processes
    if (resolvedConfig.bare_metal) {
      for (const [name, process] of Object.entries(resolvedConfig.bare_metal)) {
        if (process.env && typeof process.env === "string") {
          const whitelistName = process.env;
          if (!(whitelistName in whitelists)) {
            throw new Error(
              `Process '${name}' references unknown whitelist '${whitelistName}'`,
            );
          }
          process.env = [...whitelists[whitelistName]];
        }
      }
    }

    // Resolve legacy processes array
    if (resolvedConfig.processes) {
      for (const process of resolvedConfig.processes) {
        if (process.env && typeof process.env === "string") {
          const whitelistName = process.env;
          if (!(whitelistName in whitelists)) {
            throw new Error(
              `Process '${process.name || "unnamed"}' references unknown whitelist '${whitelistName}'`,
            );
          }
          process.env = [...whitelists[whitelistName]];
        }
      }
    }

    // Resolve docker containers
    if (resolvedConfig.docker) {
      for (const [name, container] of Object.entries(resolvedConfig.docker)) {
        if (container.env && typeof container.env === "string") {
          const whitelistName = container.env;
          if (!(whitelistName in whitelists)) {
            throw new Error(
              `Container '${name}' references unknown whitelist '${whitelistName}'`,
            );
          }
          container.env = [...whitelists[whitelistName]];
        }
      }
    }

    // Resolve containers field
    if (resolvedConfig.containers) {
      for (const [name, container] of Object.entries(
        resolvedConfig.containers,
      )) {
        if (container.env && typeof container.env === "string") {
          const whitelistName = container.env;
          if (!(whitelistName in whitelists)) {
            throw new Error(
              `Container '${name}' references unknown whitelist '${whitelistName}'`,
            );
          }
          container.env = [...whitelists[whitelistName]];
        }
      }
    }

    // Resolve tasks
    if (resolvedConfig.tasks) {
      for (const [name, task] of Object.entries(resolvedConfig.tasks)) {
        if (task.env && typeof task.env === "string") {
          const whitelistName = task.env;
          if (!(whitelistName in whitelists)) {
            throw new Error(
              `Task '${name}' references unknown whitelist '${whitelistName}'`,
            );
          }
          task.env = [...whitelists[whitelistName]];
        }
      }
    }

    return resolvedConfig;
  }

  /**
   * Validates that all whitelist references exist.
   * Should be called before resolve() to provide early validation.
   */
  static validateReferences(config: ZapperConfig): void {
    if (!config.whitelists) {
      // If there are no whitelists defined, check that no string env references exist
      this.checkForStringEnvReferences(config);
      return;
    }

    const whitelists = config.whitelists;
    const whitelistNames = Object.keys(whitelists);

    // Helper to validate a string env reference
    const validateEnvReference = (
      envValue: string,
      entityType: string,
      entityName: string,
    ) => {
      if (!(envValue in whitelists)) {
        throw new Error(
          `${entityType} '${entityName}' references unknown whitelist '${envValue}'. Available whitelists: ${whitelistNames.join(", ")}`,
        );
      }
    };

    // Check bare_metal processes
    if (config.bare_metal) {
      for (const [name, process] of Object.entries(config.bare_metal)) {
        if (process.env && typeof process.env === "string") {
          validateEnvReference(process.env, "Process", name);
        }
      }
    }

    // Check legacy processes array
    if (config.processes) {
      for (const process of config.processes) {
        if (process.env && typeof process.env === "string") {
          validateEnvReference(
            process.env,
            "Process",
            process.name || "unnamed",
          );
        }
      }
    }

    // Check docker containers
    if (config.docker) {
      for (const [name, container] of Object.entries(config.docker)) {
        if (container.env && typeof container.env === "string") {
          validateEnvReference(container.env, "Container", name);
        }
      }
    }

    // Check containers field
    if (config.containers) {
      for (const [name, container] of Object.entries(config.containers)) {
        if (container.env && typeof container.env === "string") {
          validateEnvReference(container.env, "Container", name);
        }
      }
    }

    // Check tasks
    if (config.tasks) {
      for (const [name, task] of Object.entries(config.tasks)) {
        if (task.env && typeof task.env === "string") {
          validateEnvReference(task.env, "Task", name);
        }
      }
    }
  }

  private static checkForStringEnvReferences(config: ZapperConfig): void {
    const foundReferences: string[] = [];

    // Check bare_metal processes
    if (config.bare_metal) {
      for (const [name, process] of Object.entries(config.bare_metal)) {
        if (process.env && typeof process.env === "string") {
          foundReferences.push(`Process '${name}' references '${process.env}'`);
        }
      }
    }

    // Check legacy processes array
    if (config.processes) {
      for (const process of config.processes) {
        if (process.env && typeof process.env === "string") {
          foundReferences.push(
            `Process '${process.name || "unnamed"}' references '${process.env}'`,
          );
        }
      }
    }

    // Check docker containers
    if (config.docker) {
      for (const [name, container] of Object.entries(config.docker)) {
        if (container.env && typeof container.env === "string") {
          foundReferences.push(
            `Container '${name}' references '${container.env}'`,
          );
        }
      }
    }

    // Check containers field
    if (config.containers) {
      for (const [name, container] of Object.entries(config.containers)) {
        if (container.env && typeof container.env === "string") {
          foundReferences.push(
            `Container '${name}' references '${container.env}'`,
          );
        }
      }
    }

    // Check tasks
    if (config.tasks) {
      for (const [name, task] of Object.entries(config.tasks)) {
        if (task.env && typeof task.env === "string") {
          foundReferences.push(`Task '${name}' references '${task.env}'`);
        }
      }
    }

    if (foundReferences.length > 0) {
      throw new Error(
        `Environment whitelist references found but no whitelists defined. Either define whitelists or use arrays for env. Found: ${foundReferences.join(", ")}`,
      );
    }
  }
}
