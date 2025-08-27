import { describe, it, expect } from "vitest";
import { ConfigValidator } from "./config-validator";
import { ZapperConfig, Process } from "../types";

describe("ConfigValidator", () => {
  it("should validate correct config with bare_metal", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        test: {
          name: "test",
          cmd: "echo 'hello world'",
        },
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with docker", () => {
    const config: ZapperConfig = {
      project: "myproj",
      docker: {
        database: {
          image: "postgres:15",
          ports: ["5432:5432"],
          env: ["POSTGRES_DB", "POSTGRES_USER"],
          volumes: [
            {
              name: "postgres_data",
              internal_dir: "/var/lib/postgresql/data",
            },
          ],
        },
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with both bare_metal and docker", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        frontend: {
          name: "frontend",
          cmd: "npm run dev",
          cwd: "./frontend",
          env: ["PORT", "API_URL"],
        },
      },
      docker: {
        database: {
          image: "postgres:15",
          ports: ["5432:5432"],
        },
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with legacy processes (backward compatibility)", () => {
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
      bare_metal: {
        test: {
          name: "test",
          cmd: "echo 'hello world'",
        },
      },
    } as unknown as ZapperConfig;

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Config must have a project field");
  });

  it("should reject invalid project name", () => {
    const config: ZapperConfig = {
      project: "invalid_name_123",
      bare_metal: {
        test: { name: "test", cmd: "echo ok" },
      },
    };

    expect(() => ConfigValidator.validate(config)).toThrow(
      "Project name 'invalid_name_123' is invalid. Must start with a letter and contain only letters, digits, and hyphens",
    );
  });

  it("should reject unknown top-level keys", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        test: { name: "test", cmd: "echo ok" },
      },
      unknown_key: true,
    } as unknown as ZapperConfig;

    expect(() => ConfigValidator.validate(config)).toThrow(
      "Unknown top-level key: unknown_key",
    );
  });

  it("should reject config without any services", () => {
    const config: ZapperConfig = {
      project: "myproj",
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow(
      "No processes defined. Define at least one in bare_metal, docker, or processes",
    );
  });

  it("should reject empty bare_metal object", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {},
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("bare_metal must have at least one process defined");
  });

  it("should reject process without name", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        // Missing both name and cmd in value; name is inferred from key, so cmd is the error
        test: {} as unknown as Process,
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process test must have a cmd field");
  });

  it("should reject process without cmd", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        test: {
          name: "test",
        } as Process,
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process test must have a cmd field");
  });

  it("should reject invalid service names and mismatched names", () => {
    const configBadName: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        front_end: { name: "front_end", cmd: "run" },
      },
    };
    expect(() => ConfigValidator.validate(configBadName)).toThrow(
      "Service name 'front_end' is invalid. Must start with a letter and contain only letters, digits, and hyphens",
    );

    const configMismatch: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        frontend: { name: "fe", cmd: "run" },
      },
    };
    expect(() => ConfigValidator.validate(configMismatch)).toThrow(
      "Process name 'fe' must match its key 'frontend'",
    );
  });

  it("should reject duplicate names across bare_metal and docker", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        api: { name: "api", cmd: "run" },
      },
      docker: {
        api: { image: "redis:7" },
      },
    };

    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service identifier 'api'. Names and aliases must be globally unique across bare_metal and docker",
    );
  });

  it("should reject unknown keys in process and docker entries", () => {
    const config1 = {
      project: "myproj",
      bare_metal: {
        api: { name: "api", cmd: "run", foo: true },
      },
    } as unknown as ZapperConfig;
    expect(() => ConfigValidator.validate(config1)).toThrow(
      "Unknown key in bare_metal['api']: foo",
    );

    const config2 = {
      project: "myproj",
      docker: {
        db: { image: "postgres:15", bar: 1 },
      },
    } as unknown as ZapperConfig;
    expect(() => ConfigValidator.validate(config2)).toThrow(
      "Unknown key in docker['db']: bar",
    );
  });

  it("should validate names with digits after first character", () => {
    const config: ZapperConfig = {
      project: "proj1",
      bare_metal: {
        api1: { name: "api1", cmd: "run" },
      },
      docker: {
        db2: { image: "postgres:15" },
      },
    };
    expect(() => ConfigValidator.validate(config)).not.toThrow();
  });

  // Aliases
  it("should accept valid aliases and keep them unique globally", () => {
    const config: ZapperConfig = {
      project: "p",
      bare_metal: {
        frontend: { name: "frontend", cmd: "run", aliases: ["f", "fe"] },
        api: { name: "api", cmd: "run", aliases: ["a"] },
      },
      docker: {
        database: { image: "postgres:15", aliases: ["db"] },
      },
    };
    expect(() => ConfigValidator.validate(config)).not.toThrow();
  });

  it("should reject duplicate alias within the same service", () => {
    const config: ZapperConfig = {
      project: "p",
      bare_metal: {
        frontend: { name: "frontend", cmd: "run", aliases: ["f", "f"] },
      },
    };
    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service identifier 'f'. Names and aliases must be globally unique across bare_metal and bare_metal",
    );
  });

  it("should reject alias equal to base name", () => {
    const config: ZapperConfig = {
      project: "p",
      bare_metal: {
        frontend: { name: "frontend", cmd: "run", aliases: ["frontend"] },
      },
    };
    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service identifier 'frontend'. Names and aliases must be globally unique across bare_metal and docker",
    );
  });

  it("should reject alias colliding with another service name", () => {
    const config: ZapperConfig = {
      project: "p",
      bare_metal: {
        frontend: { name: "frontend", cmd: "run", aliases: ["api"] },
        api: { name: "api", cmd: "run" },
      },
    };
    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service identifier 'api'. Names and aliases must be globally unique across bare_metal and docker",
    );
  });

  it("should reject alias colliding across docker and bare_metal", () => {
    const config: ZapperConfig = {
      project: "p",
      bare_metal: {
        frontend: { name: "frontend", cmd: "run", aliases: ["db"] },
      },
      docker: {
        db: { image: "postgres:15" },
      },
    };
    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service identifier 'db'. Names and aliases must be globally unique across bare_metal and docker",
    );
  });
});
