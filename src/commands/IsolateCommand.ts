import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";

export class IsolateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    const instanceId = await zapper.isolateInstance(service);
    renderer.isolation.printEnabled(instanceId);
  }
}
