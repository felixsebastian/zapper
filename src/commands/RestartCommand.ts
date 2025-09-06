import { CommandHandler, CommandContext } from './CommandHandler';

export class RestartCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    
    if (service) {
      await zapper.restartProcesses([service]);
    } else {
      await zapper.restartProcesses();
    }
  }
}
