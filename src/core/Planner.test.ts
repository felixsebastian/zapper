import { describe, it, expect, vi, beforeEach } from "vitest";
import { Planner } from "./Planner";
import { ZapperConfig } from "../config/schemas";
import { Pm2Manager } from "./process/Pm2Manager";
import { DockerManager } from "./docker";

// Mock the dependencies
vi.mock("./process/Pm2Manager");
vi.mock("./docker");

describe("Planner", () => {
  let planner: Planner;
  let mockConfig: ZapperConfig;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      project: "test-project",
      bare_metal: {
        service1: {
          name: "service1",
          cmd: "echo 'service1'",
        },
        service2: {
          name: "service2",
          cmd: "echo 'service2'",
        },
        service3: {
          name: "service3",
          cmd: "echo 'service3'",
        },
      },
      docker: {
        db: {
          image: "postgres:15",
          ports: ["5432:5432"],
        },
        redis: {
          image: "redis:7",
          ports: ["6379:6379"],
        },
      },
    };

    planner = new Planner(mockConfig);
  });

  describe("restart planning", () => {
    it("should restart all services - stop running ones, start all", async () => {
      // Mock PM2 to return service1 and service2 as running
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([
        {
          name: "zap.test-project.service1",
          status: "online",
          pid: 1,
          uptime: 100,
          memory: 50,
          cpu: 10,
          restarts: 0,
        },
        {
          name: "zap.test-project.service2",
          status: "online",
          pid: 2,
          uptime: 200,
          memory: 60,
          cpu: 15,
          restarts: 0,
        },
        {
          name: "zap.test-project.service3",
          status: "stopped",
          pid: 3,
          uptime: 0,
          memory: 0,
          cpu: 0,
          restarts: 1,
        },
      ]);

      // Mock Docker to return db as running, redis as stopped
      vi.mocked(DockerManager.getContainerInfo)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // db (for stop plan)
        .mockResolvedValueOnce({
          id: "redis1",
          name: "redis",
          status: "stopped",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // redis (for stop plan)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // db (for start plan)
        .mockResolvedValueOnce({
          id: "redis1",
          name: "redis",
          status: "stopped",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }); // redis (for start plan)

      const plan = await planner.plan("restart", undefined, "test-project");

      // Should have stop actions for running services
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(3); // service1, service2, db
      expect(stopActions).toEqual(
        expect.arrayContaining([
          { type: "stop", serviceType: "bare_metal", name: "service1" },
          { type: "stop", serviceType: "bare_metal", name: "service2" },
          { type: "stop", serviceType: "docker", name: "db" },
        ]),
      );

      // Should have start actions for ALL services
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(5); // service1, service2, service3, db, redis
      expect(startActions).toEqual(
        expect.arrayContaining([
          { type: "start", serviceType: "bare_metal", name: "service1" },
          { type: "start", serviceType: "bare_metal", name: "service2" },
          { type: "start", serviceType: "bare_metal", name: "service3" },
          { type: "start", serviceType: "docker", name: "db" },
          { type: "start", serviceType: "docker", name: "redis" },
        ]),
      );

      // Actions should be in order: stops first, then starts
      const stopIndices = plan.actions
        .map((a: { type: string }, i: number) => (a.type === "stop" ? i : -1))
        .filter((i: number) => i !== -1);
      const startIndices = plan.actions
        .map((a: { type: string }, i: number) => (a.type === "start" ? i : -1))
        .filter((i: number) => i !== -1);

      expect(Math.max(...stopIndices)).toBeLessThan(Math.min(...startIndices));
    });

    it("should restart specific services - stop if running, start all specified", async () => {
      // Mock PM2 to return service1 as running, service2 as stopped
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([
        {
          name: "zap.test-project.service1",
          status: "online",
          pid: 1,
          uptime: 100,
          memory: 50,
          cpu: 10,
          restarts: 0,
        },
        {
          name: "zap.test-project.service2",
          status: "stopped",
          pid: 2,
          uptime: 0,
          memory: 0,
          cpu: 0,
          restarts: 1,
        },
      ]);

      // Mock Docker to return db as running
      vi.mocked(DockerManager.getContainerInfo)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // db (for stop plan)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }); // db (for start plan)

      const plan = await planner.plan(
        "restart",
        ["service1", "service2", "db"],
        "test-project",
      );

      // Should have stop actions for running services only
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(2); // service1, db
      expect(stopActions).toEqual(
        expect.arrayContaining([
          { type: "stop", serviceType: "bare_metal", name: "service1" },
          { type: "stop", serviceType: "docker", name: "db" },
        ]),
      );

      // Should have start actions for ALL specified services
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(3); // service1, service2, db
      expect(startActions).toEqual(
        expect.arrayContaining([
          { type: "start", serviceType: "bare_metal", name: "service1" },
          { type: "start", serviceType: "bare_metal", name: "service2" },
          { type: "start", serviceType: "docker", name: "db" },
        ]),
      );
    });

    it("should restart single service - stop if running, start it", async () => {
      // Mock PM2 to return service1 as running
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([
        {
          name: "zap.test-project.service1",
          status: "online",
          pid: 1,
          uptime: 100,
          memory: 50,
          cpu: 10,
          restarts: 0,
        },
      ]);

      const plan = await planner.plan("restart", ["service1"], "test-project");

      // Should have stop action for running service
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(1);
      expect(stopActions[0]).toEqual({
        type: "stop",
        serviceType: "bare_metal",
        name: "service1",
      });

      // Should have start action for the service
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(1);
      expect(startActions[0]).toEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "service1",
      });
    });

    it("should restart services that are not running - no stop actions, start all", async () => {
      // Mock PM2 to return no running services
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([]);

      // Mock Docker to return no running containers
      vi.mocked(DockerManager.getContainerInfo)
        .mockResolvedValueOnce(null) // db (for stop plan)
        .mockResolvedValueOnce(null) // redis (for stop plan)
        .mockResolvedValueOnce(null) // db (for start plan)
        .mockResolvedValueOnce(null); // redis (for start plan)

      const plan = await planner.plan("restart", undefined, "test-project");

      // Should have no stop actions
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(0);

      // Should have start actions for ALL services
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(5); // service1, service2, service3, db, redis
      expect(startActions).toEqual(
        expect.arrayContaining([
          { type: "start", serviceType: "bare_metal", name: "service1" },
          { type: "start", serviceType: "bare_metal", name: "service2" },
          { type: "start", serviceType: "bare_metal", name: "service3" },
          { type: "start", serviceType: "docker", name: "db" },
          { type: "start", serviceType: "docker", name: "redis" },
        ]),
      );
    });

    it("should handle mixed running states correctly", async () => {
      // Mock PM2 to return service1 as running, service2 as stopped, service3 not in targets
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([
        {
          name: "zap.test-project.service1",
          status: "online",
          pid: 1,
          uptime: 100,
          memory: 50,
          cpu: 10,
          restarts: 0,
        },
        {
          name: "zap.test-project.service3",
          status: "online",
          pid: 3,
          uptime: 300,
          memory: 70,
          cpu: 20,
          restarts: 0,
        },
      ]);

      // Mock Docker to return db as running, redis as stopped
      vi.mocked(DockerManager.getContainerInfo)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // db (for stop plan)
        .mockResolvedValueOnce({
          id: "redis1",
          name: "redis",
          status: "stopped",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // redis (for stop plan)
        .mockResolvedValueOnce({
          id: "db1",
          name: "db",
          status: "running",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }) // db (for start plan)
        .mockResolvedValueOnce({
          id: "redis1",
          name: "redis",
          status: "stopped",
          ports: [],
          networks: [],
          created: "2024-01-01",
        }); // redis (for start plan)

      const plan = await planner.plan(
        "restart",
        ["service1", "service2", "db", "redis"],
        "test-project",
      );

      // Should have stop actions for running services only
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(2); // service1, db
      expect(stopActions).toEqual(
        expect.arrayContaining([
          { type: "stop", serviceType: "bare_metal", name: "service1" },
          { type: "stop", serviceType: "docker", name: "db" },
        ]),
      );

      // Should have start actions for ALL specified services
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(4); // service1, service2, db, redis
      expect(startActions).toEqual(
        expect.arrayContaining([
          { type: "start", serviceType: "bare_metal", name: "service1" },
          { type: "start", serviceType: "bare_metal", name: "service2" },
          { type: "start", serviceType: "docker", name: "db" },
          { type: "start", serviceType: "docker", name: "redis" },
        ]),
      );
    });

    it("should restart single stopped service correctly", async () => {
      // Mock PM2 to return service1 as stopped
      vi.mocked(Pm2Manager.listProcesses).mockResolvedValue([
        {
          name: "zap.test-project.service1",
          status: "stopped",
          pid: 1,
          uptime: 0,
          memory: 0,
          cpu: 0,
          restarts: 1,
        },
      ]);

      const plan = await planner.plan("restart", ["service1"], "test-project");

      // Should have no stop actions (service not running)
      const stopActions = plan.actions.filter(
        (a: { type: string }) => a.type === "stop",
      );
      expect(stopActions).toHaveLength(0);

      // Should have start action for the service
      const startActions = plan.actions.filter(
        (a: { type: string }) => a.type === "start",
      );
      expect(startActions).toHaveLength(1);
      expect(startActions[0]).toEqual({
        type: "start",
        serviceType: "bare_metal",
        name: "service1",
      });
    });
  });
});
