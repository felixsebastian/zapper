import {
  ZapperConfig,
  Process as ConfigProcess,
  Container as ConfigContainer,
  Task as ConfigTask,
} from "../config/schemas";

// Enhanced types that include name field and other context-specific data
export interface Process extends Omit<ConfigProcess, "name"> {
  name: string; // Required in context
}

export interface Container extends Omit<ConfigContainer, "name"> {
  name: string; // Required in context
}

export interface Task extends Omit<ConfigTask, "name"> {
  name: string; // Required in context
}

// Main context object that gets passed around the application
export interface Context {
  projectName: string; // Renamed from 'project' in config
  projectRoot: string; // Absolute path to directory containing zap.yaml
  envFiles?: string[]; // Already resolved to absolute paths
  gitMethod?: "http" | "ssh" | "cli";

  // Services organized by type with names included
  processes: Process[]; // Combines bare_metal and processes from config
  containers: Container[]; // Combines docker and containers from config
  tasks: Task[]; // Tasks from config
}
