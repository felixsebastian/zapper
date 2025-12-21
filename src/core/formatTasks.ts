import { Task } from "../types/Context";
import { TaskRunner } from "./tasks/TaskRunner";

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

export function formatTasks(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks defined";

  const sections: string[] = ["📋 Available tasks"];

  for (const task of tasks) {
    let line = `${task.name}`;
    if (task.desc) line += ` — ${task.desc}`;
    if (task.aliases && task.aliases.length > 0) {
      line += ` (aliases: ${task.aliases.join(", ")})`;
    }
    sections.push(line);
  }

  return sections.join("\n");
}

export function formatTasksAsJson(tasks: Task[]): string {
  const taskList: TaskListItem[] = tasks.map((task) => ({
    name: task.name,
    description: task.desc,
    aliases: task.aliases,
  }));

  return JSON.stringify(taskList);
}

export function formatTaskParamsAsJson(
  task: Task,
  delimiters?: [string, string],
): string {
  const params: TaskParamInfo[] = (task.params || []).map((p) => ({
    name: p.name,
    desc: p.desc,
    default: p.default,
    required: p.required === true && p.default === undefined,
  }));

  const output: TaskParamsOutput = {
    name: task.name,
    params,
    acceptsRest: TaskRunner.taskAcceptsRest(task, delimiters),
  };

  return JSON.stringify(output);
}
