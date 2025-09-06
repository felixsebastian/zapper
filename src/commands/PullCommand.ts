import { CommandHandler, CommandContext } from './CommandHandler';

export class PullCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;
    
    await zapper.gitPullAll();
  }
}
