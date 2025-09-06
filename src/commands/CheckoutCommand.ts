import { CommandHandler, CommandContext } from './CommandHandler';

export class CheckoutCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    
    if (!service) {
      throw new Error(
        "Branch name required: zap checkout --service <branch>",
      );
    }
    
    await zapper.gitCheckoutAll(service);
  }
}
