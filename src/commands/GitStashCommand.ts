import { CommandHandler, CommandContext } from "./CommandHandler";

export class GitStashCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper } = context;

    await zapper.gitStashAll();
  }
}
