import { ZapperConfig } from "../config/schemas";
import * as path from "path";

export interface BareMetalTarget {
  name: string;
  cwd: string;
}

export function getBareMetalTargets(
  config: ZapperConfig | null,
  configDir: string | null,
): BareMetalTarget[] {
  if (!config || !configDir) return [];

  const entries = config.bare_metal ? Object.entries(config.bare_metal) : [];

  return entries
    .filter(([, p]) => !!p.repo)
    .map(([name, process]) => {
      const cwd =
        process.cwd && process.cwd.trim().length > 0 ? process.cwd : name;

      const resolved = path.isAbsolute(cwd) ? cwd : path.join(configDir, cwd);
      return { name, cwd: resolved };
    });
}
