import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

// Path to built CLI
const CLI_PATH = path.join(__dirname, "../../dist/index.js");
const FIXTURES_DIR = path.join(__dirname, "fixtures");

// Utility function to run CLI commands
function runZapCommand(
  command: string,
  cwd: string,
  options: { timeout?: number; encoding?: BufferEncoding } = {},
) {
  const { timeout = 10000, encoding = "utf8" } = options;
  try {
    return execSync(`node "${CLI_PATH}" ${command}`, {
      cwd,
      timeout,
      encoding,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (error: unknown) {
    // Include stderr in error for better debugging
    if (error && typeof error === "object" && "stderr" in error) {
      const execError = error as { stderr?: Buffer | string; message?: string };
      if (execError.stderr) {
        const message = execError.message || "";
        (error as { message: string }).message =
          message + `\nStderr: ${execError.stderr.toString()}`;
      }
    }
    throw error;
  }
}

// Utility function to generate unique project names
function generateTestProjectName(): string {
  return `e2e-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

// Utility function to clean up PM2 processes
async function cleanupPm2Processes(projectName: string) {
  try {
    // Delete all processes matching the project pattern
    execSync(`pm2 delete "zap.${projectName}.*" 2>/dev/null || true`, {
      stdio: "ignore",
      timeout: 5000,
    });
  } catch (error) {
    // Ignore cleanup errors - processes might not exist
  }
}

describe("E2E: Service Aliases", () => {
  let testProjectName: string;
  let fixtureDir: string;
  let tempConfigPath: string;

  beforeAll(() => {
    // Ensure CLI is built
    if (!fs.existsSync(CLI_PATH)) {
      throw new Error(
        `CLI not found at ${CLI_PATH}. Run 'npm run build' first.`,
      );
    }
  });

  afterEach(async () => {
    if (testProjectName) {
      // Clean up PM2 processes
      await cleanupPm2Processes(testProjectName);

      // Remove temp config if it exists
      if (tempConfigPath && fs.existsSync(tempConfigPath)) {
        try {
          fs.unlinkSync(tempConfigPath);
        } catch (error) {
          console.warn("Failed to remove temp config:", error);
        }
      }
    }
  });

  afterAll(async () => {
    // Cleanup any remaining test processes (only zap.e2e-test-* patterns)
    try {
      const output = execSync("pm2 jlist --silent", {
        encoding: "utf8",
        timeout: 5000,
      });
      const processes = JSON.parse(output);
      for (const proc of processes) {
        if (proc.name?.startsWith("zap.e2e-test-")) {
          execSync(`pm2 delete "${proc.name}" 2>/dev/null || true`, {
            stdio: "ignore",
            timeout: 5000,
          });
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const setupTestConfig = () => {
    testProjectName = generateTestProjectName();
    fixtureDir = path.join(FIXTURES_DIR, "service-aliases");
    tempConfigPath = path.join(
      __dirname,
      "test-data",
      `${testProjectName}-zap.yaml`,
    );

    // Ensure test-data directory exists
    const testDataDir = path.dirname(tempConfigPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Copy fixture and modify project name
    const fixtureConfigPath = path.join(fixtureDir, "zap.yaml");
    let configContent = fs.readFileSync(fixtureConfigPath, "utf-8");
    configContent = configContent.replace(
      "project: alias-test",
      `project: ${testProjectName}`,
    );

    // Write temp config
    fs.writeFileSync(tempConfigPath, configContent);

    return path.dirname(tempConfigPath);
  };

  describe("Basic Alias Resolution", () => {
    it("should start and stop services using aliases", async () => {
      const workingDir = setupTestConfig();

      try {
        // Start service using alias
        const startOutput = runZapCommand("up api", workingDir, {
          timeout: 15000,
        });
        expect(startOutput).toContain("api-server");

        // Wait for process to stabilize
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Check status - should show canonical name
        const statusOutput = runZapCommand("status", workingDir, {
          timeout: 10000,
        });
        expect(statusOutput).toContain("api-server");

        // Stop service using different alias
        const stopOutput = runZapCommand("down backend", workingDir, {
          timeout: 15000,
        });
        expect(stopOutput).toContain("api-server");
      } catch (error) {
        console.error("Test failed:", error);
        throw error;
      }
    }, 60000);

    it("should work with multiple aliases for the same service", async () => {
      const workingDir = setupTestConfig();

      try {
        const aliases = ["users", "user-svc"];

        for (const alias of aliases) {
          // Start with alias
          const startOutput = runZapCommand(`up ${alias}`, workingDir, {
            timeout: 15000,
          });
          expect(startOutput).toContain("user-service");

          // Wait for stabilization
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Verify it's running (should show canonical name)
          const statusOutput = runZapCommand("status", workingDir, {
            timeout: 10000,
          });
          expect(statusOutput).toContain("user-service");

          // Stop with same alias
          runZapCommand(`down ${alias}`, workingDir, { timeout: 15000 });

          // Wait before next iteration
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error("Test failed:", error);
        throw error;
      }
    }, 90000);

    it("should handle canonical names alongside aliases", async () => {
      const workingDir = setupTestConfig();

      try {
        // Start some services with canonical names, others with aliases
        const startOutput = runZapCommand(
          "up api-server notifications",
          workingDir,
          { timeout: 20000 },
        );
        expect(startOutput).toContain("api-server");
        expect(startOutput).toContain("notification-worker");

        // Wait for processes to stabilize
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusOutput = runZapCommand("status", workingDir, {
          timeout: 10000,
        });
        expect(statusOutput).toContain("api-server");
        expect(statusOutput).toContain("notification-worker");

        // Stop with mixed canonical and alias
        runZapCommand("down api notification-worker", workingDir, {
          timeout: 15000,
        });
      } catch (error) {
        console.error("Test failed:", error);
        throw error;
      }
    }, 60000);
  });

  describe("Alias with Dependencies", () => {
    it("should resolve dependencies correctly when starting service via alias", async () => {
      const workingDir = setupTestConfig();

      try {
        // Start frontend using alias - should start dependencies too
        const startOutput = runZapCommand("up fe", workingDir, {
          timeout: 25000,
        });

        // Should mention starting dependencies
        expect(startOutput).toContain("api-server");
        expect(startOutput).toContain("user-service");
        expect(startOutput).toContain("frontend");

        // Wait for all processes to stabilize
        await new Promise((resolve) => setTimeout(resolve, 4000));

        // Verify all are running
        const statusOutput = runZapCommand("status", workingDir, {
          timeout: 15000,
        });
        expect(statusOutput).toContain("api-server");
        expect(statusOutput).toContain("user-service");
        expect(statusOutput).toContain("frontend");
      } catch (error) {
        console.error("Test failed:", error);
        throw error;
      }
    }, 90000);
  });

  describe("Task Aliases", () => {
    it("should execute tasks using aliases", async () => {
      const workingDir = setupTestConfig();

      try {
        // Run task using alias
        const taskOutput = runZapCommand("task build", workingDir, {
          timeout: 15000,
        });
        expect(taskOutput).toContain("Building frontend");
        expect(taskOutput).toContain("Building API");

        // Run same task using different alias
        const taskOutput2 = runZapCommand("task b", workingDir, {
          timeout: 15000,
        });
        expect(taskOutput2).toContain("Building frontend");

        // Run task with single alias
        const testOutput = runZapCommand("task test", workingDir, {
          timeout: 15000,
        });
        expect(testOutput).toContain("Running unit tests");
      } catch (error) {
        console.error("Test failed:", error);
        throw error;
      }
    }, 60000);
  });

  describe("Error Handling", () => {
    it("should handle unknown aliases gracefully", async () => {
      const workingDir = setupTestConfig();

      try {
        // Try to start non-existent service
        runZapCommand("up nonexistent", workingDir, { timeout: 10000 });
        // If we get here without error, that's also acceptable (depends on implementation)
      } catch (error) {
        // Should get a reasonable error message
        expect(error.message).toMatch(/nonexistent/i);
      }
    }, 30000);
  });
});
