import { YamlParser } from "../config/yaml-parser";
import { ConfigValidator } from "../config/config-validator";
import { EnvResolver } from "../config/env-resolver";
import { ZapperConfig, ServiceStatus } from "../types";

declare const console: {
  log: (...args: unknown[]) => void;
};

export class Zapper {
  private config: ZapperConfig | null = null;

  async loadConfig(configPath: string = "zap.yaml"): Promise<void> {
    try {
      this.config = YamlParser.parse(configPath);
      ConfigValidator.validate(this.config);
      this.config = EnvResolver.resolve(this.config);
    } catch (error) {
      throw new Error(`Failed to load config: ${error}`);
    }
  }

  async startServices(): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    console.log("Starting services...");
  }

  async stopServices(): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    console.log("Stopping services...");
  }

  async restartServices(): Promise<void> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }
    console.log("Restarting services...");
  }

  async getServiceStatus(serviceName?: string): Promise<ServiceStatus[]> {
    if (!this.config) {
      throw new Error("Config not loaded");
    }

    const servicesToCheck = serviceName
      ? [serviceName]
      : Object.keys(this.config.services);
    const statuses: ServiceStatus[] = [];

    for (const name of servicesToCheck) {
      const service = this.config.services[name];
      if (!service) continue;

      statuses.push({
        name,
        status: "stopped",
      });
    }

    return statuses;
  }
}
