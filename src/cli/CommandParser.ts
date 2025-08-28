import { CliOptions, Command } from "../utils";

export class CommandParser {
  static parse(args: string[]): CliOptions {
    const options: Partial<CliOptions> = {};
    const cleanArgs = args.slice(2);
    if (cleanArgs.length === 0) throw new Error("No command specified.");
    const command = cleanArgs[0] as string;
    if (!this.isValidCommand(command)) throw new Error(`Invalid command.`);
    options.invoked = command;
    options.command = this.aliasToCanonical[command] as Command;

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
          case "no-follow":
            options.follow = false;
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
            case "y":
              options.force = true;
              break;
            case "f":
              options.follow = true;
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
    up: ["start", "s", "u"],
    down: ["stop", "delete"],
    restart: ["r"],
    status: ["ps"],
    logs: ["l"],
    reset: [],
    clone: [],
    task: ["t"],
    checkout: ["co"],
    pull: [],
    gitstatus: ["gs"],
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
  up         Start all processes or a specific process (aliases: start, s)
  down       Stop all processes or a specific process (aliases: stop, delete)
  restart    Restart all processes or a specific process
  status     Show status (PM2 + Docker) filtered to current project by default
  logs       Show logs for a specific process (requires --service, follows by default)
  reset      Stop all processes and delete the .zap directory
  clone      Clone all repos defined in bare_metal services (respects git_method)
  task       Run a one-off task by name (alias: t)
  checkout   Switch all bare_metal repos to the given branch (alias: co)
  pull       Pull latest for all bare_metal repos
  gitstatus  List branch and dirty/clean for all bare_metal repos (alias: gs)

Options:
  --service <name>  Target a specific process or task (for checkout, branch name)
  --all            Include processes from all projects (for status)
  --force, -y      Force the operation
  --follow, -f     Follow logs (default)
  --no-follow      Do not follow logs (print and exit)
  --config <file>  Use a specific config file (default: zap.yaml)
  --verbose, -v    Increase logging verbosity
  --quiet, -q      Reduce logging output
  --debug, -d      Enable debug logging
`;
  }
}
