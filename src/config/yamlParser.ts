import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZodConfigValidator } from "./ZodConfigValidator";
import { ZapperConfig } from "./schemas";
import { normalizeConfig } from "./configNormalizer";

export function parseYamlFile(filePath: string): ZapperConfig {
  try {
    const content = readFileSync(filePath, "utf8");
    const parsed = parse(content);
    const normalized = normalizeConfig(parsed);
    return ZodConfigValidator.validate(normalized);
  } catch (error) {
    throw new Error(`Failed to parse YAML file: ${error}`);
  }
}
