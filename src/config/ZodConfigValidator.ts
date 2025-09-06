import { existsSync } from "fs";
import { ZapperConfigSchema, ZapperConfig } from "./schemas";
import { ZodError } from "zod";

export class ZodConfigValidator {
  static validate(config: unknown): ZapperConfig {
    try {
      const validatedConfig = ZapperConfigSchema.parse(config);
      this.autoPopulateNames(validatedConfig);
      this.validateEnvFiles(validatedConfig);
      return validatedConfig;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map((err) => {
          const path = err.path.length > 0 ? `${err.path.join(".")}: ` : "";
          return `${path}${err.message}`;
        });

        throw new Error(
          `Configuration validation failed: ${errorMessages.join(", ")}`,
        );
      }

      if (error instanceof Error) {
        throw new Error(`Configuration validation failed: ${error.message}`);
      }

      throw new Error(`Configuration validation failed: ${String(error)}`);
    }
  }

  private static autoPopulateNames(config: ZapperConfig): void {
    if (config.bare_metal) {
      for (const [name, proc] of Object.entries(config.bare_metal)) {
        if (!proc.name) {
          proc.name = name;
        }
      }
    }

    if (config.docker) {
      for (const [name, container] of Object.entries(config.docker)) {
        if (!container.name) {
          container.name = name;
        }
      }
    }

    if (config.containers) {
      for (const [name, container] of Object.entries(config.containers)) {
        if (!container.name) {
          container.name = name;
        }
      }
    }

    if (config.tasks) {
      for (const [name, task] of Object.entries(config.tasks)) {
        if (!task.name) {
          task.name = name;
        }
      }
    }
  }

  private static validateEnvFiles(config: ZapperConfig): void {
    if (config.env_files) {
      for (const filePath of config.env_files) {
        if (!existsSync(filePath)) {
          throw new Error(`Env file does not exist: ${filePath}`);
        }
      }
    }
  }
}
