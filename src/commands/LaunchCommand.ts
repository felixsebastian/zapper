import { CommandHandler, CommandContext } from "./CommandHandler";
import { logger } from "../utils/logger";
import { exec } from "child_process";

export class LaunchCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service } = context;

    if (!service) {
      throw new Error("Name is required. Usage: zap launch <name>");
    }

    const zapperContext = zapper.getContext();
    if (!zapperContext) throw new Error("Context not loaded");

    const nativeService = zapperContext.processes.find(
      (p) => p.name === service,
    );
    const dockerService = zapperContext.containers.find(
      (c) => c.name === service,
    );
    const projectLink = zapperContext.links.find((l) => l.name === service);

    const link = nativeService?.link ?? dockerService?.link ?? projectLink?.url;

    if (!link) throw new Error(`No link found for: ${service}`);

    logger.info(`Opening ${link}`);
    const openCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${openCmd} "${link}"`);
  }
}
