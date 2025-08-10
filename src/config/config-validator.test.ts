import { describe, it, expect } from "vitest";
import { ConfigValidator } from "./config-validator";
import { ZapperConfig, Process, Volume } from "../types";

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

  it("should validate correct config with containers", () => {
    const config: ZapperConfig = {
      project: "myproj",
      containers: {
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

  it("should validate correct config with both bare_metal and containers", () => {
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
      containers: {
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
      "Project name 'invalid_name_123' is invalid. Only letters and hyphens are allowed",
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

  it("should reject config without bare_metal or processes", () => {
    const config: ZapperConfig = {
      project: "myproj",
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("bare_metal must have at least one process defined");
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
      "Service name 'front_end' is invalid. Only letters and hyphens are allowed",
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

  it("should reject duplicate names across bare_metal and containers", () => {
    const config: ZapperConfig = {
      project: "myproj",
      bare_metal: {
        api: { name: "api", cmd: "run" },
      },
      containers: {
        api: { image: "redis:7" },
      },
    };

    expect(() => ConfigValidator.validate(config)).toThrow(
      "Duplicate service name 'api' across bare_metal and containers",
    );
  });

  it("should reject unknown keys in process and container entries", () => {
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
      containers: {
        db: { image: "postgres:15", bar: 1 },
      },
    } as unknown as ZapperConfig;
    expect(() => ConfigValidator.validate(config2)).toThrow(
      "Unknown key in containers['db']: bar",
    );
  });

  it("should reject container name mismatch when name field present", () => {
    const config = {
      project: "myproj",
      containers: {
        db: { name: "postgres", image: "postgres:15" },
      },
    } as unknown as ZapperConfig;

    expect(() => ConfigValidator.validate(config)).toThrow(
      "Container name 'postgres' must match its key 'db'",
    );
  });

  it("should reject container with invalid ports", () => {
    const config: ZapperConfig = {
      project: "myproj",
      containers: {
        database: {
          image: "postgres:15",
          ports: [""],
        },
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Container database ports must contain non-empty strings");
  });

  it("should reject container with invalid volumes", () => {
    const config: ZapperConfig = {
      project: "myproj",
      containers: {
        database: {
          image: "postgres:15",
          volumes: [
            {
              name: "postgres_data",
              // missing internal_dir
            } as unknown as Volume,
          ],
        },
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Container database volume must have an internal_dir field");
  });

  // Backward compatibility tests
  it("should reject config without processes when bare_metal is not present", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Config must have at least one process defined");
  });

  it("should reject process without name in legacy processes", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [
        {
          cmd: "echo 'hello world'",
        } as unknown as NonNullable<ZapperConfig["processes"]>[0],
      ],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process must have a name field");
  });

  it("should reject process without cmd in legacy processes", () => {
    const config: ZapperConfig = {
      project: "myproj",
      processes: [
        {
          name: "test",
        } as unknown as NonNullable<ZapperConfig["processes"]>[0],
      ],
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Process test must have a cmd field");
  });
});
