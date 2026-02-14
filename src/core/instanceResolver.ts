import crypto from "crypto";
import { detectWorktree } from "../utils/worktreeDetector";
import {
  loadInstanceConfig,
  saveInstanceConfig,
  InstanceConfig,
} from "../config/instanceConfig";

export interface InstanceResolution {
  instanceId?: string | null;
  mode: "normal" | "isolate";
}

/**
 * Generate a short random instance ID.
 */
function generateInstanceId(projectRoot: string): string {
  const salt = `${projectRoot}:${Date.now()}:${crypto.randomBytes(8).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(salt).digest("hex");
  return `wt-${hash.substring(0, 6)}`;
}

function printUnisolatedWorktreeWarning(): void {
  console.warn("\n===============================================");
  console.warn("============== WORKTREE WARNING ===============");
  console.warn("===============================================");
  console.warn("This project is running inside a git worktree.");
  console.warn("No instance isolation is configured for this path.");
  console.warn("Processes and containers may collide with other copies.");
  console.warn("Run `zap isolate` to create a local instance ID.");
  console.warn("===============================================\n");
}

export function isolateProject(projectRoot: string): string {
  const existingConfig = loadInstanceConfig(projectRoot);
  if (existingConfig?.instanceId) {
    return existingConfig.instanceId;
  }

  const instanceId = generateInstanceId(projectRoot);
  const config: InstanceConfig = {
    instanceId,
    mode: "isolate",
  };
  saveInstanceConfig(projectRoot, config);
  return instanceId;
}

/**
 * Resolve instance configuration for the given project.
 * Handles worktree detection and warning behavior.
 */
export async function resolveInstance(
  projectRoot: string,
): Promise<InstanceResolution> {
  // 1. Check for existing configuration
  const existingConfig = loadInstanceConfig(projectRoot);
  if (existingConfig?.instanceId) {
    return {
      instanceId: existingConfig.instanceId,
      mode: "isolate",
    };
  }

  // 2. Check if we're in a worktree
  const worktreeInfo = detectWorktree(projectRoot);
  if (!worktreeInfo.isWorktree) {
    return { mode: "normal" };
  }

  // 3. Warn and continue in non-isolated mode
  printUnisolatedWorktreeWarning();
  return { mode: "normal" };
}
