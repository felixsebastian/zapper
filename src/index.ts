#!/usr/bin/env node

import { CommanderCli } from "./cli";
import { logger, LogLevel } from "./utils/logger";
import { formatError } from "./errors";

declare const process: {
  argv: string[];
  exit: (code: number) => never;
};

const cli = new CommanderCli();

async function main() {
  try {
    await cli.parse(process.argv);
  } catch (error) {
    const showStackTrace = logger.getLevel() === LogLevel.DEBUG;
    const formattedError = formatError(error, showStackTrace);
    console.error(formattedError);
    process.exit(1);
  }
}

main();
