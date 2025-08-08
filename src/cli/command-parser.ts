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
        `Invalid command: ${command}. Valid commands: up, down, restart, status, logs, stop, start`,
      );
    }

    options.command = command;

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
    const validCommands: Command[] = [
      "up",
      "down",
      "restart",
      "status",
      "logs",
      "stop",
      "start",
    ];
    return validCommands.includes(command as Command);
  }

  static getHelp(): string {
    return `
Usage: zap <command> [options]

Commands:
  up       Start all services or a specific service
  down     Stop all services or a specific service
  restart  Restart all services or a specific service
  status   Show status of all services or a specific service
  logs     Show logs for all services or a specific service
  stop     Stop a specific service
  start    Start a specific service

Options:
  --service <name>  Target a specific service
  --all            Apply to all services (default for some commands)
  --force          Force the operation
  --follow         Follow logs (for logs command)
  --config <file>  Use a specific config file (default: zap.yaml)

Examples:
  zap up                    # Start all services
  zap up --service api      # Start only the api service
  zap down --all            # Stop all services
  zap status                # Show status of all services
  zap logs --service api    # Show logs for api service
  zap logs --follow         # Follow logs for all services
`;
  }
}
