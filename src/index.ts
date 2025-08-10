#!/usr/bin/env node

import { CommandParser } from "./cli/command-parser";
import { Zapper } from "./core/zapper";
import { logger, LogLevel } from "./utils/logger";

declare const process: {
  argv: string[];
  exit: (code: number) => never;
};

async function main() {
  try {
    const options = CommandParser.parse(process.argv);

    // Configure logging based on CLI options
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (options.verbose) {
      logger.setLevel(LogLevel.INFO);
    } else if (options.quiet) {
      logger.setLevel(LogLevel.WARN);
    }

    const zapper = new Zapper();

    // Load config
    await zapper.loadConfig(options.config);

    switch (options.command) {
      case "up":
        if (options.service) {
          logger.info(`Starting bare metal process ${options.service}`);
          await zapper.startProcesses([options.service]);
        } else {
          logger.info("Starting all bare metal processes");
          await zapper.startProcesses();
        }
        break;

      case "down":
        if (options.service) {
          logger.info(`Stopping bare metal process ${options.service}`);
          await zapper.stopProcesses([options.service]);
        } else {
          logger.info("Stopping all bare metal processes");
          await zapper.stopProcesses();
        }
        break;

      case "restart":
        if (options.service) {
          logger.info(`Restarting bare metal process ${options.service}`);
          await zapper.restartProcesses([options.service]);
        } else {
          logger.info("Restarting all bare metal processes");
          await zapper.restartProcesses();
        }
        break;

      case "status": {
        const processes = await zapper.getProcessStatus(options.service);
        logger.info("Process status");
        for (const process of processes) {
          logger.debug(`${process.name}: ${process.cmd}`);
        }
        break;
      }

      case "start":
        if (!options.service) {
          throw new Error("Process name required for start command");
        }
        logger.info(`Starting bare metal process ${options.service}`);
        await zapper.startProcesses([options.service]);
        break;

      case "stop":
        if (!options.service) {
          throw new Error("Process name required for stop command");
        }
        logger.info(`Stopping bare metal process ${options.service}`);
        await zapper.stopProcesses([options.service]);
        break;

      case "logs":
        if (!options.service) {
          throw new Error(
            "Service name required for logs command. Use: zap logs --service <name>",
          );
        }
        logger.info(
          `Showing logs for ${options.service}${options.follow ? " (following)" : ""}`,
        );
        await zapper.showLogs(options.service, options.follow);
        break;

      default:
        throw new Error(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    logger.error("Error:", error);
    process.exit(1);
  }
}

// Handle help command
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  logger.info(CommandParser.getHelp());
  process.exit(0);
}

main();
