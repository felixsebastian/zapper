#!/usr/bin/env node

import { CommandParser } from "./cli/command-parser";

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
    console.log("Zapper CLI - Configuration loaded successfully");
    console.log(`Command: ${options.command}`);
    if (options.service) {
      console.log(`Service: ${options.service}`);
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
