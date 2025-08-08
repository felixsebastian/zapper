export interface ServiceConfig {
  name: string;
  type: "process" | "container";
  command?: string;
  cwd?: string;
  env?: Record<string, string>;
  depends_on?: string[];
  runtime?: string;
  version?: string;
  instances?: number;
  restart?: boolean;
  health_check?: HealthCheck;
}

export interface HealthCheck {
  type: "http" | "tcp" | "command";
  url?: string;
  port?: number;
  command?: string;
  interval?: number;
  timeout?: number;
  retries?: number;
}

export interface ContainerConfig extends ServiceConfig {
  image: string;
  ports?: string[];
  volumes?: string[];
  networks?: string[];
  environment?: Record<string, string>;
}

export interface ProcessConfig extends ServiceConfig {
  script: string;
  args?: string[];
  node_args?: string[];
  max_memory?: string;
  min_uptime?: string;
  max_restarts?: number;
}

export interface ZapperConfig {
  version: string;
  services: Record<string, ServiceConfig>;
  networks?: Record<string, unknown>;
  volumes?: Record<string, unknown>;
  environment?: Record<string, string>;
}

export interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "error" | "starting" | "stopping";
  pid?: number;
  uptime?: number;
  memory?: number;
  cpu?: number;
  restarts?: number;
  error?: string;
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

export interface ContainerInfo {
  id: string;
  name: string;
  status: string;
  ports: string[];
  networks: string[];
  created: string;
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
