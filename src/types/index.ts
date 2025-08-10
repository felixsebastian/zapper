export interface Process {
  name: string;
  cmd: string;
  cwd?: string;
  // Backward compat: allow legacy 'envs', but prefer 'env'
  envs?: string[];
  // Whitelist of environment variable keys
  env?: string[];
  // Computed resolved env map used internally for execution
  resolvedEnv?: Record<string, string>;
  source?: string;
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
}

export interface ZapperConfig {
  project: string;
  env_files?: string[];
  bare_metal?: Record<string, Process>;
  containers?: Record<string, Container>;
  // Backward compatibility
  processes?: Process[];
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
  verbose?: boolean;
  quiet?: boolean;
  debug?: boolean;
}
