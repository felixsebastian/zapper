import { Command } from "commander";
import { Command as ZapCommand } from "../types/index";
import { Zapper } from "../core/Zapper";
import { logger, LogLevel } from "../utils/logger";
import {
  UpCommand,
  DownCommand,
  RestartCommand,
  StatusCommand,
  LogsCommand,
  ResetCommand,
  CloneCommand,
  TaskCommand,
  ProfilesCommand,
  StateCommand,
  CheckoutCommand,
  PullCommand,
  GitStatusCommand,
  ConfigCommand,
  EnvCommand,
  CommandContext,
  CommandHandler,
  TaskParams,
} from "../commands";
import packageJson from "../../package.json";

function parseTaskArgs(rawArgv: string[], taskName: string): TaskParams {
  const named: Record<string, string> = {};
  const rest: string[] = [];

  // Find the position of the task command and task name in raw argv
  const taskIdx = rawArgv.findIndex((arg) => arg === "task" || arg === "t");
  if (taskIdx === -1) return { named, rest };

  // Get everything after the task name
  const taskNameIdx = rawArgv.indexOf(taskName, taskIdx);
  if (taskNameIdx === -1) return { named, rest };

  const argsAfterTask = rawArgv.slice(taskNameIdx + 1);

  // Find the -- separator in raw args
  const separatorIdx = argsAfterTask.indexOf("--");
  const namedArgs = separatorIdx >= 0 ? argsAfterTask.slice(0, separatorIdx) : argsAfterTask;
  const restArgs = separatorIdx >= 0 ? argsAfterTask.slice(separatorIdx + 1) : [];

  // Parse named args
  for (const arg of namedArgs) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const value = arg.slice(eqIdx + 1);
        named[key] = value;
      } else {
        const key = arg.slice(2);
        named[key] = "true";
      }
    }
  }

  rest.push(...restArgs);
  return { named, rest };
}

export class CommanderCli {
  private program: Command;
  private commandHandlers: Map<ZapCommand, CommandHandler> = new Map();

  constructor() {
    this.program = new Command();
    this.setupCommandHandlers();
    this.setupProgram();
  }

  private setupCommandHandlers(): void {
    this.commandHandlers.set("up", new UpCommand());
    this.commandHandlers.set("down", new DownCommand());
    this.commandHandlers.set("restart", new RestartCommand());
    this.commandHandlers.set("status", new StatusCommand());
    this.commandHandlers.set("logs", new LogsCommand());
    this.commandHandlers.set("reset", new ResetCommand());
    this.commandHandlers.set("clone", new CloneCommand());
    this.commandHandlers.set("task", new TaskCommand());
    this.commandHandlers.set("profile", new ProfilesCommand());
    this.commandHandlers.set("state", new StateCommand());
    this.commandHandlers.set("checkout", new CheckoutCommand());
    this.commandHandlers.set("pull", new PullCommand());
    this.commandHandlers.set("gitstatus", new GitStatusCommand());
    this.commandHandlers.set("config", new ConfigCommand());
    this.commandHandlers.set("env", new EnvCommand());
  }

  private setupProgram(): void {
    this.program
      .name("zap")
      .description("Lightweight dev environment runner")
      .version(packageJson.version);

    this.program
      .option("--config <file>", "Use a specific config file", "zap.yaml")
      .option("-v, --verbose", "Increase logging verbosity")
      .option("-q, --quiet", "Reduce logging output")
      .option("-d, --debug", "Enable debug logging");

    this.program
      .command("up")
      .alias("start")
      .alias("s")
      .alias("u")
      .description("Start all processes or a specific process")
      .argument("[service]", "Service to start")
      .action(async (service, options, command) => {
        await this.executeCommand("up", service, command);
      });

    this.program
      .command("down")
      .alias("stop")
      .alias("delete")
      .description("Stop all processes or a specific process")
      .argument("[service]", "Service to stop")
      .option("-y, --force", "Force the operation")
      .action(async (service, options, command) => {
        await this.executeCommand("down", service, command);
      });

    this.program
      .command("restart")
      .alias("r")
      .description("Restart all processes or a specific process")
      .argument("[service]", "Service to restart")
      .action(async (service, options, command) => {
        await this.executeCommand("restart", service, command);
      });

    this.program
      .command("status")
      .alias("ps")
      .description(
        "Show status (PM2 + Docker) filtered to current project by default",
      )
      .argument("[service]", "Service to show status for")
      .option("-a, --all", "Include processes from all projects")
      .option("-j, --json", "Output status as minified JSON")
      .action(async (service, options, command) => {
        await this.executeCommand("status", service, command);
      });

    this.program
      .command("logs")
      .alias("l")
      .description("Show logs for a specific process")
      .argument("<service>", "Service to show logs for")
      .option("-f, --follow", "Follow logs (default)", true)
      .option("--no-follow", "Do not follow logs (print and exit)")
      .action(async (service, options, command) => {
        await this.executeCommand("logs", service, command);
      });

    this.program
      .command("reset")
      .description("Stop all processes and delete the .zap directory")
      .option("-y, --force", "Force the operation")
      .action(async (options, command) => {
        await this.executeCommand("reset", undefined, command);
      });

    this.program
      .command("clone")
      .description(
        "Clone all repos defined in native services (respects git_method)",
      )
      .argument("[service]", "Service to clone")
      .option(
        "--http",
        "Use HTTP for git cloning (overrides config git_method)",
      )
      .option("--ssh", "Use SSH for git cloning (overrides config git_method)")
      .action(async (service, options, command) => {
        await this.executeCommand("clone", service, command);
      });

    this.program
      .command("task")
      .alias("t")
      .description(
        "Run a one-off task by name, or list all tasks if no task specified",
      )
      .argument("[task]", "Task name to run")
      .option("-j, --json", "Output task list as minified JSON")
      .option("--list-params", "List parameters for the specified task")
      .allowUnknownOption()
      .allowExcessArguments()
      .action(async (task, options, command) => {
        await this.executeCommand("task", task, command);
      });

    this.program
      .command("profile")
      .alias("p")
      .description(
        "Manage profiles: show interactive picker, enable a profile, list all profiles, or disable active profile",
      )
      .argument("[profile]", "Profile name to enable")
      .option("--list", "List all available profiles")
      .option("--disable", "Disable the currently active profile")
      .option(
        "-j, --json",
        "Output profile list as minified JSON (use with --list)",
      )
      .action(async (profile, options, command) => {
        await this.executeCommand("profile", profile, command);
      });

    this.program
      .command("state")
      .description("Show the current state JSON")
      .action(async (options, command) => {
        await this.executeCommand("state", undefined, command);
      });

    this.program
      .command("checkout")
      .alias("co")
      .description("Switch all native repos to the given branch")
      .requiredOption("--service <branch>", "Branch name")
      .action(async (options, command) => {
        await this.executeCommand("checkout", options.service, command);
      });

    this.program
      .command("pull")
      .description("Pull latest for all native repos")
      .action(async (options, command) => {
        await this.executeCommand("pull", undefined, command);
      });

    this.program
      .command("gitstatus")
      .alias("gs")
      .description("List branch and dirty/clean for all native repos")
      .action(async (options, command) => {
        await this.executeCommand("gitstatus", undefined, command);
      });

    this.program
      .command("config")
      .description("Show the processed config object as minified JSON")
      .option(
        "--show-envs",
        "Include environment variable configurations in output",
      )
      .option("--pretty", "Format JSON output with indentation")
      .action(async (options, command) => {
        await this.executeCommand("config", undefined, command);
      });

    this.program
      .command("env")
      .description("Show resolved environment variables for a service")
      .argument("<service>", "Service to show environment variables for")
      .option("-j, --json", "Output as minified JSON")
      .action(async (service, options, command) => {
        await this.executeCommand("env", service, command);
      });
  }

  private async executeCommand(
    command: ZapCommand,
    service: string | undefined,
    commandInstance: Command,
  ): Promise<void> {
    const parent = commandInstance.parent!;
    const globalOpts = parent.opts();
    const commandOpts = commandInstance.opts();
    const allOptions = { ...globalOpts, ...commandOpts };

    if (allOptions.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (allOptions.verbose) {
      logger.setLevel(LogLevel.INFO);
    } else if (allOptions.quiet) {
      logger.setLevel(LogLevel.WARN);
    }

    const zapper = new Zapper();
    await zapper.loadConfig(allOptions.config, allOptions);

    const resolvedService = service
      ? zapper.resolveServiceName(service)
      : undefined;

    const handler = this.commandHandlers.get(command);
    if (!handler) {
      throw new Error(`No handler found for command: ${command}`);
    }

    // Parse task parameters for the task command
    let taskParams: TaskParams | undefined;
    if (command === "task" && service) {
      taskParams = parseTaskArgs(process.argv, service);
    }

    const context: CommandContext = {
      zapper,
      service: resolvedService,
      options: allOptions,
      taskParams,
    };

    await handler.execute(context);
  }

  parse(args: string[]): void {
    this.program.parse(args);
  }

  getHelp(): string {
    return this.program.helpInformation();
  }
}
