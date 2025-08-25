export interface Process {
  name: string;
  cmd: string;
  cwd?: string;
  // Backward compat: allow legacy 'envs', but prefer 'env'
  envs?: string[];
  // Whitelist of environment variable keys
  env?: string[];
  // Optional shorthand aliases for this service
  aliases?: string[];
  // Computed resolved env map used internally for execution
  resolvedEnv?: Record<string, string>;
  source?: string;
  // Optional GitHub repository in the form "owner/repo" or a full URL
  repo?: string;
}

export interface Volume {
  name: string;
  internal_dir: string;
}

export interface Container {
  name?: string;
  image: string;
  ports?: string[];
  env?: string[];
  volumes?: Volume[];
  networks?: string[];
  command?: string;
  // Optional shorthand aliases for this container service
  aliases?: string[];
}

export interface ZapperConfig {
  project: string;
  env_files?: string[];
  // Preferred Git clone method (default: ssh)
  git_method?: "http" | "ssh" | "cli";
  bare_metal?: Record<string, Process>;
  containers?: Record<string, Container>;
  // Backward compatibility
  processes?: Process[];
  // One-off tasks
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
}
