export interface Process {
  name: string;
  cmd: string;
  cwd?: string;
  envs?: string[];
  env?: Record<string, string>;
}

export interface ZapperConfig {
  project: string;
  env_files?: string[];
  processes: Process[];
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
  | "stop"
  | "start";

export interface CliOptions {
  command: Command;
  service?: string;
  all?: boolean;
  force?: boolean;
  follow?: boolean;
  config?: string;
}
