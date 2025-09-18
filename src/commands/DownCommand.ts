import { CommandHandler, CommandContext } from "./CommandHandler";

export class DownCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (service) {
      await zapper.stopProcesses([service]);
    } else {
      await zapper.stopProcesses();
    }
  }
}
