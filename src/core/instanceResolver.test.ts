import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { isolateProject, resolveInstance } from "./instanceResolver";
import { loadInstanceConfig } from "../config/instanceConfig";

describe("instanceResolver", () => {
  const testDir = path.join(__dirname, "../../test-fixtures/instance-resolver");

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it("returns normal mode for non-worktree directories", async () => {
    const result = await resolveInstance(testDir);
    expect(result).toEqual({ mode: "normal" });
  });

  it("returns isolate mode when instance config already exists", async () => {
    const instanceId = isolateProject(testDir);
    const result = await resolveInstance(testDir);

    expect(result).toEqual({
      mode: "isolate",
      instanceId,
    });
  });

  it("warns and returns normal mode for unisolated worktree", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const gitFile = path.join(testDir, ".git");
    writeFileSync(gitFile, "gitdir: /tmp/main/.git/worktrees/feature-branch");

    const result = await resolveInstance(testDir);

    expect(result).toEqual({ mode: "normal" });
    expect(warnSpy).toHaveBeenCalled();
    expect(
      warnSpy.mock.calls.some((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" && arg.includes("WORKTREE WARNING"),
        ),
      ),
    ).toBe(true);
    expect(
      warnSpy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("zap isolate")),
      ),
    ).toBe(true);
  });

  it("creates and persists an instance ID via isolateProject", () => {
    const instanceId = isolateProject(testDir);
    const saved = loadInstanceConfig(testDir);

    expect(instanceId).toMatch(/^wt-[a-f0-9]{6}$/);
    expect(saved).toEqual({
      instanceId,
      mode: "isolate",
    });
  });

  it("reuses existing instance ID when already isolated", () => {
    const first = isolateProject(testDir);
    const second = isolateProject(testDir);

    expect(second).toBe(first);
  });
});
