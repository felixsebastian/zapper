import { CommandHandler, CommandContext } from "./CommandHandler";

export class TaskCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (!service) {
      throw new Error("Task name is required for task command");
    }

    await zapper.runTask(service);
  }
}
