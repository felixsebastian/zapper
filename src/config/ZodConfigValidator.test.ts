import { describe, it, expect } from "vitest";
import { ZodConfigValidator } from "./ZodConfigValidator";

describe("ZodConfigValidator", () => {
  it("should validate correct config with bare_metal", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        test: {
          cmd: "echo 'hello world'",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with docker", () => {
    const config = {
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
      ZodConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with both bare_metal and docker", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        frontend: {
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
      ZodConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should validate correct config with legacy processes (backward compatibility)", () => {
    const config = {
      project: "myproj",
      processes: [
        {
          name: "test",
          cmd: "echo 'hello world'",
        },
      ],
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).not.toThrow();
  });

  it("should reject config without project", () => {
    const config = {
      bare_metal: {
        test: {
          cmd: "echo 'hello world'",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: project: Invalid input: expected string, received undefined");
  });

  it("should reject config with invalid project name", () => {
    const config = {
      project: "invalid name!",
      bare_metal: {
        test: {
          cmd: "echo 'hello world'",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: project: Name must contain only alphanumeric characters, underscores, and hyphens");
  });

  it("should reject config without any processes", () => {
    const config = {
      project: "myproj",
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: No processes defined. Define at least one in bare_metal, docker, or processes");
  });

  it("should reject config with duplicate service names", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        test: {
          cmd: "echo 'hello world'",
        },
      },
      docker: {
        test: {
          image: "nginx",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: Duplicate service identifier. Names and aliases must be globally unique across bare_metal and docker");
  });

  it("should reject config with invalid process command", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        test: {
          cmd: "",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: bare_metal.test.cmd: Command cannot be empty");
  });

  it("should reject config with invalid docker image", () => {
    const config = {
      project: "myproj",
      docker: {
        test: {
          image: "",
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: docker.test.image: Image cannot be empty");
  });

  it("should reject config with invalid volume path", () => {
    const config = {
      project: "myproj",
      docker: {
        test: {
          image: "nginx",
          volumes: [
            {
              name: "data",
              internal_dir: "relative/path",
            },
          ],
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: docker.test.volumes.0.internal_dir: Internal directory must be an absolute path");
  });

  it("should reject config with invalid task commands", () => {
    const config = {
      project: "myproj",
      tasks: {
        test: {
          cmds: [],
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).toThrow("Configuration validation failed: tasks.test.cmds: Task must have at least one command, No processes defined. Define at least one in bare_metal, docker, or processes");
  });

  it("should validate config with tasks and processes", () => {
    const config = {
      project: "myproj",
      bare_metal: {
        test: {
          cmd: "echo hello",
        },
      },
      tasks: {
        test: {
          cmds: ["echo hello", { task: "other-task" }],
        },
      },
    };

    expect(() => {
      ZodConfigValidator.validate(config);
    }).not.toThrow();
  });
});
