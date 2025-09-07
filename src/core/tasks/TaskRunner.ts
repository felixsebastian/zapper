import { execSync } from "child_process";
import { logger } from "../../utils/logger";
import * as path from "path";

export interface Task {
  cmds: Array<string | { task: string }>;
  cwd?: string;
  desc?: string;
  resolvedEnv?: Record<string, string>;
}

export type TaskRegistry = Record<string, Task>;

export class TaskRunner {
  private tasks: TaskRegistry;
  private baseCwd: string;

  constructor(tasks: TaskRegistry, baseCwd: string) {
    this.tasks = tasks;
    this.baseCwd = baseCwd;
  }

  private resolveCwd(tCwd?: string): string {
    if (!tCwd || tCwd.trim().length === 0) return this.baseCwd;
    return path.isAbsolute(tCwd) ? tCwd : path.join(this.baseCwd, tCwd);
  }

  private execTask(name: string, stack: string[] = []): void {
    if (!this.tasks[name]) throw new Error(`Task not found: ${name}`);

    if (stack.includes(name)) {
      throw new Error(
        `Circular task reference detected: ${[...stack, name].join(" -> ")}`,
      );
    }

    const task = this.tasks[name];

    const env = {
      ...process.env,
      ...(task.resolvedEnv || {}),
    } as NodeJS.ProcessEnv;

    const cwd = this.resolveCwd(task.cwd);
    logger.info(`Running task: ${name}${task.desc ? ` — ${task.desc}` : ""}`);

    for (const cmd of task.cmds) {
      if (typeof cmd === "string") {
        logger.debug(`$ ${cmd}`);
        execSync(cmd, { stdio: "inherit", cwd, env });
      } else if (cmd && typeof cmd === "object" && "task" in cmd) {
        this.execTask(cmd.task, [...stack, name]);
      } else {
        throw new Error(`Invalid command in task ${name}`);
      }
    }
  }

  run(taskName: string): void {
    this.execTask(taskName);
  }

  static runTask(tasks: TaskRegistry, baseCwd: string, taskName: string): void {
    const runner = new TaskRunner(tasks, baseCwd);
    runner.run(taskName);
  }
}
