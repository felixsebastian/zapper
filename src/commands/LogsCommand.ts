import { CommandHandler, CommandContext } from "./CommandHandler";
import { logger } from "../utils/logger";

export class LogsCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    if (!service) {
      throw new Error("Service name is required for logs command");
    }

    const follow = options.follow ?? true;
    logger.info(`Showing logs for ${service}${follow ? " (following)" : ""}`);
    await zapper.showLogs(service, follow);
  }
}
