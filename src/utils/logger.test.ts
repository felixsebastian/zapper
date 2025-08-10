import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger, LogLevel } from "./logger";

describe("Logger", () => {
  let logger: Logger;
  let consoleSpy: {
    log: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    logger = new Logger();

    // Mock console methods
    consoleSpy = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Replace global console temporarily
    const originalConsole = globalThis.console;
    globalThis.console = consoleSpy as unknown as typeof globalThis.console;

    // Restore after test
    return () => {
      globalThis.console = originalConsole;
    };
  });

  it("should log info messages by default", () => {
    logger.info("test message");
    expect(consoleSpy.log).toHaveBeenCalledWith("test message");
  });

  it("should not log debug messages by default", () => {
    logger.debug("debug message");
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it("should log debug messages when level is set to DEBUG", () => {
    logger.setLevel(LogLevel.DEBUG);
    logger.debug("debug message");
    expect(consoleSpy.log).toHaveBeenCalledWith("[DEBUG] debug message");
  });

  it("should not log when silent is true", () => {
    logger.setSilent(true);
    logger.info("test message");
    expect(consoleSpy.log).not.toHaveBeenCalled();
  });

  it("should include timestamp when enabled", () => {
    logger.setTimestamp(true);
    logger.info("test message");
    const call = consoleSpy.log.mock.calls[0][0];
    expect(call).toContain("test message");
    expect(call).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it("should format data correctly", () => {
    const testData = { key: "value" };
    logger.info("test message", testData);
    expect(consoleSpy.log).toHaveBeenCalledWith('test message {"key":"value"}');
  });

  it("should respect log level hierarchy", () => {
    logger.setLevel(LogLevel.WARN);

    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(consoleSpy.log).not.toHaveBeenCalledWith(
      expect.stringContaining("DEBUG"),
    );
    expect(consoleSpy.log).not.toHaveBeenCalledWith(
      expect.stringContaining("INFO"),
    );
    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining("[WARN]"),
    );
    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining("[ERROR]"),
    );
  });
});
