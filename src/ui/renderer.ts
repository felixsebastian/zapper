import { StatusResult, ServiceStatus } from "../core/getStatus";
import { Context, Task } from "../types/Context";
import { logger } from "../utils/logger";

interface LogOptions {
  data?: unknown;
  noEmoji?: boolean;
}

export interface TaskListItem {
  name: string;
  description?: string;
  aliases?: string[];
}

export interface TaskParamInfo {
  name: string;
  desc?: string;
  default?: string;
  required: boolean;
}

export interface TaskParamsOutput {
  name: string;
  params: TaskParamInfo[];
  acceptsRest: boolean;
}

const statusColor = {
  reset: "\u001B[0m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  grey: "\u001B[90m",
} as const;

const errorColor = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  dim: "\u001B[2m",
  red: "\u001B[31m",
} as const;

const knownErrorNames = new Set([
  "ConfigFileNotFoundError",
  "ConfigParseError",
  "ConfigValidationError",
  "ServiceNotFoundError",
  "WhitelistReferenceError",
  "ContainerNotRunningError",
  "ContextNotLoadedError",
  "GitOperationError",
  "ExclusiveLockError",
]);

function asKnownError(error: unknown): Error | null {
  if (!(error instanceof Error)) return null;
  return knownErrorNames.has(error.name) ? error : null;
}

function formatServiceStatus(status: string, enabled: boolean): string {
  if (!enabled) return `${statusColor.grey}${status}${statusColor.reset}`;
  if (status === "up")
    return `${statusColor.green}${status}${statusColor.reset}`;
  if (status === "pending")
    return `${statusColor.yellow}${status}${statusColor.reset}`;
  if (status === "down")
    return `${statusColor.red}${status}${statusColor.reset}`;
  return status;
}

function formatServiceName(name: string, enabled: boolean): string {
  if (!enabled) return `${statusColor.grey}${name}${statusColor.reset}`;
  return name;
}

function formatServiceLine(service: ServiceStatus): string {
  const name = formatServiceName(service.service, service.enabled);
  const status = formatServiceStatus(service.status, service.enabled);
  return `${name} ${status}`;
}

function taskAcceptsRest(task: Task, delimiters: [string, string]): boolean {
  const restPattern = `${delimiters[0]}REST${delimiters[1]}`;
  return task.cmds.some(
    (cmd) => typeof cmd === "string" && cmd.includes(restPattern),
  );
}

export const renderer = {
  log: {
    error(message: string, options: LogOptions = {}): void {
      logger.error(message, options);
    },
    warn(message: string, options: LogOptions = {}): void {
      logger.warn(message, options);
    },
    info(message: string, options: LogOptions = {}): void {
      logger.info(message, options);
    },
    debug(message: string, options: LogOptions = {}): void {
      logger.debug(message, options);
    },
    success(message: string, options: LogOptions = {}): void {
      logger.success(message, options);
    },
    report(text: string): void {
      logger.info(text, { noEmoji: true });
    },
  },

  machine: {
    line(text: string): void {
      console.log(text);
    },
    lines(texts: string[]): void {
      for (const text of texts) {
        console.log(text);
      }
    },
    json(data: unknown, pretty = false): void {
      console.log(
        pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data),
      );
    },
    envMap(envMap: Record<string, string>): void {
      for (const [key, value] of Object.entries(envMap)) {
        console.log(`${key}=${value}`);
      }
    },
  },

  status: {
    toText(statusResult: StatusResult, context?: Context): string {
      const sections: string[] = [];

      if (context) {
        let header = context.projectName;
        if (context.instanceId) {
          header += ` (instance: ${context.instanceId})`;
        }
        header += "\n";
        sections.push(header);
      }

      if (statusResult.native.length > 0) {
        sections.push(
          ["💾 Native"]
            .concat(statusResult.native.map(formatServiceLine))
            .join("\n"),
        );
      }

      if (statusResult.docker.length > 0) {
        sections.push(
          ["🐳 Docker"]
            .concat(statusResult.docker.map(formatServiceLine))
            .join("\n"),
        );
      }

      return sections.join("\n\n");
    },
    toJson(statusResult: StatusResult): StatusResult {
      return statusResult;
    },
  },

  tasks: {
    toText(tasks: Task[]): string {
      if (tasks.length === 0) return "No tasks defined";

      const lines = ["📋 Available tasks"];
      for (const task of tasks) {
        let line = task.name;
        if (task.desc) line += ` — ${task.desc}`;
        if (task.aliases && task.aliases.length > 0) {
          line += ` (aliases: ${task.aliases.join(", ")})`;
        }
        lines.push(line);
      }

      return lines.join("\n");
    },
    toJson(tasks: Task[]): TaskListItem[] {
      return tasks.map((task) => ({
        name: task.name,
        description: task.desc,
        aliases: task.aliases,
      }));
    },
    paramsToJson(
      task: Task,
      delimiters: [string, string] = ["{{", "}}"],
    ): TaskParamsOutput {
      const params: TaskParamInfo[] = (task.params || []).map((param) => ({
        name: param.name,
        desc: param.desc,
        default: param.default,
        required: param.required === true && param.default === undefined,
      }));

      return {
        name: task.name,
        params,
        acceptsRest: taskAcceptsRest(task, delimiters),
      };
    },
  },

  profiles: {
    toText(profiles: string[]): string {
      if (profiles.length === 0) return "No profiles defined";
      return ["📋 Available profiles"].concat(profiles).join("\n");
    },
    toJson(profiles: string[]): string[] {
      return profiles;
    },
    pickerText(profiles: string[], activeProfile?: string): string {
      if (profiles.length === 0) return "No profiles defined";

      const lines: string[] = [];
      if (activeProfile) {
        lines.push(`Currently active profile: ${activeProfile}`);
        lines.push("");
      }

      lines.push("Available profiles:");
      profiles.forEach((profile, index) => {
        const marker = profile === activeProfile ? " (active)" : "";
        lines.push(`  ${index + 1}. ${profile}${marker}`);
      });
      lines.push("\nTo enable a profile, use: zap profile <profile-name>");

      return lines.join("\n");
    },
  },

  environments: {
    toText(environments: string[]): string {
      if (environments.length === 0) return "No environments defined";
      return ["📋 Available environments"].concat(environments).join("\n");
    },
    toJson(environments: string[]): string[] {
      return environments;
    },
    pickerText(environments: string[], activeEnvironment?: string): string {
      if (environments.length === 0) return "No environments defined";

      const lines: string[] = [];
      if (activeEnvironment) {
        lines.push(`Currently active environment: ${activeEnvironment}`);
        lines.push("");
      }

      lines.push("Available environments:");
      environments.forEach((environment, index) => {
        const marker = environment === activeEnvironment ? " (active)" : "";
        lines.push(`  ${index + 1}. ${environment}${marker}`);
      });
      lines.push("\nTo enable an environment, use: zap env <name>");

      return lines.join("\n");
    },
  },

  warnings: {
    unisolatedWorktreeText(): string {
      return [
        "",
        "===============================================",
        "============== WORKTREE WARNING ===============",
        "===============================================",
        "This project is running inside a git worktree.",
        "No instance isolation is configured for this path.",
        "Processes and containers may collide with other copies.",
        "Run `zap isolate` to create a local instance ID.",
        "===============================================",
        "",
      ].join("\n");
    },
    printUnisolatedWorktree(): void {
      console.warn(renderer.warnings.unisolatedWorktreeText());
    },
  },

  errors: {
    format(error: unknown, showStackTrace = false): string {
      const symbol = "✗";
      const knownError = asKnownError(error);

      if (knownError) {
        const errorType = knownError.name.replace(/Error$/, "");
        let output = `${errorColor.red}${errorColor.bold}${symbol} ${errorType}${errorColor.reset}\n`;
        output += `${errorColor.dim}${knownError.message}${errorColor.reset}`;

        if (showStackTrace && knownError.stack) {
          output += `\n\n${errorColor.dim}${knownError.stack}${errorColor.reset}`;
        }

        return output;
      }

      const errorName =
        error instanceof Error ? error.constructor.name : typeof error;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      let output = `${errorColor.red}${errorColor.bold}${symbol} Unexpected Error: ${errorName}${errorColor.reset}\n`;
      output += `${errorColor.dim}${errorMessage}${errorColor.reset}`;

      if (showStackTrace && error instanceof Error && error.stack) {
        output += `\n\n${errorColor.dim}${error.stack}${errorColor.reset}`;
      }

      return output;
    },
    print(error: unknown, showStackTrace = false): void {
      console.error(renderer.errors.format(error, showStackTrace));
    },
  },
};
