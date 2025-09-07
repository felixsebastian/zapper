import { CommandHandler, CommandContext } from "./CommandHandler";

export class UpCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (service) {
      await zapper.startProcesses([service]);
    } else {
      await zapper.startProcesses();
    }
  }
}
