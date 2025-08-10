import { CliOptions, Command } from "../types";

export class CommandParser {
  static parse(args: string[]): CliOptions {
    const options: Partial<CliOptions> = {};

    // Remove node and script name from args
    const cleanArgs = args.slice(2);

    if (cleanArgs.length === 0) {
      throw new Error("No command specified. Use: zap <command> [options]");
    }

    const command = cleanArgs[0] as string;
    if (!this.isValidCommand(command)) {
      throw new Error(
        `Invalid command: ${command}. Valid commands: up/start/s, down/stop/delete, restart, status, logs, reset`,
      );
    }

    // Preserve invoked string and resolve canonical
    options.invoked = command;
    options.command = this.aliasToCanonical[command] as Command;

    // Parse remaining arguments
    for (let i = 1; i < cleanArgs.length; i++) {
      const arg = cleanArgs[i];

      if (arg.startsWith("--")) {
        const [key, value] = arg.slice(2).split("=");

        switch (key) {
          case "service":
            options.service = value || cleanArgs[++i];
            break;
          case "all":
            options.all = true;
            break;
          case "force":
            options.force = true;
            break;
          case "follow":
            options.follow = true;
            break;
          case "config":
            options.config = value || cleanArgs[++i];
            break;
          case "verbose":
          case "v":
            options.verbose = true;
            break;
          case "quiet":
            options.quiet = true;
            break;
          case "debug":
            options.debug = true;
            break;
          default:
            throw new Error(`Unknown option: --${key}`);
        }
      } else if (arg.startsWith("-")) {
        const flags = arg.slice(1).split("");

        for (const flag of flags) {
          switch (flag) {
            case "a":
              options.all = true;
              break;
            case "f":
              options.force = true;
              break;
            case "F":
              options.follow = true;
              break;
            case "v":
              options.verbose = true;
              break;
            case "q":
              options.quiet = true;
              break;
            case "d":
              options.debug = true;
              break;
            default:
              throw new Error(`Unknown flag: -${flag}`);
          }
        }
      } else if (!options.service) {
        options.service = arg;
      }
    }

    return options as CliOptions;
  }

  private static readonly canonicalToAliases = {
    // Start
    up: ["start", "s"],
    // Stop
    down: ["stop", "delete"],
    // Other
    restart: [],
    status: [],
    logs: [],
    reset: [],
  } as const;

  private static readonly aliasToCanonical: Record<string, Command> = (() => {
    const map: Record<string, Command> = {};
    for (const [canonical, aliases] of Object.entries(
      this.canonicalToAliases,
    )) {
      map[canonical] = canonical as Command;
      for (const alias of aliases) map[alias] = canonical as Command;
    }
    return map;
  })();

  private static isValidCommand(command: string): command is Command {
    return command in this.aliasToCanonical;
  }

  static getHelp(): string {
    return `
Usage: zap <command> [options]

Commands:
  up       Start all processes or a specific process (aliases: start, s)
  down     Stop all processes or a specific process (aliases: stop, delete)
  restart  Restart all processes or a specific process
  status   Show status from PM2 (filters to current project by default)
  logs     Show logs for a specific process (requires --service, supports --follow)
  reset    Stop all processes and delete the .zap directory

Options:
  --service <name>  Target a specific process
  --all            Include processes from all projects (for status)
  --force          Force the operation
  --follow         Follow logs (for logs command)
  --config <file>  Use a specific config file (default: zap.yaml)
  --verbose, -v    Increase logging verbosity
  --quiet, -q      Reduce logging output
  --debug, -d      Enable debug logging

Examples:
  zap up                    # Start all processes
  zap start                 # Same as zap up
  zap s                     # Same as zap up
  zap up --service test     # Start only the test process
  zap down --all            # Stop all processes
  zap stop                  # Same as zap down
  zap delete                # Same as zap down
  zap status                # Show status for current project processes
  zap status --all          # Show status for all PM2 processes
  zap logs --service test   # Show logs for test process
  zap logs --service test --follow  # Follow logs for test process
  zap reset --force         # Stop all processes and remove .zap without prompt
`;
  }
}
