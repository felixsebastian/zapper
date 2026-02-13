import { CommandHandler, CommandContext } from "./CommandHandler";
import { getStatus } from "../core/getStatus";
import { formatStatus, formatStatusAsJson } from "../core/formatStatus";
import { logger } from "../utils/logger";

export class StatusCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;
    const all = !!options.all;
    const json = !!options.json;
    const zapperContext = zapper.getContext() || undefined;
    const statusResult = await getStatus(zapperContext, service, all);

    if (json) {
      const jsonOutput = formatStatusAsJson(statusResult);
      console.log(jsonOutput);
    } else {
      const formattedOutput = formatStatus(statusResult, zapperContext);
      logger.info(formattedOutput, { noEmoji: true });
    }
  }
}
