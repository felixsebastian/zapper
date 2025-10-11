import { Task } from "../types/Context";

export interface TaskListItem {
  name: string;
  description?: string;
  aliases?: string[];
}

export function formatTasks(tasks: Task[]): string {
  if (tasks.length === 0) {
    return "No tasks defined";
  }

  const sections: string[] = ["📋 Available tasks"];

  for (const task of tasks) {
    let line = `${task.name}`;
    if (task.desc) {
      line += ` — ${task.desc}`;
    }
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
