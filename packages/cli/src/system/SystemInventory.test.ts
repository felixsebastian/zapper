import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockerManager } from "../core/docker/DockerManager";
import { Pm2Manager } from "../core/process/Pm2Manager";
import { auditSystemResources } from "./SystemInventory";

describe("SystemInventory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "zapper-system-"));
    vi.stubEnv("ZAPPER_SYSTEM_STATE_HOME", path.join(tempDir, "system"));
    vi.spyOn(Pm2Manager, "listProcesses").mockResolvedValue([
      {
        name: "zap.unregistered.abc123.api",
        pid: 1,
        status: "online",
        uptime: 100,
        memory: 1,
        cpu: 0,
        restarts: 0,
      },
      {
        name: "zap.legacy.worker",
        pid: 2,
        status: "online",
        uptime: 100,
        memory: 1,
        cpu: 0,
        restarts: 0,
      },
    ]);
    vi.spyOn(DockerManager, "listContainers").mockResolvedValue([
      {
        id: "container-id",
        name: "zap.unregistered.abc123.db",
        status: "running",
        ports: [],
        networks: [],
        created: "",
      },
    ]);
    vi.spyOn(DockerManager, "listVolumes").mockResolvedValue([
      { name: "zap.unregistered.abc123.vol1" },
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports unregistered and legacy Zapper-looking runtime resources", async () => {
    const audit = await auditSystemResources();
    expect(audit.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "pm2",
          name: "zap.unregistered.abc123.api",
          classification: "live-unregistered",
        }),
        expect.objectContaining({
          type: "pm2",
          name: "zap.legacy.worker",
          classification: "legacy",
        }),
        expect.objectContaining({
          type: "container",
          name: "zap.unregistered.abc123.db",
          classification: "live-unregistered",
        }),
        expect.objectContaining({
          type: "volume",
          name: "zap.unregistered.abc123.vol1",
          classification: "live-unregistered",
        }),
      ]),
    );
  });
});
