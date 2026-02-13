import { StatusResult, ServiceStatus } from "./getStatus";
import { Context } from "../types/Context";

const color = {
  reset: "\u001B[0m",
  red: "\u001B[31m",
  green: "\u001B[32m",
  yellow: "\u001B[33m",
  grey: "\u001B[90m",
} as const;

function formatServiceStatus(status: string, enabled: boolean): string {
  if (!enabled) return `${color.grey}${status}${color.reset}`;
  if (status === "up") return `${color.green}${status}${color.reset}`;
  if (status === "pending") return `${color.yellow}${status}${color.reset}`;
  if (status === "down") return `${color.red}${status}${color.reset}`;
  return status;
}

function formatServiceName(name: string, enabled: boolean): string {
  if (!enabled) return `${color.grey}${name}${color.reset}`;
  return name;
}

function formatServiceLine(s: ServiceStatus): string {
  const name = formatServiceName(s.service, s.enabled);
  const status = formatServiceStatus(s.status, s.enabled);
  return `${name} ${status}`;
}

export function formatStatus(
  statusResult: StatusResult,
  context?: Context,
): string {
  const sections: string[] = [];

  // Add project header with instance info if available
  if (context) {
    let header = context.projectName;
    if (context.instanceId) {
      header += ` (instance: ${context.instanceId})`;
    }
    header += "\n"; // Add blank line
    sections.push(header);
  }

  if (statusResult.native.length > 0) {
    const nativeSection = ["💾 Native"]
      .concat(statusResult.native.map(formatServiceLine))
      .join("\n");
    sections.push(nativeSection);
  }

  if (statusResult.docker.length > 0) {
    const dockerSection = ["🐳 Docker"]
      .concat(statusResult.docker.map(formatServiceLine))
      .join("\n");
    sections.push(dockerSection);
  }

  return sections.join("\n\n");
}

export function formatStatusAsJson(statusResult: StatusResult): string {
  return JSON.stringify(statusResult);
}
