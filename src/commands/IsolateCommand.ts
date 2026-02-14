import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";

export class IsolateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;
    const instanceId = await zapper.isolateInstance(service);
    renderer.log.success(`Isolation enabled with instance ID: ${instanceId}`);
  }
}
