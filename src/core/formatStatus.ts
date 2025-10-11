import { StatusResult } from "./getStatus";

// minimal local color helpers for status text
const color = {
  reset: "\u001B[0m",
  red: "\u001B[31m",
  green: "\u001B[32m",
} as const;

function formatServiceStatus(status: string): string {
  if (status === "up") return `${color.green}${status}${color.reset}`;
  if (status === "down") return `${color.red}${status}${color.reset}`;
  return status;
}

export function formatStatus(statusResult: StatusResult): string {
  const sections: string[] = [];

  if (statusResult.bareMetal.length > 0) {
    const bareMetalSection = ["💾 Bare metal"]
      .concat(
        statusResult.bareMetal.map(
          (p) => `${p.service} ${formatServiceStatus(p.status)}`,
        ),
      )
      .join("\n");
    sections.push(bareMetalSection);
  }

  if (statusResult.docker.length > 0) {
    const dockerSection = ["🐳 Docker"]
      .concat(
        statusResult.docker.map(
          (c) => `${c.service} ${formatServiceStatus(c.status)}`,
        ),
      )
      .join("\n");
    sections.push(dockerSection);
  }

  return sections.join("\n\n");
}

export function formatStatusAsJson(statusResult: StatusResult): string {
  return JSON.stringify(statusResult);
}
