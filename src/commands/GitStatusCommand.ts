import { CommandHandler, CommandContext } from "./CommandHandler";

export class GitStatusCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;

    await zapper.gitStatusAll();
  }
}
