import { CommandHandler, CommandContext } from "./CommandHandler";
import { getStatus } from "../core/getStatus";
import { renderer } from "../ui/renderer";

export class StatusCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;
    const all = !!options.all;
    const json = !!options.json;
    const zapperContext = zapper.getContext() || undefined;
    const statusResult = await getStatus(zapperContext, service, all);

    if (json) {
      renderer.machine.json(renderer.status.toJson(statusResult));
    } else {
      renderer.log.report(renderer.status.toText(statusResult, zapperContext));
    }
  }
}
