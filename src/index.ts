#!/usr/bin/env node

import { CommandParser } from "./cli/command-parser";
import { Zapper } from "./core/zapper";

declare const process: {
  argv: string[];
  exit: (code: number) => never;
};

declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

async function main() {
  try {
    const options = CommandParser.parse(process.argv);
    const zapper = new Zapper();

    // Load config
    await zapper.loadConfig(options.config);

    switch (options.command) {
      case "up":
        if (options.service) {
          await zapper.startProcesses([options.service]);
        } else {
          await zapper.startProcesses();
        }
        break;

      case "down":
        if (options.service) {
          await zapper.stopProcesses([options.service]);
        } else {
          await zapper.stopProcesses();
        }
        break;

      case "restart":
        if (options.service) {
          await zapper.restartProcesses([options.service]);
        } else {
          await zapper.restartProcesses();
        }
        break;

      case "status": {
        const processes = await zapper.getProcessStatus(options.service);
        console.log("\n📊 Process Status:");
        console.log("─".repeat(50));

        for (const process of processes) {
          console.log(`📋 ${process.name}: ${process.cmd}`);
        }
        break;
      }

      case "start":
        if (!options.service) {
          throw new Error("Process name required for start command");
        }
        await zapper.startProcesses([options.service]);
        break;

      case "stop":
        if (!options.service) {
          throw new Error("Process name required for stop command");
        }
        await zapper.stopProcesses([options.service]);
        break;

      case "logs":
        console.log("📋 Logs command not yet implemented");
        break;

      default:
        throw new Error(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Handle help command
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(CommandParser.getHelp());
  process.exit(0);
}

main();
