import { CommandHandler, CommandContext } from "./CommandHandler";
import {
  formatTasks,
  formatTasksAsJson,
  formatTaskParamsAsJson,
} from "../core/formatTasks";
import { logger } from "../utils/logger";

export class TaskCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options, taskParams } = context;

    if (!service) {
      const zapperContext = zapper.getContext();
      if (!zapperContext) throw new Error("Context not loaded");

      if (options.json) {
        console.log(formatTasksAsJson(zapperContext.tasks));
      } else {
        logger.info(formatTasks(zapperContext.tasks), { noEmoji: true });
      }
      return;
    }

    // Handle --list-params option
    if (options.listParams) {
      const zapperContext = zapper.getContext();
      if (!zapperContext) throw new Error("Context not loaded");

      const task = zapperContext.tasks.find((t) => t.name === service);
      if (!task) throw new Error(`Task not found: ${service}`);

      const output = formatTaskParamsAsJson(task, zapperContext.taskDelimiters);
      console.log(output);
      return;
    }

    await zapper.runTask(service, taskParams);
  }
}
