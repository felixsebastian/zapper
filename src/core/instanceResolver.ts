import crypto from "crypto";
import readline from "readline";
import { detectWorktree } from "../utils/worktreeDetector";
import {
  loadInstanceConfig,
  saveInstanceConfig,
  InstanceConfig,
} from "../config/instanceConfig";

export interface InstanceResolution {
  instanceId?: string | null;
  mode: "normal" | "isolate" | "exclusive";
}

/**
 * Generate a short instance ID based on the project path
 */
function generateInstanceId(projectRoot: string): string {
  const hash = crypto.createHash("sha256").update(projectRoot).digest("hex");
  return `wt-${hash.substring(0, 6)}`;
}

/**
 * Prompt the user to choose between isolate and exclusive mode
 */
async function promptInstanceMode(): Promise<"isolate" | "exclusive"> {
  const g = globalThis as unknown as {
    process?: { stdin?: unknown; stdout?: unknown };
  };

  const rl = readline.createInterface({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    input: (g.process?.stdin as any) || undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    output: (g.process?.stdout as any) || undefined,
  });

  console.log("\nThis project is inside a git worktree.");
  console.log(
    "Another instance of this project may be running from the main worktree.",
  );
  console.log();
  console.log("How should this instance be handled?");
  console.log("  1. Isolate (run independently with a separate instance ID)");
  console.log("  2. Exclusive (only allow one running instance at a time)");
  console.log();

  const answer: string = await new Promise((resolve) => {
    rl.question("Choose [1/2]: ", (ans) => resolve(ans.trim()));
  });

  rl.close();

  const choice = answer.toLowerCase();
  if (["1", "isolate", "i"].includes(choice)) {
    return "isolate";
  }
  if (["2", "exclusive", "e"].includes(choice)) {
    return "exclusive";
  }

  // Default to isolate if unclear
  console.log("Defaulting to isolate mode.");
  return "isolate";
}

/**
 * Resolve instance configuration for the given project.
 * Handles worktree detection, prompting, and config persistence.
 */
export async function resolveInstance(
  projectRoot: string,
): Promise<InstanceResolution> {
  // 1. Check for existing configuration
  const existingConfig = loadInstanceConfig(projectRoot);
  if (existingConfig) {
    if (existingConfig.mode === "exclusive") {
      return { mode: "exclusive" };
    }
    return {
      instanceId: existingConfig.instanceId,
      mode: existingConfig.instanceId ? "isolate" : "normal",
    };
  }

  // 2. Check if we're in a worktree
  const worktreeInfo = detectWorktree(projectRoot);
  if (!worktreeInfo.isWorktree) {
    return { mode: "normal" };
  }

  // 3. Prompt user for choice
  const userChoice = await promptInstanceMode();

  // 4. Save the choice and generate config
  const config: InstanceConfig = {};

  if (userChoice === "isolate") {
    const instanceId = generateInstanceId(projectRoot);
    config.instanceId = instanceId;
    saveInstanceConfig(projectRoot, config);
    return { instanceId, mode: "isolate" };
  } else {
    config.mode = "exclusive";
    saveInstanceConfig(projectRoot, config);
    return { mode: "exclusive" };
  }
}
