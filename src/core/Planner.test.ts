import { describe, it, expect, vi, beforeEach } from "vitest";
import { Planner } from "./Planner";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";
import { ZapperConfig } from "../config/schemas";

// Mock the managers
vi.mock("./process/Pm2Manager");
vi.mock("./docker");

const mockPm2Manager = vi.mocked(Pm2Manager);
const mockDockerManager = vi.mocked(DockerManager);

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
        { name: "zap.test-project.api", status: "stopped" },
        { name: "zap.test-project.frontend", status: "stopped" },
        { name: "zap.test-project.worker", status: "online" }, // Should be stopped
        { name: "zap.test-project.monitor", status: "online" }, // Should be stopped
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null) // cache - not running
        .mockResolvedValueOnce(null) // database - not running  
        .mockResolvedValueOnce({ status: "running" }); // analytics - running, should be stopped

      const plan = await planner.plan("start", undefined, "test-project", false, "dev");

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

    it("should skip services already in correct state", async () => {
      // Mock current state: correct services running
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.api", status: "online" }, // Correct
        { name: "zap.test-project.frontend", status: "online" }, // Correct
        { name: "zap.test-project.worker", status: "stopped" }, // Correct
        { name: "zap.test-project.monitor", status: "stopped" }, // Correct
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce({ status: "running" }) // cache - correct
        .mockResolvedValueOnce({ status: "running" }) // database - correct
        .mockResolvedValueOnce(null); // analytics - correct (stopped)

      const plan = await planner.plan("start", undefined, "test-project", false, "dev");

      expect(plan.actions).toEqual([]); // No actions needed
    });
  });

  describe("startAll with prod profile", () => {
    it("should start prod services, stop dev-only services", async () => {
      // Mock current state: dev services running, prod services stopped
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.api", status: "online" }, // Keep running
        { name: "zap.test-project.frontend", status: "online" }, // Should be stopped
        { name: "zap.test-project.worker", status: "stopped" }, // Should be started
        { name: "zap.test-project.monitor", status: "stopped" }, // Should be started
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce({ status: "running" }) // cache - keep running
        .mockResolvedValueOnce({ status: "running" }) // database - keep running (has prod profile)
        .mockResolvedValueOnce(null); // analytics - should be started

      const plan = await planner.plan("start", undefined, "test-project", false, "prod");

      expect(plan.actions).toEqual([
        // Actions are processed in order: processes first, then containers
        { type: "stop", serviceType: "bare_metal", name: "frontend" },
        { type: "start", serviceType: "bare_metal", name: "worker" },
        { type: "start", serviceType: "bare_metal", name: "monitor" },
        { type: "start", serviceType: "docker", name: "analytics" },
      ]);
    });
  });

  describe("startAll with no active profile", () => {
    it("should only start services with no profiles", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.api", status: "stopped" },
        { name: "zap.test-project.frontend", status: "stopped" },
        { name: "zap.test-project.worker", status: "stopped" },
        { name: "zap.test-project.monitor", status: "stopped" },
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null) // cache
        .mockResolvedValueOnce(null) // database
        .mockResolvedValueOnce(null); // analytics

      // No active profile - should fall back to old logic
      const plan = await planner.plan("start", undefined, "test-project", false, undefined);

      // Should only start services with no profiles
      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "api" },
        { type: "start", serviceType: "docker", name: "cache" },
      ]);
    });
  });

  describe("targeted start (ignores profiles)", () => {
    it("should start specific service regardless of profile", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.worker", status: "stopped" },
      ]);

      const plan = await planner.plan("start", ["worker"], "test-project", false, "dev");

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "worker" },
      ]);
    });

    it("should start multiple specific services regardless of profiles", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.worker", status: "stopped" },
        { name: "zap.test-project.frontend", status: "stopped" },
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null); // analytics

      const plan = await planner.plan("start", ["worker", "frontend", "analytics"], "test-project", false, "prod");

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "frontend" },
        { type: "start", serviceType: "bare_metal", name: "worker" },
        { type: "start", serviceType: "docker", name: "analytics" },
      ]);
    });
  });

  describe("edge cases", () => {
    it("should handle services with multiple profiles", async () => {
      // monitor has both "prod" and "monitoring" profiles
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.monitor", status: "stopped" },
      ]);

      // Test with "monitoring" profile - should start monitor
      const plan = await planner.plan("start", undefined, "test-project", false, "monitoring");

      expect(plan.actions).toEqual([
        { type: "start", serviceType: "bare_metal", name: "api" }, // no profile
        { type: "start", serviceType: "bare_metal", name: "monitor" }, // has monitoring profile
        { type: "start", serviceType: "docker", name: "cache" }, // no profile
      ]);
    });

    it("should handle empty config gracefully", async () => {
      const emptyPlanner = new Planner({ project: "empty" });
      
      mockPm2Manager.listProcesses.mockResolvedValue([]);

      const plan = await emptyPlanner.plan("start", undefined, "empty", false, "dev");

      expect(plan.actions).toEqual([]);
    });
  });

  describe("forceStart behavior", () => {
    it("should restart services even if already running when forceStart=true", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        { name: "zap.test-project.api", status: "online" },
        { name: "zap.test-project.frontend", status: "online" },
        { name: "zap.test-project.worker", status: "stopped" }, // prod service
        { name: "zap.test-project.monitor", status: "stopped" }, // prod service
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce({ status: "running" }) // cache
        .mockResolvedValueOnce({ status: "running" }) // database
        .mockResolvedValueOnce({ status: "running" }); // analytics (prod service, should be stopped)

      const plan = await planner.plan("start", undefined, "test-project", true, "dev");

      expect(plan.actions).toEqual([
        // Force start even though already running (for services that should run)
        { type: "start", serviceType: "bare_metal", name: "api" },
        { type: "start", serviceType: "bare_metal", name: "frontend" },
        { type: "start", serviceType: "docker", name: "cache" },
        { type: "start", serviceType: "docker", name: "database" },
        // Stop services that don't match profile (even with forceStart)
        { type: "stop", serviceType: "docker", name: "analytics" },
      ]);
    });
  });
});