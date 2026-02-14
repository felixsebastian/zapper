import { CommandHandler, CommandContext } from "./CommandHandler";
import { confirm } from "../utils/confirm";
import { renderer } from "../ui/renderer";

export class ResetCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, options } = context;

    const proceed = await confirm(
      "This will stop all processes and delete the .zap folder. Continue?",
      { defaultYes: false, force: options.force },
    );
    if (!proceed) {
      renderer.log.info("Aborted.");
      return;
    }
    await zapper.reset();
  }
}
