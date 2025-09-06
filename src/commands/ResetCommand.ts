import { CommandHandler, CommandContext } from './CommandHandler';
import { confirm } from '../utils/confirm';
import { logger } from '../utils/logger';

export class ResetCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, options } = context;
    
    const proceed = await confirm(
      "This will stop all processes and delete the .zap folder. Continue?",
      { defaultYes: false, force: options.force },
    );
    if (!proceed) {
      logger.info("Aborted.");
      return;
    }
    await zapper.reset();
  }
}
