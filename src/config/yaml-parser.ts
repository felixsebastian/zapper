import { readFileSync } from "fs";
import { parse } from "yaml";
import { ZapperConfig } from "../types";

export class YamlParser {
  static parse(filePath: string): ZapperConfig {
    try {
      const content = readFileSync(filePath, "utf8");
      const config = parse(content) as ZapperConfig;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse YAML file: ${error}`);
    }
  }

  static parseString(content: string): ZapperConfig {
    try {
      const config = parse(content) as ZapperConfig;
      return config;
    } catch (error) {
      throw new Error(`Failed to parse YAML content: ${error}`);
    }
  }
}
