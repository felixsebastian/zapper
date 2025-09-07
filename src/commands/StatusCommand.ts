import { CommandHandler, CommandContext } from "./CommandHandler";
import { Pm2Manager } from "../process";
import { DockerManager } from "../docker";
import { logger } from "../utils/logger";

export class StatusCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;
    const project = zapper.getProject();
    const all = !!options.all;
    const pm2List = await Pm2Manager.listProcesses();

    // PM2 names are like zap.<project>.<service>
    const filtered = pm2List.filter((p) => {
      if (all || !project) return true;
      return p.name.startsWith(`zap.${project}.`);
    });

    const bareMetal = filtered
      .map((p) => ({
        rawName: p.name,
        service: p.name.split(".").pop() || p.name,
        status: p.status,
      }))
      .filter((p) => (!service ? true : p.service === service));

    const allDocker = await DockerManager.listContainers();
    const docker = allDocker
      .map((c) => {
        const name =
          (c as unknown as Record<string, string>)["name"] ||
          (c as unknown as Record<string, string>)["Names"] ||
          "";
        const status =
          (c as unknown as Record<string, string>)["status"] ||
          (c as unknown as Record<string, string>)["Status"] ||
          "";
        return {
          rawName: name,
          service: name.split(".").pop() || name,
          status,
        };
      })
      .filter((c) => {
        if (!c.rawName) return false;
        if (!all && project) return c.rawName.startsWith(`zap.${project}.`);
        return true;
      })
      .filter((c) => (!service ? true : c.service === service));

    // minimal local color helpers for status text
    const color = {
      reset: "\u001B[0m",
      red: "\u001B[31m",
      green: "\u001B[32m",
    } as const;

    const formatPm2Status = (status: string) => {
      const s = status.toLowerCase();
      if (s === "online") return `${color.green}${status}${color.reset}`;
      if (s === "stopped" || s === "stopping")
        return `${color.red}${status}${color.reset}`;
      if (s === "errored" || s === "error")
        return `${color.red}${status}${color.reset}`;
      return status;
    };

    const formatDockerStatus = (status: string) => {
      const s = status.toLowerCase();
      if (s.includes("up")) return `${color.green}${status}${color.reset}`;
      if (
        s.includes("exited") ||
        s.includes("dead") ||
        s.includes("restarting")
      )
        return `${color.red}${status}${color.reset}`;
      return status;
    };

    const bareMetalSection = ["⛓️ Bare metal"]
      .concat(
        bareMetal.length > 0
          ? bareMetal.map((p) => `${p.service}  ${formatPm2Status(p.status)}`)
          : ["(none)"],
      )
      .join("\n");

    const dockerSection = ["🐳 Docker"]
      .concat(
        docker.length > 0
          ? docker.map((c) => `${c.service}  ${formatDockerStatus(c.status)}`)
          : ["(none)"],
      )
      .join("\n");

    logger.info(`Status:\n${bareMetalSection}\n\n${dockerSection}`);
  }
}
