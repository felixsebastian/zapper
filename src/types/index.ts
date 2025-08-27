export interface Process {
  name: string;
  cmd: string;
  cwd?: string;
  envs?: string[];
  env?: string[];
  aliases?: string[];
  resolvedEnv?: Record<string, string>;
  source?: string;
  repo?: string;
  env_files?: string[];
  profiles?: string[];
}

export interface Volume {
  name: string;
  internal_dir: string;
}

export type ContainerVolume = Volume | string;

export interface Container {
  name?: string;
  image: string;
  ports?: string[];
  env?: string[];
  volumes?: ContainerVolume[];
  networks?: string[];
  command?: string;
  aliases?: string[];
  resolvedEnv?: Record<string, string>;
  profiles?: string[];
}

export interface ZapperConfig {
  project: string;
  env_files?: string[];
  git_method?: "http" | "ssh" | "cli";
  bare_metal?: Record<string, Process>;
  docker?: Record<string, Container>;
  containers?: Record<string, Container>;
  processes?: Process[];
  tasks?: Record<string, Task>;
}

export interface ProcessInfo {
  name: string;
  pid: number;
  status: string;
  uptime: number;
  memory: number;
  cpu: number;
  restarts: number;
  cwd?: string;
}

export type Command =
  | "up"
  | "down"
  | "restart"
  | "status"
  | "logs"
  | "reset"
  | "clone"
  | "task";

export interface CliOptions {
  command: Command;
  invoked?: string;
  service?: string;
  all?: boolean;
  force?: boolean;
  follow?: boolean;
  config?: string;
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
}

// One-off Task support
export type TaskCmd = string | { task: string };

export interface Task {
  name?: string;
  desc?: string;
  cmds: TaskCmd[];
  env?: string[];
  cwd?: string;
  resolvedEnv?: Record<string, string>;
  // Optional per-task env files (take precedence over global)
  env_files?: string[];
}
