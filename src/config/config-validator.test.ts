import { describe, it, expect } from "vitest";
import { ConfigValidator } from "./config-validator";
import { ZapperConfig } from "../types";

describe("ConfigValidator", () => {
  it("should validate correct config", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [
        {
          name: "test",
          cmd: "echo 'hello world'",
        },
      ],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should reject config without project", () => {
    const config = {
      processes: [
        {
          name: "test",
          cmd: "echo 'hello world'",
        },
      ],
    } as ZapperConfig;

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Config must have a project field");
  });

  it("should reject config without processes", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Config must have at least one process defined");
  });

  it("should reject process without name", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [
        {
          cmd: "echo 'hello world'",
        } as unknown as ZapperConfig["processes"][0],
      ],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process must have a name field");
  });

  it("should reject process without cmd", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [
        {
          name: "test",
        } as unknown as ZapperConfig["processes"][0],
      ],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process test must have a cmd field");
  });
});
