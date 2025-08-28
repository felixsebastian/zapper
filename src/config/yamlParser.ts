import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZapperConfig } from "../utils";

export function parseYamlFile(filePath: string): ZapperConfig {
  try {
    const content = readFileSync(filePath, "utf8");
    const config = parse(content) as ZapperConfig;
    return config;
  } catch (error) {
    throw new Error(`Failed to parse YAML file: ${error}`);
  }
}

export function parseYamlString(content: string): ZapperConfig {
  try {
    const config = parse(content) as ZapperConfig;
    return config;
  } catch (error) {
    throw new Error(`Failed to parse YAML content: ${error}`);
  }
}
