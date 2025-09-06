import { Zapper } from '../core/Zapper';
import { logger, LogLevel } from '../utils/logger';

export interface CommandContext {
  zapper: Zapper;
  service?: string;
  options: Record<string, any>;
}

export abstract class CommandHandler {
  protected async setupZapper(config?: string): Promise<Zapper> {
    const zapper = new Zapper();
    await zapper.loadConfig(config);
    return zapper;
  }

  protected configureLogging(options: Record<string, any>): void {
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (options.verbose) {
      logger.setLevel(LogLevel.INFO);
    } else if (options.quiet) {
      logger.setLevel(LogLevel.WARN);
    }
  }

  abstract execute(context: CommandContext): Promise<void>;
}
