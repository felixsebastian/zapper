import { describe, it, expect, vi, beforeEach } from "vitest";
import { Planner } from "./Planner";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";
import { ZapperConfig } from "../config/schemas";
import { ProcessInfo } from "../types/index";
import { Action, ActionPlan } from "../types";

vi.mock("./process/Pm2Manager");
vi.mock("./docker");

const mockPm2Manager = vi.mocked(Pm2Manager);
const mockDockerManager = vi.mocked(DockerManager);

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

function flattenActions(plan: ActionPlan): Omit<Action, "healthCheck">[] {
  return plan.waves.flatMap((w) =>
    w.actions.map(({ type, serviceType, name }) => ({
      type,
      serviceType,
      name,
    })),
  );
}

function hasAction(plan: ActionPlan, type: "start" | "stop"): boolean {
  return plan.waves.some((w) => w.actions.some((a) => a.type === type));
}

describe("Planner - Profile-based StartAll", () => {
  let planner: Planner;
  let config: ZapperConfig;

  beforeEach(() => {
    vi.resetAllMocks();

    config = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start" },
        frontend: { cmd: "npm run dev", profiles: ["dev"] },
        worker: { cmd: "npm run worker", profiles: ["prod"] },
        monitor: { cmd: "npm run monitor", profiles: ["prod", "monitoring"] },
      },
      docker: {
        cache: { image: "redis:7" },
        database: { image: "postgres:15", profiles: ["dev", "prod"] },
        analytics: { image: "elasticsearch:8", profiles: ["prod"] },
      },
    };

    planner = new Planner(config);
  });

  describe("startAll with dev profile", () => {
    it("should start services with no profile + dev profile, stop prod-only services", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "online"),
        createMockProcessInfo("zap.test-project.monitor", "online"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.analytics", "running"),
        );

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        false,
        "dev",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "api",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "frontend",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "worker",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "monitor",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "cache",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "database",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "docker",
        name: "analytics",
      });
    });

    it("should handle forceStart correctly with active profile", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "stopped"),
        createMockProcessInfo("zap.test-project.monitor", "stopped"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.cache", "running"),
        )
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.database", "running"),
        );

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        true,
        "dev",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "api",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "frontend",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "cache",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "database",
      });
    });

    it("should start all services when none are running", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
        createMockProcessInfo("zap.test-project.worker", "stopped"),
        createMockProcessInfo("zap.test-project.monitor", "stopped"),
      ]);

      mockDockerManager.getContainerInfo.mockResolvedValue(null);

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        false,
        "dev",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "api",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "frontend",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "cache",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "database",
      });
    });
  });

  describe("startAll without active profile", () => {
    it("should stop profile services and start no-profile services", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
        createMockProcessInfo("zap.test-project.worker", "online"),
        createMockProcessInfo("zap.test-project.monitor", "online"),
      ]);

      mockDockerManager.getContainerInfo
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.database", "running"),
        )
        .mockResolvedValueOnce(
          createMockDockerContainer("zap.test-project.analytics", "running"),
        );

      const plan = await planner.plan("start", undefined, "test-project");
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "api",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "frontend",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "worker",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "monitor",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "cache",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "docker",
        name: "database",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "docker",
        name: "analytics",
      });
    });
  });

  describe("targeted operations", () => {
    it("should ignore profile filtering when targeting specific services", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "stopped"),
      ]);

      const plan = await planner.plan(
        "start",
        ["frontend"],
        "test-project",
        false,
        "prod",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "frontend",
      });
    });

    it("should stop targeted services regardless of profile", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "stopped"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
      ]);

      const plan = await planner.plan(
        "stop",
        ["frontend"],
        "test-project",
        false,
        "dev",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "frontend",
      });
    });
  });

  describe("restart operations", () => {
    it("should restart services with profile filtering", async () => {
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

      expect(plan.waves.length).toBeGreaterThan(0);
      expect(hasAction(plan, "stop")).toBe(true);
      expect(hasAction(plan, "start")).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle services with multiple profiles", async () => {
      mockPm2Manager.listProcesses.mockResolvedValue([
        createMockProcessInfo("zap.test-project.api", "online"),
        createMockProcessInfo("zap.test-project.frontend", "online"),
        createMockProcessInfo("zap.test-project.worker", "stopped"),
        createMockProcessInfo("zap.test-project.monitor", "stopped"),
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

      const plan = await planner.plan(
        "start",
        undefined,
        "test-project",
        true,
        "monitoring",
      );
      const actions = flattenActions(plan);

      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "api",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "frontend",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "monitor",
      });
      expect(actions).toContainEqual({
        type: "start",
        serviceType: "docker",
        name: "cache",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "docker",
        name: "database",
      });
      expect(actions).toContainEqual({
        type: "stop",
        serviceType: "docker",
        name: "analytics",
      });
    });
  });
});

describe("Planner - Dependency-aware waves", () => {
  it("should order services based on depends_on", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start", depends_on: ["database"] },
        frontend: { cmd: "npm run dev", depends_on: ["api"] },
      },
      docker: {
        database: { image: "postgres:15" },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([]);
    mockDockerManager.getContainerInfo.mockResolvedValue(null);

    const planner = new Planner(config);
    const plan = await planner.plan("start", undefined, "test-project", true);

    expect(plan.waves.length).toBe(3);

    const wave1Names = plan.waves[0].actions.map((a) => a.name);
    const wave2Names = plan.waves[1].actions.map((a) => a.name);
    const wave3Names = plan.waves[2].actions.map((a) => a.name);

    expect(wave1Names).toContain("database");
    expect(wave2Names).toContain("api");
    expect(wave3Names).toContain("frontend");
  });

  it("should run independent services in parallel", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start", depends_on: ["database", "redis"] },
      },
      docker: {
        database: { image: "postgres:15" },
        redis: { image: "redis:7" },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([]);
    mockDockerManager.getContainerInfo.mockResolvedValue(null);

    const planner = new Planner(config);
    const plan = await planner.plan("start", undefined, "test-project", true);

    expect(plan.waves.length).toBe(2);
    expect(plan.waves[0].actions.length).toBe(2);
    const wave1Names = plan.waves[0].actions.map((a) => a.name);
    expect(wave1Names).toContain("database");
    expect(wave1Names).toContain("redis");

    expect(plan.waves[1].actions.length).toBe(1);
    expect(plan.waves[1].actions[0].name).toBe("api");
  });

  it("should include healthCheck in actions", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start", healthCheck: 10 },
      },
      docker: {
        database: { image: "postgres:15", healthCheck: 15 },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([]);
    mockDockerManager.getContainerInfo.mockResolvedValue(null);

    const planner = new Planner(config);
    const plan = await planner.plan("start", undefined, "test-project", true);

    const allActions = plan.waves.flatMap((w) => w.actions);
    const apiAction = allActions.find((a) => a.name === "api");
    const dbAction = allActions.find((a) => a.name === "database");

    expect(apiAction?.healthCheck).toBe(10);
    expect(dbAction?.healthCheck).toBe(15);
  });

  it("should use default healthCheck of 5", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start" },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([]);

    const planner = new Planner(config);
    const plan = await planner.plan("start", undefined, "test-project", true);

    expect(plan.waves[0].actions[0].healthCheck).toBe(5);
  });

  it("should throw on circular dependencies", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        a: { cmd: "npm start", depends_on: ["b"] },
        b: { cmd: "npm start", depends_on: ["a"] },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([]);

    const planner = new Planner(config);
    await expect(
      planner.plan("start", undefined, "test-project", true),
    ).rejects.toThrow(/[Cc]ircular/);
  });

  it("should stop dependents before dependencies", async () => {
    const config: ZapperConfig = {
      project: "test-project",
      bare_metal: {
        api: { cmd: "npm start", depends_on: ["database"] },
        frontend: { cmd: "npm run dev", depends_on: ["api"] },
      },
      docker: {
        database: { image: "postgres:15" },
      },
    };

    mockPm2Manager.listProcesses.mockResolvedValue([
      createMockProcessInfo("zap.test-project.api", "online"),
      createMockProcessInfo("zap.test-project.frontend", "online"),
    ]);
    mockDockerManager.getContainerInfo.mockResolvedValue(
      createMockDockerContainer("zap.test-project.database", "running"),
    );

    const planner = new Planner(config);
    const plan = await planner.plan("stop", undefined, "test-project");

    const wave1Names = plan.waves[0].actions.map((a) => a.name);
    const wave2Names = plan.waves[1].actions.map((a) => a.name);
    const wave3Names = plan.waves[2].actions.map((a) => a.name);

    expect(wave1Names).toContain("frontend");
    expect(wave2Names).toContain("api");
    expect(wave3Names).toContain("database");
  });
});
