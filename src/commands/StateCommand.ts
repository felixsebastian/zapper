import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";

export class StateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    renderer.machine.json(zapperContext.state);
  }
}
