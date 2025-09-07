import { CommandHandler, CommandContext } from "./CommandHandler";
import { getStatus } from "../core/getStatus";
import { formatStatus } from "../core/formatStatus";
import { logger } from "../utils/logger";

export class StatusCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;
    const project = zapper.getProject();
    const all = !!options.all;
    const statusResult = await getStatus(project, service, all);
    const formattedOutput = formatStatus(statusResult);
    logger.info(formattedOutput);
  }
}
