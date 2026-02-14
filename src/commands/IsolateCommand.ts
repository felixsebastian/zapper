import { CommandHandler, CommandContext } from "./CommandHandler";
import { CommandResult } from "./CommandResult";

export class IsolateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<CommandResult> {
    const { zapper, service } = context;
    const instanceId = await zapper.isolateInstance(service);
    return {
      kind: "isolation.enabled",
      instanceId,
    };
  }
}
