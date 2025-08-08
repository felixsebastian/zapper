import { ZapperConfig } from "../types";

export class EnvResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    const resolvedConfig = { ...config };

    // Resolve global environment variables
    if (resolvedConfig.environment) {
      resolvedConfig.environment = this.interpolateEnvVars(
        resolvedConfig.environment,
      );
    }

    // Resolve service-specific environment variables
    for (const [, service] of Object.entries(resolvedConfig.services)) {
      if (service.env) {
        service.env = this.interpolateEnvVars(service.env);
      }

      if ("environment" in service && service.environment) {
        service.environment = this.interpolateEnvVars(
          service.environment as Record<string, string>,
        );
      }
    }

    return resolvedConfig;
  }

  private static interpolateEnvVars(
    env: Record<string, string>,
  ): Record<string, string> {
    const resolved: Record<string, string> = {} as Record<string, string>;

    for (const [key, value] of Object.entries(env)) {
      resolved[key] = this.interpolateString(value);
    }

    return resolved;
  }

  private static interpolateString(str: string): string {
    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
      const envValue = globalThis.process?.env?.[varName];
      if (envValue === undefined) {
        throw new Error(`Environment variable ${varName} is not defined`);
      }
      return envValue;
    });
  }

  static getServiceEnv(
    serviceName: string,
    config: ZapperConfig,
  ): Record<string, string> {
    const service = config.services[serviceName];
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }

    const env: Record<string, string> = {} as Record<string, string>;

    // Add global environment variables
    if (config.environment) {
      Object.assign(env, config.environment);
    }

    // Add service-specific environment variables
    if (service.env) {
      Object.assign(env, service.env);
    }

    // Add container-specific environment variables
    if ("environment" in service && service.environment) {
      Object.assign(env, service.environment as Record<string, string>);
    }

    return env;
  }
}
