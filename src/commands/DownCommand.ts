import { CommandHandler, CommandContext } from './CommandHandler';
import { confirm } from '../utils/confirm';
import { logger } from '../utils/logger';

export class DownCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;
    
    if (service) {
      await zapper.stopProcesses([service]);
    } else {
      const proceed = await confirm(
        "This will stop all bare metal processes. Continue?",
        { defaultYes: false, force: options.force },
      );
      if (!proceed) {
        logger.info("Aborted.");
        return;
      }
      await zapper.stopProcesses();
    }
  }
}
