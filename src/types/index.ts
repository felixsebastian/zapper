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

export * from "./Context";

export type Command =
  | "up"
  | "down"
  | "restart"
  | "status"
  | "logs"
  | "reset"
  | "clone"
  | "task"
  | "profile"
  | "state"
  | "checkout"
  | "pull"
  | "gitstatus"
  | "config"
  | "env";

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
