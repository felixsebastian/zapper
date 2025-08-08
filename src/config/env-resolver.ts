import { ZapperConfig } from "../types";

export class EnvResolver {
  static resolve(config: ZapperConfig): ZapperConfig {
    const resolvedConfig = { ...config };

    // Resolve process-specific environment variables
    for (const process of resolvedConfig.processes) {
      if (process.env) {
        process.env = this.interpolateEnvVars(process.env);
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

  static getProcessEnv(
    processName: string,
    config: ZapperConfig,
  ): Record<string, string> {
    const process = config.processes.find((p) => p.name === processName);
    if (!process) {
      throw new Error(`Process ${processName} not found`);
    }

    return process.env || {};
  }
}
