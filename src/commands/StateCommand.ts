import { CommandHandler, CommandContext } from "./CommandHandler";

export class StateCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    // Output the state JSON in minified format
    console.log(JSON.stringify(zapperContext.state));
  }
}
