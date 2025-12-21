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
        bare_metal: {
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

      expect(result.bare_metal!.test.env).toEqual(["MYENV", "APP_ENV"]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({
        MYENV: "foo",
        APP_ENV: "development",
      });

      expect(result.bare_metal!.server.env).toEqual(["NODE_ENV", "PORT"]);
      expect(result.bare_metal!.server.resolvedEnv).toEqual({
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
        bare_metal: {
          test: {
            name: "test",
            cmd: "echo hello",
            // No envs field
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.bare_metal!.test.env).toEqual([]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({});
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
        bare_metal: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: [],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.bare_metal!.test.env).toEqual([]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({});
    });

    it("should handle processes with existing env whitelist", () => {
      const envContent = `
CUSTOM_VAR=custom_value
      `;
      const envFile = createTempFile(envContent, ".env");

      const config: ZapperConfig = {
        project: "test",
        env_files: [envFile],
        bare_metal: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: ["CUSTOM_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.bare_metal!.test.env).toEqual(["CUSTOM_VAR"]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({
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
        bare_metal: {
          test: {
            name: "test",
            cmd: "echo hello",
            envs: ["LEGACY_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.bare_metal!.test.env).toEqual(["LEGACY_VAR"]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({
        LEGACY_VAR: "legacy_value",
      });
    });

    it("should handle processes with no env files", () => {
      const config: ZapperConfig = {
        project: "test",
        bare_metal: {
          test: {
            name: "test",
            cmd: "echo hello",
            env: ["SOME_VAR"],
          },
        },
      };

      const result = EnvResolver.resolve(config);

      expect(result.bare_metal!.test.env).toEqual(["SOME_VAR"]);
      expect(result.bare_metal!.test.resolvedEnv).toEqual({});
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
        bare_metal: {
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
        bare_metal: {
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
        bare_metal: {
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
});
