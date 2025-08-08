import { ZapperConfig, ServiceConfig } from "../types";

export class ConfigValidator {
  static validate(config: ZapperConfig): void {
    this.validateVersion(config);
    this.validateServices(config);
    this.validateServiceDependencies(config);
  }

  private static validateVersion(config: ZapperConfig): void {
    if (!config.version) {
      throw new Error("Config must have a version field");
    }
  }

  private static validateServices(config: ZapperConfig): void {
    if (!config.services || Object.keys(config.services).length === 0) {
      throw new Error("Config must have at least one service defined");
    }

    for (const [name, service] of Object.entries(config.services)) {
      this.validateService(name, service);
    }
  }

  private static validateService(name: string, service: ServiceConfig): void {
    if (!service.name) {
      throw new Error(`Service ${name} must have a name field`);
    }

    if (!service.type) {
      throw new Error(
        `Service ${name} must have a type field (process or container)`,
      );
    }

    if (service.type === "process" && !("script" in service)) {
      throw new Error(`Process service ${name} must have a script field`);
    }

    if (service.type === "container" && !("image" in service)) {
      throw new Error(`Container service ${name} must have an image field`);
    }
  }

  private static validateServiceDependencies(config: ZapperConfig): void {
    for (const [name, service] of Object.entries(config.services)) {
      if (service.depends_on) {
        for (const dependency of service.depends_on) {
          if (!config.services[dependency]) {
            throw new Error(
              `Service ${name} depends on ${dependency} which is not defined`,
            );
          }
        }
      }
    }
  }
}
