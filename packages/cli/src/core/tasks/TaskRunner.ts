import { spawn } from "child_process";
import { renderer } from "../../ui/renderer";
import * as path from "path";
import Mustache from "mustache";
import { TaskParam } from "../../config/schemas";
import { TaskNotFoundError } from "../../errors";

const ansi = {
  reset: "\u001B[0m",
  bold: "\u001B[1m",
  cyan: "\u001B[36m",
  grey: "\u001B[90m",
} as const;
const ansiEscape = String.fromCharCode(27);

function stripAnsi(text: string): string {
  return text.replace(new RegExp(`${ansiEscape}\\[[0-9;]*m`, "g"), "");
}

function bright(text: string): string {
  return `${ansi.bold}${ansi.cyan}${text}${ansi.reset}`;
}

function grey(text: string): string {
  return `${ansi.grey}${text}${ansi.reset}`;
}

export interface TaskParams {
  named: Record<string, string>;
  rest: string[];
}

export type TaskPrecondition =
  | string
  | {
      sh: string;
      msg?: string;
    };

export type TaskCommand =
  | string
  | {
      cmd: string;
      silent?: boolean;
      interactive?: boolean;
    }
  | {
      task: string;
      vars?: Record<string, string>;
      silent?: boolean;
    };

export interface Task {
  cmds: TaskCommand[];
  cwd?: string;
  desc?: string;
  resolvedEnv?: Record<string, string>;
  params?: TaskParam[];
  silent?: boolean;
  interactive?: boolean;
  preconditions?: TaskPrecondition[];
  status?: string[];
}

export type TaskRegistry = Record<string, Task>;

export interface TaskRunnerOptions {
  delimiters?: [string, string];
  params?: TaskParams;
  force?: boolean;
}

interface ExecutionContext {
  params: TaskParams;
  silent?: boolean;
}

export class TaskRunner {
  private tasks: TaskRegistry;
  private baseCwd: string;
  private delimiters: [string, string];
  private params: TaskParams;
  private force: boolean;

  constructor(
    tasks: TaskRegistry,
    baseCwd: string,
    options: TaskRunnerOptions = {},
  ) {
    this.tasks = tasks;
    this.baseCwd = baseCwd;
    this.delimiters = options.delimiters || ["{{", "}}"];
    this.params = options.params || { named: {}, rest: [] };
    this.force = Boolean(options.force);
  }

  private resolveCwd(tCwd?: string): string {
    if (!tCwd || tCwd.trim().length === 0) return this.baseCwd;
    return path.isAbsolute(tCwd) ? tCwd : path.join(this.baseCwd, tCwd);
  }

  private interpolate(
    cmd: string,
    taskParams: TaskParam[] | undefined,
    params: TaskParams,
  ): string {
    // Build context from params, applying defaults
    const context: Record<string, string> = {};

    // Apply task-defined params with defaults first
    if (taskParams) {
      for (const param of taskParams) {
        if (param.default !== undefined) {
          context[param.name] = param.default;
        }
      }
    }

    // Override with provided named params
    for (const [key, value] of Object.entries(params.named)) {
      context[key] = value;
    }

    // Add REST as joined string
    context["REST"] = params.rest.join(" ");

    // Set custom delimiters for Mustache
    Mustache.tags = this.delimiters;

    // Disable HTML escaping for shell commands
    const originalEscape = Mustache.escape;
    Mustache.escape = (text) => text;

    try {
      return Mustache.render(cmd, context);
    } finally {
      Mustache.escape = originalEscape;
    }
  }

  private validateParams(
    taskName: string,
    taskParams: TaskParam[] | undefined,
    params: TaskParams,
    warnUnknown: boolean,
  ): void {
    if (!taskParams) return;

    for (const param of taskParams) {
      if (param.required && param.default === undefined) {
        if (!(param.name in params.named)) {
          throw new Error(
            `Required parameter '${param.name}' not provided for task '${taskName}'`,
          );
        }
      }
    }

    if (!warnUnknown) return;

    // Warn about unknown params
    const knownParams = new Set(taskParams.map((p) => p.name));
    for (const key of Object.keys(params.named)) {
      if (
        !knownParams.has(key) &&
        key !== "json" &&
        key !== "list-params" &&
        key !== "force"
      ) {
        renderer.log.warn(`Unknown parameter '${key}' for task '${taskName}'`);
      }
    }
  }

  private writeCommand(name: string, command: string): void {
    process.stdout.write(`${bright(`task: [${name}] ${command}`)}\n`);
  }

  private writeTaskOutput(
    stream: NodeJS.WriteStream,
    chunk: Buffer | string,
  ): void {
    stream.write(grey(stripAnsi(chunk.toString())));
  }

  private runCommand(
    taskName: string,
    command: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
    options: { silent?: boolean; interactive?: boolean } = {},
  ): Promise<void> {
    if (!options.silent) {
      this.writeCommand(taskName, command);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd,
        env,
        shell: true,
        stdio: options.interactive ? "inherit" : ["inherit", "pipe", "pipe"],
      });

      child.stdout?.on("data", (chunk) => {
        this.writeTaskOutput(process.stdout, chunk);
      });

      child.stderr?.on("data", (chunk) => {
        this.writeTaskOutput(process.stderr, chunk);
      });

      child.on("error", reject);
      child.on("close", (code, signal) => {
        if (code === 0) {
          resolve();
          return;
        }

        if (signal) {
          reject(new Error(`Command failed with signal ${signal}: ${command}`));
          return;
        }

        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      });
    });
  }

  private runCheckCommand(
    command: string,
    cwd: string,
    env: NodeJS.ProcessEnv,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, {
        cwd,
        env,
        shell: true,
        stdio: ["ignore", "ignore", "ignore"],
      });

      child.on("error", reject);
      child.on("close", (code) => {
        resolve(code === 0);
      });
    });
  }

  private async runPreconditions(
    taskName: string,
    task: Task,
    cwd: string,
    env: NodeJS.ProcessEnv,
    params: TaskParams,
  ): Promise<void> {
    if (!task.preconditions) return;

    for (const precondition of task.preconditions) {
      const command =
        typeof precondition === "string" ? precondition : precondition.sh;
      const message =
        typeof precondition === "string"
          ? `Precondition failed for task '${taskName}': ${command}`
          : precondition.msg ||
            `Precondition failed for task '${taskName}': ${command}`;
      const interpolated = this.interpolate(command, task.params, params);
      const passed = await this.runCheckCommand(interpolated, cwd, env);
      if (!passed) throw new Error(message);
    }
  }

  private async isUpToDate(
    task: Task,
    cwd: string,
    env: NodeJS.ProcessEnv,
    params: TaskParams,
  ): Promise<boolean> {
    if (!task.status || task.status.length === 0) return false;

    for (const command of task.status) {
      const interpolated = this.interpolate(command, task.params, params);
      const passed = await this.runCheckCommand(interpolated, cwd, env);
      if (!passed) return false;
    }

    return true;
  }

  private interpolateVars(
    vars: Record<string, string> | undefined,
    taskParams: TaskParam[] | undefined,
    params: TaskParams,
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(vars || {})) {
      result[key] = this.interpolate(value, taskParams, params);
    }
    return result;
  }

  private async execTask(
    name: string,
    stack: string[] = [],
    execution: ExecutionContext = { params: this.params },
  ): Promise<void> {
    if (!this.tasks[name]) throw new TaskNotFoundError(name);

    if (stack.includes(name)) {
      throw new Error(
        `Circular task reference detected: ${[...stack, name].join(" -> ")}`,
      );
    }

    const task = this.tasks[name];

    this.validateParams(
      name,
      task.params,
      execution.params,
      stack.length === 0,
    );

    const env = {
      ...process.env,
      ...(task.resolvedEnv || {}),
    } as NodeJS.ProcessEnv;

    const cwd = this.resolveCwd(task.cwd);
    renderer.log.info(
      `Running task: ${name}${task.desc ? ` — ${task.desc}` : ""}`,
    );

    await this.runPreconditions(name, task, cwd, env, execution.params);

    if (
      !this.force &&
      (await this.isUpToDate(task, cwd, env, execution.params))
    ) {
      renderer.log.info(`Task '${name}' is up to date`);
      return;
    }

    for (const cmd of task.cmds) {
      if (typeof cmd === "string") {
        const interpolatedCmd = this.interpolate(
          cmd,
          task.params,
          execution.params,
        );
        await this.runCommand(name, interpolatedCmd, cwd, env, {
          silent: execution.silent || task.silent,
          interactive: task.interactive,
        });
      } else if (cmd && typeof cmd === "object" && "cmd" in cmd) {
        const interpolatedCmd = this.interpolate(
          cmd.cmd,
          task.params,
          execution.params,
        );
        await this.runCommand(name, interpolatedCmd, cwd, env, {
          silent: execution.silent || task.silent || cmd.silent,
          interactive: task.interactive || cmd.interactive,
        });
      } else if (cmd && typeof cmd === "object" && "task" in cmd) {
        const vars = this.interpolateVars(
          cmd.vars,
          task.params,
          execution.params,
        );
        await this.execTask(cmd.task, [...stack, name], {
          params: {
            named: {
              ...execution.params.named,
              ...vars,
            },
            rest: execution.params.rest,
          },
          silent: execution.silent || cmd.silent,
        });
      } else {
        throw new Error(`Invalid command in task ${name}`);
      }
    }
  }

  async run(taskName: string): Promise<void> {
    await this.execTask(taskName);
  }

  static async runTask(
    tasks: TaskRegistry,
    baseCwd: string,
    taskName: string,
    options?: TaskRunnerOptions,
  ): Promise<void> {
    const runner = new TaskRunner(tasks, baseCwd, options);
    await runner.run(taskName);
  }

  static taskAcceptsRest(
    task: Task,
    delimiters: [string, string] = ["{{", "}}"],
  ): boolean {
    const restPattern = `${delimiters[0]}REST${delimiters[1]}`;
    return task.cmds.some(
      (cmd) =>
        (typeof cmd === "string" && cmd.includes(restPattern)) ||
        (typeof cmd === "object" &&
          "cmd" in cmd &&
          cmd.cmd.includes(restPattern)),
    );
  }
}
