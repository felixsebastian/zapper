import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";
import { exec } from "child_process";

export class LaunchCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service: name } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) throw new Error("Context not loaded");

    const link = name
      ? zapperContext.links.find((l) => l.name === name)?.url
      : zapperContext.homepage;

    if (!link) {
      if (name) throw new Error(`No link found for: ${name}`);
      throw new Error(
        "No homepage configured. Set `homepage` in zap.yaml or provide a link name: zap launch <name>",
      );
    }

    renderer.log.info(`Opening ${link}`);
    const openCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${openCmd} "${link}"`);
  }
}
