import path from "path";
import { ZapperConfig } from "../config/schemas";
import { Context, Process, Container, Task } from "../types/Context";
import { loadState } from "../config/stateLoader";

/**
 * Creates a Context object from a ZapperConfig.
 * Transforms the config into a more usable format for the rest of the application.
 *
 * @param config The validated ZapperConfig (with whitelists already resolved)
 * @param projectRoot Absolute path to directory containing zap.yaml
 * @returns Context object ready for use throughout the application
 */
export function createContext(
  config: ZapperConfig,
  projectRoot: string,
): Context {
  // Transform processes from config format to context format
  const processes: Process[] = [];

  // Add native processes (key-value pairs)
  if (config.native) {
    for (const [name, proc] of Object.entries(config.native)) {
      processes.push({
        ...proc,
        name,
      });
    }
  }

  // Add legacy processes array (already has names)
  if (config.processes) {
    for (const proc of config.processes) {
      if (!proc.name) {
        throw new Error("Process in processes array missing name field");
      }
      processes.push({
        ...proc,
        name: proc.name,
      });
    }
  }

  // Transform containers from config format to context format
  const containers: Container[] = [];

  // Add docker containers (key-value pairs)
  const dockerServices = config.docker || config.containers;
  if (dockerServices) {
    for (const [name, container] of Object.entries(dockerServices)) {
      containers.push({
        ...container,
        name,
      });
    }
  }

  // Transform tasks from config format to context format
  const tasks: Task[] = [];
  if (config.tasks) {
    for (const [name, task] of Object.entries(config.tasks)) {
      tasks.push({
        ...task,
        name,
      });
    }
  }

  // Resolve env_files to absolute paths relative to projectRoot
  let envFiles: string[] | undefined;
  if (config.env_files && config.env_files.length > 0) {
    envFiles = config.env_files.map((p) =>
      path.isAbsolute(p) ? p : path.join(projectRoot, p),
    );
  }

  // Extract all unique profiles from processes and containers
  const profileSet = new Set<string>();

  // Add profiles from processes
  processes.forEach((process) => {
    if (Array.isArray(process.profiles)) {
      process.profiles.forEach((profile) => profileSet.add(profile));
    }
  });

  // Add profiles from containers
  containers.forEach((container) => {
    if (Array.isArray(container.profiles)) {
      container.profiles.forEach((profile) => profileSet.add(profile));
    }
  });

  const profiles = Array.from(profileSet).sort();

  // Load and validate state from state.json
  const state = loadState(projectRoot);

  return {
    projectName: config.project,
    projectRoot,
    envFiles,
    gitMethod: config.git_method,
    taskDelimiters: config.task_delimiters,
    processes,
    containers,
    tasks,
    profiles,
    state,
  };
}
