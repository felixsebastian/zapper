import { CommandHandler, CommandContext } from "./CommandHandler";

export class DownCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (service) {
      // Handle both single service (string) and multiple services (array)
      const services = Array.isArray(service) ? service : [service];
      await zapper.stopProcesses(services);
    } else {
      await zapper.stopProcesses();
    }
  }
}
