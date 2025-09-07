import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZodConfigValidator } from "./ZodConfigValidator";
import { ZapperConfig } from "./schemas";

export function parseYamlFile(
  filePath: string,
  projectRoot?: string,
): ZapperConfig {
  try {
    const content = readFileSync(filePath, "utf8");
    const parsed = parse(content);
    return ZodConfigValidator.validate(parsed, projectRoot);
  } catch (error) {
    throw new Error(`Failed to parse YAML file: ${error}`);
  }
}
