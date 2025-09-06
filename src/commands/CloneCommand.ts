import { CommandHandler, CommandContext } from './CommandHandler';

export class CloneCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    
    await zapper.cloneRepos(
      service ? [service] : undefined,
    );
  }
}
