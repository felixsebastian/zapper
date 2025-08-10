#!/usr/bin/env node

import { CommandParser } from "./cli/command-parser";
import { Zapper } from "./core/zapper";
import { logger, LogLevel } from "./utils/logger";
import { confirm } from "./utils/prompt";
import { Pm2Manager } from "./process/pm2-manager";

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
        if (options.service) await zapper.startProcesses([options.service]);
        else await zapper.startProcesses();
        break;

      case "down":
        if (options.service) {
          await zapper.stopProcesses([options.service]);
        } else {
          const proceed = await confirm(
            "This will stop all bare metal processes. Continue?",
            { defaultYes: false, force: options.force },
          );
          if (!proceed) {
            logger.info("Aborted.");
            return;
          }
          await zapper.stopProcesses();
        }
        break;

      case "restart":
        if (options.service) await zapper.restartProcesses([options.service]);
        else await zapper.restartProcesses();
        break;

      case "status": {
        const project = zapper.getProject();
        const all = !!options.all;
        const pm2List = await Pm2Manager.listProcesses();

        // PM2 names are like zap.<project>.<service>
        const filtered = pm2List.filter((p) => {
          if (all || !project) return true;
          return p.name.startsWith(`zap.${project}.`);
        });

        const byService = filtered
          .map((p) => ({
            rawName: p.name,
            service: p.name.split(".").pop() || p.name,
            status: p.status,
            cpu: p.cpu,
            mem: p.memory,
            restarts: p.restarts,
          }))
          .filter((p) =>
            !options.service ? true : p.service === options.service,
          );

        const emojiFor = (status: string) => {
          const s = status.toLowerCase();
          if (s === "online") return "🟢";
          if (s === "stopped" || s === "stopping") return "🛑";
          if (s === "errored" || s === "error") return "🔴";
          if (s === "launching") return "🟡";
          if (s === "waiting restart") return "🟠";
          return "⚪️";
        };

        if (byService.length === 0) {
          logger.info("No processes found");
          break;
        }

        logger.info(
          "Status:\n" +
            byService
              .map((p) => `${emojiFor(p.status)}  ${p.service}  ${p.status}`)
              .join("\n"),
        );
        break;
      }

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

      case "reset": {
        const proceed = await confirm(
          "This will stop all processes and delete the .zap folder. Continue?",
          { defaultYes: false, force: options.force },
        );
        if (!proceed) {
          logger.info("Aborted.");
          return;
        }
        await zapper.reset();
        break;
      }

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
