import { CommandHandler, CommandContext } from "./CommandHandler";

export class UpCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (service) {
      // Handle both single service (string) and multiple services (array)
      const services = Array.isArray(service) ? service : [service];
      await zapper.startProcesses(services);
    } else {
      await zapper.startProcesses();
    }
  }
}
