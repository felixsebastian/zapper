import { describe, it, expect, vi, beforeEach } from "vitest";
import { Planner } from "./Planner";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";
import { ZapperConfig } from "../config/schemas";
import { ProcessInfo } from "../types/index";

// Mock the managers
vi.mock("./process/Pm2Manager");
vi.mock("./docker");

const mockPm2Manager = vi.mocked(Pm2Manager);
const mockDockerManager = vi.mocked(DockerManager);

// Helper functions to create complete mock objects
function createMockProcessInfo(name: string, status: string): ProcessInfo {
  return {
    name,
    status,
    pid: status === "online" ? 1234 : 0,
    uptime: status === "online" ? 1000 : 0,
    memory: status === "online" ? 100 : 0,
    cpu: status === "online" ? 5 : 0,
    restarts: 0,
  };
}

function createMockDockerContainer(name: string, status: string) {
  return {
    id: "abc123",
    name,
    status,
    ports: [],
    networks: [],
    created: "2023-01-01",
  };
}

describe("Planner - Profile-based StartAll", () => {
  let planner: Planner;
  let config: ZapperConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    config = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start" }, // No profile
        frontend: { cmd: "npm run dev", profiles: ["dev"] },
        worker: { cmd: "npm run worker", profiles: ["prod"] },
        monitor: { cmd: "npm run monitor", profiles: ["prod", "monitoring"] },
      },
      docker: {
        cache: { image: "redis:7" }, // No profile
        database: { image: "postgres:15", profiles: ["dev", "prod"] },
        analytics: { image: "elasticsearch:8", profiles: ["prod"] },
      },
    };

    planner = new Planner(config);
  });

  describe("startAll with dev profile", () => {
    it("should start services with no profile + dev profile, stop prod-only services", async () => {
      // Mock current state: prod services running, dev services stopped
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "online"), // Should be stopped
        createMockProcessInfo("zap.test-project.monitor", "online"), // Should be stopped
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null) // cache - not running
        .mockResolvedValueOnce(null) // database - not running
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.analytics", "running"),
        ); // analytics - running, should be stopped

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        false,
        "dev",
      );

      expect(plan.actions).toEqual([
        // Actions are processed in order: processes first, then containers
        { type: "start", serviceType: "bare_metal", name: "api" },
        { type: "start", serviceType: "bare_metal", name: "frontend" },
        { type: "stop", serviceType: "bare_metal", name: "worker" },
        { type: "stop", serviceType: "bare_metal", name: "monitor" },
        { type: "start", serviceType: "docker", name: "cache" },
        { type: "start", serviceType: "docker", name: "database" },
        { type: "stop", serviceType: "docker", name: "analytics" },
      ]);
    });

    it("should handle forceStart correctly with active profile", async () => {
      // Mock current state: some services running, some stopped
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "stopped"),
        createMockProcessInfo("zap.test-project.monitor", "stopped"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.cache", "running"),
        ) // cache - running
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.database", "running"),
        ); // database - running

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        true, // forceStart
        "dev",
      );

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "api" }, // Force restart
        { type: "start", serviceType: "bare_metal", name: "frontend" },
        { type: "start", serviceType: "docker", name: "cache" }, // Force restart
        { type: "start", serviceType: "docker", name: "database" }, // Force restart
      ]);
    });

    it("should start all services when none are running", async () => {
      // Mock current state: all services stopped
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "stopped"),
        createMockProcessInfo("zap.test-project.monitor", "stopped"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null) // cache - not running
        .mockResolvedValueOnce(null); // database - not running

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        false,
        "dev",
      );

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "api" },
        { type: "start", serviceType: "bare_metal", name: "frontend" },
        { type: "start", serviceType: "docker", name: "cache" },
        { type: "start", serviceType: "docker", name: "database" },
      ]);
    });
  });

  describe("startAll without active profile", () => {
    it("should start all services when no profile is active", async () => {
      // Mock current state: all services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
        createMockProcessInfo("zap.test-project.worker", "online"),
        createMockProcessInfo("zap.test-project.monitor", "online"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.cache", "running"),
        )
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.database", "running"),
        )
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.analytics", "running"),
        );

      const plan = await planner.plan("start", undefined, "test-project");

      expect(plan.actions).toEqual([]); // No actions needed, all already running
    });
  });

  describe("targeted operations", () => {
    it("should ignore profile filtering when targeting specific services", async () => {
      // Mock current state: some services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
      ]);

      const plan = await planner.plan(
        "start",
        ["frontend"],
        "test-project",
        false,
        "prod", // Active profile is prod, but should be ignored for targeted start
      );

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "frontend" },
      ]);
    });

    it("should stop targeted services regardless of profile", async () => {
      // Mock current state: some services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
      ]);

      const plan = await planner.plan(
        "stop",
        ["frontend"],
        "test-project",
        false,
        "dev", // Active profile is dev, but should be ignored for targeted stop
      );

      expect(plan.actions).toEqual([
        { type: "stop", serviceType: "bare_metal", name: "frontend" },
      ]);
    });
  });

  describe("restart operations", () => {
    it("should restart services with profile filtering", async () => {
      // Mock current state: some services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
      ]);

      const plan = await planner.plan(
        "restart",
        undefined,
        "test-project",
        false,
        "dev",
      );

      // Restart should generate stop actions followed by start actions
      expect(plan.actions.length).toBeGreaterThan(0);
      expect(plan.actions.some((a) => a.type === "stop")).toBe(true);
      expect(plan.actions.some((a) => a.type === "start")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle services with multiple profiles", async () => {
      // Mock current state: all services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
        createMockProcessInfo("zap.test-project.worker", "stopped"), // prod service
        createMockProcessInfo("zap.test-project.monitor", "stopped"), // prod service
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.cache", "running"),
        ) // cache - running
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.database", "running"),
        ) // database - running
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.analytics", "running"),
        ); // analytics - running

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        true, // forceStart
        "monitoring", // monitor has both prod and monitoring profiles
      );

      // Should start monitor (has monitoring profile) and stop others with profiles
      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "api" }, // No profile, always runs
        { type: "stop", serviceType: "bare_metal", name: "frontend" }, // dev profile, should stop
        { type: "start", serviceType: "bare_metal", name: "monitor" }, // has monitoring profile
        { type: "start", serviceType: "docker", name: "cache" }, // No profile, always runs
        { type: "stop", serviceType: "docker", name: "database" }, // dev+prod profiles, should stop
        { type: "stop", serviceType: "docker", name: "analytics" }, // prod profile, should stop
      ]);
    });
  });
});
