import { CommandHandler, CommandContext } from "./CommandHandler";
import { formatTasks, formatTasksAsJson } from "../core/formatTasks";
import { logger } from "../utils/logger";

export class TaskCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    if (!service) {
      // List all available tasks
      const zapperContext = zapper.getContext();
      if (!zapperContext) {
        throw new Error("Context not loaded");
      }

      const json = !!options.json;

      if (json) {
        const jsonOutput = formatTasksAsJson(zapperContext.tasks);
        console.log(jsonOutput);
      } else {
        const formattedOutput = formatTasks(zapperContext.tasks);
        logger.info(formattedOutput, { noEmoji: true });
      }
      return;
    }

    await zapper.runTask(service);
  }
}
