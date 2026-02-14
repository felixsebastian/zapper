import { CommandHandler, CommandContext } from "./CommandHandler";
import { logger } from "../utils/logger";

export class IsolateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;
    const instanceId = await zapper.isolateInstance();
    logger.success(`Isolation enabled with instance ID: ${instanceId}`);
  }
}
