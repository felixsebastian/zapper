import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync } from "fs";
import { EnvResolver } from "./EnvResolver";
import { ZapperConfig } from "../config/schemas";

describe("EnvResolver", () => {
  let tempFiles: string[] = [];

  beforeEach(() => {
    tempFiles = [];
  });

  afterEach(() => {
    // Clean up temporary files
    tempFiles.forEach((file) => {
      try {
        unlinkSync(file);
      } catch (e) {
        // Ignore errors
      }
    });
  });

  const createTempFile = (
    content: string,
    extension: string = ".tmp",
  ): string => {
    const filename = `temp-${Date.now()}-${Math.random()}${extension}`;
    writeFileSync(filename, content);
    tempFiles.push(filename);
    return filename;
  };

  describe("loadAndMergeEnvFiles", () => {
    it("should load .env files correctly", () => {
      const envContent = `
# This is a comment
APP_ENV=development
NODE_ENV=development
MYENV=foo
DATABASE_URL=postgresql://localhost:5432/myapp
PORT=3000
# Another comment
EMPTY_VAR=
QUOTED_VAR="quoted value"
      `;

      const envFile = createTempFile(envContent, ".env");

      const result = EnvResolver["loadAndMergeEnvFiles"]([envFile]);

      expect(result).toEqual({
        APP_ENV: "development",
        NODE_ENV: "development",
        MYENV: "foo",
        DATABASE_URL: "postgresql://localhost:5432/myapp",
        PORT: "3000",
        EMPTY_VAR: "",
        QUOTED_VAR: "quoted value",
      });
    });

    it("should load YAML files correctly (legacy support)", () => {
      const yamlContent = `
envs:
  - APP_ENV: development
  - NODE_ENV: development
  - MYENV: foo
  - DATABASE_URL: postgresql://localhost:5432/myapp
      `;

      const yamlFile = createTempFile(yamlContent, ".yaml");
      const result = EnvResolver["loadAndMergeEnvFiles"]([yamlFile]);

      expect(result).toEqual({
        APP_ENV: "development",
        NODE_ENV: "development",
        MYENV: "foo",
        DATABASE_URL: "postgresql://localhost:5432/myapp",
      });
    });

    it("should merge multiple env files", () => {
      const env1Content = `
APP_ENV=development
NODE_ENV=development
      `;

      const env2Content = `
MYENV=foo
DATABASE_URL=postgresql://localhost:5432/myapp
      `;

      const env1File = createTempFile(env1Content, ".env");
      const env2File = createTempFile(env2Content, ".env");

      const result = EnvResolver["loadAndMergeEnvFiles"]([env1File, env2File]);

      expect(result).toEqual({
        APP_ENV: "development",
        NODE_ENV: "development",
        MYENV: "foo",
        DATABASE_URL: "postgresql://localhost:5432/myapp",
      });
    });

    it("should override variables when later files define the same key", () => {
      const env1Content = `
APP_ENV=development
DATABASE_URL=postgresql://localhost:5432/devdb
PORT=3000
      `;

      const env2Content = `
DATABASE_URL=postgresql://localhost:5432/testdb
PORT=4000
      `;

      const tempDir = ".";
      const env1File = `${tempDir}/.env.base.${Date.now()}`;
      const env2File = `${tempDir}/.env.e2e.${Date.now()}`;

      writeFileSync(env1File, env1Content);
      writeFileSync(env2File, env2Content);
      tempFiles.push(env1File, env2File);

      const result = EnvResolver["loadAndMergeEnvFiles"]([env1File, env2File]);

      expect(result).toEqual({
        APP_ENV: "development",
        DATABASE_URL: "postgresql://localhost:5432/testdb",
        PORT: "4000",
      });
    });

    it("should handle mixed file types", () => {
      const envContent = `
APP_ENV=development
NODE_ENV=development
      `;

      const yamlContent = `
envs:
  - MYENV: foo
  - DATABASE_URL: postgresql://localhost:5432/myapp
      `;

      const envFile = createTempFile(envContent, ".env");
      const yamlFile = createTempFile(yamlContent, ".yaml");

      const result = EnvResolver["loadAndMergeEnvFiles"]([envFile, yamlFile]);

      expect(result).toEqual({
        APP_ENV: "development",
        NODE_ENV: "development",
        MYENV: "foo",
        DATABASE_URL: "postgresql://localhost:5432/myapp",
      });
    });

    it("should handle empty env files", () => {
      const envFile = createTempFile("", ".env");
      const result = EnvResolver["loadAndMergeEnvFiles"]([envFile]);

      expect(result).toEqual({});
    });

    it("should handle non-existent files gracefully", () => {
      const result = EnvResolver["loadAndMergeEnvFiles"]([
        "non-existent-file.env",
      ]);

      expect(result).toEqual({});
    });

    it("should return empty object when no files provided", () => {
      const result = EnvResolver["loadAndMergeEnvFiles"]([]);

      expect(result).toEqual({});
    });

    it("should return empty object when files is undefined", () => {
      const result = EnvResolver["loadAndMergeEnvFiles"](undefined);

      expect(result).toEqual({});
    });

    it("should expand variable interpolation in .env files", () => {
      const envContent = `
HOST=localhost
PORT=5432
DATABASE_URL=\${HOST}:\${PORT}/mydb
SIMPLE_REF=$HOST
WITH_DEFAULT=\${MISSING:-fallback}
      `;

      const envFile = createTempFile(envContent, ".env");
      const result = EnvResolver["loadAndMergeEnvFiles"]([envFile]);

      expect(result).toEqual({
        HOST: "localhost",
        PORT: "5432",
        DATABASE_URL: "localhost:5432/mydb",
        SIMPLE_REF: "localhost",
        WITH_DEFAULT: "fallback",
      });
    });

    it("should expand variables across multiple .env files", () => {
      const env1Content = `
HOST=localhost
PORT=3000
      `;

      const env2Content = `
API_URL=http://\${HOST}:\${PORT}/api
      `;

      const env1File = createTempFile(env1Content, ".env");
      const env2File = createTempFile(env2Content, ".env");

      const result = EnvResolver["loadAndMergeEnvFiles"]([env1File, env2File]);

      expect(result).toEqual({
        HOST: "localhost",
        PORT: "3000",
        API_URL: "http://localhost:3000/api",
      });
    });
  });

  describe("resolve", () => {
    it("should resolve processes with envs whitelist", () => {
      const envContent = `
APP_ENV=development
NODE_ENV=development
MYENV=foo
DATABASE_URL=postgresql://localhost:5432/myapp
      `;

      const envFile = createTempFile(envContent, ".env");
      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo $MYENV",
            env: ["MYENV", "APP_ENV"],
          },
          server: {
            name: "server",
            cmd: "node server.js",
            env: ["NODE_ENV", "PORT"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual(["MYENV", "APP_ENV"]);
      expect(result.native!.test.resolvedEnv).toEqual({
        MYENV: "foo",
        APP_ENV: "development",
      });

      expect(result.native!.server.env).toEqual(["NODE_ENV", "PORT"]);
      expect(result.native!.server.resolvedEnv).toEqual({
        NODE_ENV: "development",
        // PORT is not in the env file, so it won't be included
      });
    });

    it("should handle processes with no envs whitelist", () => {
      const envContent = `
APP_ENV=development
NODE_ENV=development
      `;

      const envFile = createTempFile(envContent, ".env");
      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            // No envs field
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual([]);
      expect(result.native!.test.resolvedEnv).toEqual({});
    });

    it("should handle processes with empty envs array", () => {
      const envContent = `
APP_ENV=development
NODE_ENV=development
      `;

      const envFile = createTempFile(envContent, ".env");
      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: [],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual([]);
      expect(result.native!.test.resolvedEnv).toEqual({});
    });

    it("should handle processes with existing env whitelist", () => {
      const envContent = `
CUSTOM_VAR=custom_value
      `;
      const envFile = createTempFile(envContent, ".env");

      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: ["CUSTOM_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual(["CUSTOM_VAR"]);
      expect(result.native!.test.resolvedEnv).toEqual({
        CUSTOM_VAR: "custom_value",
      });
    });

    it("should handle processes with legacy envs field", () => {
      const envContent = `
LEGACY_VAR=legacy_value
      `;
      const envFile = createTempFile(envContent, ".env");

      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            envs: ["LEGACY_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual(["LEGACY_VAR"]);
      expect(result.native!.test.resolvedEnv).toEqual({
        LEGACY_VAR: "legacy_value",
      });
    });

    it("should handle processes with no env files", () => {
      const config: ZapperConfig = {
        project: "test",
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: ["SOME_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.native!.test.env).toEqual(["SOME_VAR"]);
      expect(result.native!.test.resolvedEnv).toEqual({});
    });
  });

  describe("getProcessEnv", () => {
    it("should return process environment variables", () => {
      const envContent = `
TEST_VAR=test_value
      `;
      const envFile = createTempFile(envContent, ".env");

      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: ["TEST_VAR"],
          },
        },
      };

      const result = EnvResolver.getProcessEnv(
        "test",
        EnvResolver.resolve(config),
      );

      expect(result).toEqual({
        TEST_VAR: "test_value",
      });
    });

    it("should return empty object when process has no env", () => {
      const config: ZapperConfig = {
        project: "test",
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
          },
        },
      };

      const result = EnvResolver.getProcessEnv(
        "test",
        EnvResolver.resolve(config),
      );

      expect(result).toEqual({});
    });

    it("should throw error when process not found", () => {
      const config: ZapperConfig = {
        project: "test",
        native: {
          test: {
            name: "test",
            cmd: "echo hello",
          },
        },
      };

      expect(() => {
        EnvResolver.getProcessEnv("nonexistent", EnvResolver.resolve(config));
      }).toThrow("Process nonexistent not found");
    });
  });

  describe("link URL interpolation", () => {
    it("should interpolate ${VAR} in process link URLs", () => {
      const envContent = `
API_PORT=3000
FRONTEND_PORT=4000
      `;
      const envFile = createTempFile(envContent, ".env");

      const context = {
        projectName: "test",
        projectRoot: process.cwd(),
        envFiles: [envFile],
        processes: [
          { name: "api", cmd: "echo", link: "http://localhost:${API_PORT}" },
          {
            name: "frontend",
            cmd: "echo",
            link: "http://localhost:${FRONTEND_PORT}",
          },
        ],
        containers: [],
        tasks: [],
        links: [],
        profiles: [],
        state: {},
      };

      const result = EnvResolver.resolveContext(context);

      expect(result.processes[0].link).toBe("http://localhost:3000");
      expect(result.processes[1].link).toBe("http://localhost:4000");
    });

    it("should interpolate ${VAR} in top-level link URLs", () => {
      const envContent = `
API_PORT=3000
DOCS_PORT=8080
      `;
      const envFile = createTempFile(envContent, ".env");

      const context = {
        projectName: "test",
        projectRoot: process.cwd(),
        envFiles: [envFile],
        processes: [],
        containers: [],
        tasks: [],
        links: [
          { name: "API", url: "http://localhost:${API_PORT}" },
          { name: "Docs", url: "http://localhost:${DOCS_PORT}/docs" },
        ],
        profiles: [],
        state: {},
      };

      const result = EnvResolver.resolveContext(context);

      expect(result.links[0].url).toBe("http://localhost:3000");
      expect(result.links[1].url).toBe("http://localhost:8080/docs");
    });

    it("should handle multiple variables in same URL", () => {
      const envContent = `
HOST=myapp.local
PORT=3000
      `;
      const envFile = createTempFile(envContent, ".env");

      const context = {
        projectName: "test",
        projectRoot: process.cwd(),
        envFiles: [envFile],
        processes: [],
        containers: [],
        tasks: [],
        links: [{ name: "API", url: "http://${HOST}:${PORT}/api" }],
        profiles: [],
        state: {},
      };

      const result = EnvResolver.resolveContext(context);

      expect(result.links[0].url).toBe("http://myapp.local:3000/api");
    });

    it("should leave undefined variables as empty", () => {
      const envContent = `
PORT=3000
      `;
      const envFile = createTempFile(envContent, ".env");

      const context = {
        projectName: "test",
        projectRoot: process.cwd(),
        envFiles: [envFile],
        processes: [],
        containers: [],
        tasks: [],
        links: [{ name: "API", url: "http://localhost:${UNDEFINED_VAR}" }],
        profiles: [],
        state: {},
      };

      const result = EnvResolver.resolveContext(context);

      expect(result.links[0].url).toBe("http://localhost:");
    });
  });
});
