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

  it("should reject container without image", () => {
    const config: ZapperConfig = {
      project: "myproj",
      containers: {
        database: {
          ports: ["5432:5432"],
        } as unknown as NonNullable<ZapperConfig["containers"]>[string],
      },
    };

    expect(() => {
      ConfigValidator.validate(config);
    }).toThrow("Container database must have an image field");
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
