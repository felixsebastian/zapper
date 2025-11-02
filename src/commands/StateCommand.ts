import { CommandHandler, CommandContext } from "./CommandHandler";

export class StateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    // Pretty print the state JSON
    console.log(JSON.stringify(zapperContext.state, null, 2));
  }
}
