#!/usr/bin/env node

import { CommanderCli } from "./cli";
import { logger } from "./utils/logger";

declare const process: {
  argv: string[];
  exit: (code: number) => never;
};

const cli = new CommanderCli();

async function main() {
  try {
    cli.parse(process.argv);
  } catch (error) {
    logger.error(String(error));
    process.exit(1);
  }
}

main();
