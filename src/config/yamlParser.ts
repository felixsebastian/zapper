import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZapperConfig } from "../utils";

export function parseYamlFile(filePath: string): ZapperConfig {
  try {
    const content = readFileSync(filePath, "utf8");
    return parse(content) as ZapperConfig;
  } catch (error) {
    throw new Error(`Failed to parse YAML file: ${error}`);
  }
}
