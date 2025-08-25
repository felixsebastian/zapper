import { existsSync, statSync } from "fs";
import path from "path";

export function findFileUpwards(
  startDir: string,
  candidateFilenames: string[] = ["zap.yaml", "zap.yml"],
): string | null {
  let current = path.resolve(startDir);
  while (true) {
    for (const name of candidateFilenames) {
      const p = path.join(current, name);
      if (existsSync(p)) return p;
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function resolveConfigPath(input?: string): string | null {
  // If input provided, interpret it
  if (input && input.trim().length > 0) {
    const given = path.resolve(input);
    if (existsSync(given)) {
      try {
        const stat = statSync(given);
        if (stat.isDirectory()) {
          const inDir = findFileUpwards(given);
          return inDir;
        }
        return given;
      } catch (_) {
        return null;
      }
    }
    // If it's a directory that doesn't exist or file not found, fall back to upward search from cwd
  }
  return findFileUpwards(process.cwd());
}
