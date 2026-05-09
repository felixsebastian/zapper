import { describe, it, expect, vi } from "vitest";
import type { Context } from "../types/Context";
import type { ServiceListResult } from "../core/getServiceList";
import type { StatusResult } from "../core/getStatus";
import { renderer } from "./renderer";

function createContext(instanceId?: string | null, label?: string): Context {
  return {
    projectName: "demo",
    projectRoot: "/tmp/demo",
    envFiles: [],
    environments: [],
    gitMethod: "ssh",
    taskDelimiters: ["{{", "}}"],
    instanceKey: "default",
    instanceId,
    instance: instanceId
      ? {
          key: "default",
          id: instanceId,
          label,
          ports: {},
        }
      : undefined,
    processes: [],
    containers: [],
    tasks: [],
    links: [],
    profiles: [],
    state: {
      lastUpdated: "2026-01-01T00:00:00.000Z",
    },
  };
}

function createStatusResult(): StatusResult {
  return {
    native: [
      {
        service: "api",
        rawName: "zap.demo.inst123.api",
        status: "up",
        type: "native",
        enabled: true,
      },
    ],
    docker: [],
  };
}

describe("renderer", () => {
  it("builds instance ready text", () => {
    const text = renderer.isolation.enabledText("inst123");
    expect(text).toContain("Instance ready");
    expect(text).toContain("inst123");
  });

  it("prints instance ready through success logging", () => {
    const successSpy = vi
      .spyOn(renderer.log, "success")
      .mockImplementation(() => {});

    renderer.isolation.printEnabled("inst123");

    expect(successSpy).toHaveBeenCalled();
  });

  it("suppresses human renderer output in JSON mode", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      renderer.output.setJsonMode(true);

      renderer.log.info("info");
      renderer.log.warn("warning");
      renderer.log.error("error");
      renderer.log.success("success");
      renderer.log.report("report");
      renderer.machine.json({ ok: true });

      expect(renderer.output.isJsonMode()).toBe(true);
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('{"ok":true}');
      expect(warnSpy).not.toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      renderer.output.setJsonMode(false);
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it("formats instance-aware status header", () => {
    const text = renderer.status.toText(
      createStatusResult(),
      createContext("inst123"),
    );

    expect(
      renderer.status.contextHeaderText(createContext("inst123")),
    ).toContain("demo");
    expect(text).toContain("demo");
    expect(text).toContain("inst123");
  });

  it("formats labeled status header with label and id", () => {
    const text = renderer.status.toText(
      createStatusResult(),
      createContext("inst123", "local checkout"),
    );

    expect(text).toContain("local checkout");
    expect(text).toContain("inst123");
  });

  it("builds confirmation prompts through renderer", () => {
    expect(renderer.confirm.resetPromptText()).toContain(".zap");
    expect(renderer.confirm.promptText("Continue?", false)).toBe(
      "Continue? [y/N] ",
    );
    expect(renderer.confirm.promptText("Line 1\nContinue?", false)).toBe(
      "Line 1\nContinue?\n[y/N] ",
    );
    expect(
      renderer.confirm.globalKillAllPromptText({
        projectCount: 2,
        projectNames: ["alpha", "beta"],
        pm2Count: 4,
        containerCount: 1,
      }),
    ).toContain("\n  - alpha\n  - beta\n");
    expect(renderer.confirm.deleteResourcesPromptText()).toBe(
      "Delete these resources?",
    );
  });

  it("formats links with homepage labeling", () => {
    const text = renderer.links.toText([
      {
        name: "Home",
        url: "http://localhost:3000",
        isHomepage: true,
      },
      {
        name: "API Docs",
        url: "http://localhost:3001/docs",
        isHomepage: false,
      },
    ]);

    expect(text).toContain("Home");
    expect(text).toContain("homepage");
    expect(text).toContain("http://localhost:3001/docs");
  });

  it("formats ls ports in a separate table", () => {
    const listResult: ServiceListResult = {
      services: [
        {
          type: "native",
          service: "api",
          status: "up",
          ports: ["API_PORT=3001"],
          volumes: [],
          cwd: "./apps/api",
          cmd: "pnpm dev",
        },
      ],
      ports: [{ name: "API_PORT", value: "3001" }],
    };

    const text = renderer.list.toText(listResult, createContext("inst123"));

    expect(text).toContain("Services");
    expect(text).toContain("Ports");
    expect(text).toContain("API_PORT");
    expect(text).toContain("3001");
    expect(text).not.toContain("PORTS");
  });
});
