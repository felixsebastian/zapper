import { CliOptions, Command } from "../types";

export class CommandParser {
  static parse(args: string[]): CliOptions {
    const options: Partial<CliOptions> = {};

    // Remove node and script name from args
    const cleanArgs = args.slice(2);

    if (cleanArgs.length === 0) {
      throw new Error("No command specified. Use: zap <command> [options]");
    }

    const command = cleanArgs[0] as Command;
    if (!this.isValidCommand(command)) {
      throw new Error(
        `Invalid command: ${command}. Valid commands: up/start/s, down/stop/delete, restart, status, logs`,
      );
    }

    // Map aliases to canonical commands
    const commandAliases: Record<string, Command> = {
      // Start commands
      up: "up",
      start: "start",
      s: "start",
      // Stop commands
      down: "down",
      stop: "stop",
      delete: "stop",
      // Other commands
      restart: "restart",
      status: "status",
      logs: "logs",
    };

    options.command = commandAliases[command];

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

  private static isValidCommand(command: string): command is Command {
    // Map aliases to their canonical commands
    const commandAliases: Record<string, Command> = {
      // Start commands
      up: "up",
      start: "start",
      s: "start",
      // Stop commands
      down: "down",
      stop: "stop",
      delete: "stop",
      // Other commands
      restart: "restart",
      status: "status",
      logs: "logs",
    };

    return command in commandAliases;
  }

  static getHelp(): string {
    return `
Usage: zap <command> [options]

Commands:
  up       Start all processes or a specific process (aliases: start, s)
  down     Stop all processes or a specific process (aliases: stop, delete)
  restart  Restart all processes or a specific process
  status   Show status of all processes or a specific process
  logs     Show logs for a specific process (requires --service, supports --follow)
  start    Start a specific process (aliases: up, s)
  stop     Stop and delete a specific process (aliases: down, delete) - cleans up logs and wrapper scripts

Options:
  --service <name>  Target a specific process
  --all            Apply to all processes (default for some commands)
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
  zap status                # Show status of all processes
  zap logs --service test   # Show logs for test process
  zap logs --follow         # Follow logs for all processes
  zap logs --service test   # Show logs for test process
  zap logs --service test --follow  # Follow logs for test process
`;
  }
}
