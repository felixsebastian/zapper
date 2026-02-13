import { CommandHandler, CommandContext } from "./CommandHandler";
import {
  formatEnvironments,
  formatEnvironmentsAsJson,
} from "../core/formatEnvironments";
import { logger } from "../utils/logger";
import { StateManager } from "../core/StateManager";
import { Context } from "../types/Context";

export class EnvCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    const environments = zapperContext.environments;

    // Environment management flags
    if (options.disable) {
      const stateManager = new StateManager(
        zapper,
        zapperContext.projectRoot,
        options.config,
      );
      await this.disableEnvironment(
        stateManager,
        zapperContext.state.activeEnvironment,
      );
      return;
    }

    if (options.list) {
      const json = !!options.json;
      if (json) {
        const jsonOutput = formatEnvironmentsAsJson(environments);
        console.log(jsonOutput);
      } else {
        const formattedOutput = formatEnvironments(environments);
        logger.info(formattedOutput, { noEmoji: true });
      }
      return;
    }

    const forcedService = options.service as string | undefined;
    const targetName = forcedService || service;

    if (targetName) {
      const isEnvironment = environments.includes(targetName);
      const resolvedServiceName = forcedService
        ? zapper.resolveServiceName(targetName)
        : isEnvironment
          ? targetName
          : zapper.resolveServiceName(targetName);
      const hasService = this.serviceExists(zapperContext, resolvedServiceName);

      if (forcedService) {
        await this.showServiceEnv(zapperContext, resolvedServiceName, options);
        return;
      }

      if (isEnvironment && hasService) {
        throw new Error(
          `Ambiguous name: '${targetName}' matches both a service and an environment. Use --service ${targetName} to view env vars or choose a different environment name.`,
        );
      }

      if (isEnvironment) {
        const stateManager = new StateManager(
          zapper,
          zapperContext.projectRoot,
          options.config,
        );
        await this.enableEnvironment(stateManager, targetName);
        return;
      }

      if (hasService) {
        await this.showServiceEnv(zapperContext, resolvedServiceName, options);
        return;
      }

      throw new Error(
        `Not found: ${targetName}. Available environments: ${environments.join(", ")}`,
      );
    }

    await this.showInteractivePicker(
      environments,
      zapperContext.state.activeEnvironment,
    );
  }

  private serviceExists(context: Context, serviceName: string): boolean {
    return (
      context.processes.some((p) => p.name === serviceName) ||
      context.containers.some((c) => c.name === serviceName)
    );
  }

  private async showServiceEnv(
    zapperContext: Context,
    serviceName: string,
    options: Record<string, unknown>,
  ): Promise<void> {
    const process = zapperContext.processes.find((p) => p.name === serviceName);
    const container = zapperContext.containers.find(
      (c) => c.name === serviceName,
    );
    const target = process || container;

    if (!target) {
      throw new Error(`Service '${serviceName}' not found`);
    }

    const resolvedEnv = target.resolvedEnv || {};

    if (options.json) {
      console.log(JSON.stringify(resolvedEnv));
    } else {
      for (const [key, value] of Object.entries(resolvedEnv)) {
        console.log(`${key}=${value}`);
      }
    }
  }

  private async enableEnvironment(
    stateManager: StateManager,
    environmentName: string,
  ): Promise<void> {
    logger.info(`Enabling environment: ${environmentName}`);

    await stateManager.setActiveEnvironment(environmentName);

    logger.info(
      "Environment updated. Restart services to apply new environment variables.",
    );
  }

  private async disableEnvironment(
    stateManager: StateManager,
    currentActiveEnvironment?: string,
  ): Promise<void> {
    if (!currentActiveEnvironment) {
      logger.info("No active environment to disable");
      return;
    }

    logger.info(`Disabling active environment: ${currentActiveEnvironment}`);

    await stateManager.clearActiveEnvironment();

    logger.info(
      "Environment reset to default. Restart services to apply new environment variables.",
    );
  }

  private async showInteractivePicker(
    environments: string[],
    activeEnvironment?: string,
  ): Promise<void> {
    if (environments.length === 0) {
      logger.info("No environments defined");
      return;
    }

    if (activeEnvironment) {
      logger.info(`Currently active environment: ${activeEnvironment}`);
      logger.info("");
    }

    logger.info("Available environments:");
    environments.forEach((environment, index) => {
      const isActive = environment === activeEnvironment;
      const marker = isActive ? " (active)" : "";
      logger.info(`  ${index + 1}. ${environment}${marker}`);
    });
    logger.info("\nTo enable an environment, use: zap env <name>");
  }
}
