import { CommandHandler, CommandContext } from "./CommandHandler";

export class EnvCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    if (!service) {
      throw new Error("Service name is required. Usage: zap env <service>");
    }

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    const process = zapperContext.processes.find((p) => p.name === service);
    const container = zapperContext.containers.find((c) => c.name === service);
    const target = process || container;

    if (!target) {
      throw new Error(`Service '${service}' not found`);
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
}





