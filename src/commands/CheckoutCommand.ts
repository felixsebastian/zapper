import { CommandHandler, CommandContext } from "./CommandHandler";
import { CommandResult } from "./CommandResult";

export class CheckoutCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<CommandResult> {
    const { zapper, service } = context;

    if (!service) {
      throw new Error("Branch name required: zap checkout --service <branch>");
    }

    await zapper.gitCheckoutAll(service);
    return {
      kind: "git.checkout.completed",
      branch: service,
    };
  }
}
