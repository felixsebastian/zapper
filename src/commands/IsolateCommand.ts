import { CommandHandler, CommandContext } from "./CommandHandler";
import { logger } from "../utils/logger";

export class IsolateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    const instanceId = await zapper.isolateInstance(service);
    logger.success(`Isolation enabled with instance ID: ${instanceId}`);
  }
}
