import { StatusResult } from "./getStatus";

// minimal local color helpers for status text
const color = {
  reset: "\u001B[0m",
  red: "\u001B[31m",
  green: "\u001B[32m",
} as const;

function formatPm2Status(status: string): string {
  const s = status.toLowerCase();
  if (s === "online") return `${color.green}${status}${color.reset}`;
  if (s === "stopped" || s === "stopping")
    return `${color.red}${status}${color.reset}`;
  if (s === "errored" || s === "error")
    return `${color.red}${status}${color.reset}`;
  return status;
}

function formatDockerStatus(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("up")) return `${color.green}${status}${color.reset}`;
  if (s.includes("exited") || s.includes("dead") || s.includes("restarting"))
    return `${color.red}${status}${color.reset}`;
  return status;
}

export function formatStatus(statusResult: StatusResult): string {
  const bareMetalSection = ["⛓️ Bare metal"]
    .concat(
      statusResult.bareMetal.length > 0
        ? statusResult.bareMetal.map(
            (p) => `${p.service}  ${formatPm2Status(p.status)}`,
          )
        : ["(none)"],
    )
    .join("\n");

  const dockerSection = ["🐳 Docker"]
    .concat(
      statusResult.docker.length > 0
        ? statusResult.docker.map(
            (c) => `${c.service}  ${formatDockerStatus(c.status)}`,
          )
        : ["(none)"],
    )
    .join("\n");

  return `Status:\n${bareMetalSection}\n\n${dockerSection}`;
}
