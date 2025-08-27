#!/usr/bin/env node

import { CommandParser } from "./cli/command-parser";
import { Zapper } from "./core/zapper";
import { logger, LogLevel } from "./utils/logger";
import { confirm } from "./utils/prompt";
import { Pm2Manager } from "./process/pm2-manager";
import { DockerManager } from "./containers";

declare const process: {
  argv: string[];
  exit: (code: number) => never;
};

async function main() {
  try {
    const options = CommandParser.parse(process.argv);

    // Configure logging based on CLI options
    if (options.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else if (options.verbose) {
      logger.setLevel(LogLevel.INFO);
    } else if (options.quiet) {
      logger.setLevel(LogLevel.WARN);
    }

    const zapper = new Zapper();

    // Load config
    await zapper.loadConfig(options.config);

    const resolvedService = options.service
      ? zapper.resolveServiceName(options.service)
      : undefined;

    switch (options.command) {
      case "up":
        if (resolvedService) await zapper.startProcesses([resolvedService]);
        else await zapper.startProcesses();
        break;

      case "down":
        if (resolvedService) {
          await zapper.stopProcesses([resolvedService]);
        } else {
          const proceed = await confirm(
            "This will stop all bare metal processes. Continue?",
            { defaultYes: false, force: options.force },
          );
          if (!proceed) {
            logger.info("Aborted.");
            return;
          }
          await zapper.stopProcesses();
        }
        break;

      case "restart":
        if (resolvedService) await zapper.restartProcesses([resolvedService]);
        else await zapper.restartProcesses();
        break;

      case "status": {
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
          .filter((p) =>
            !resolvedService ? true : p.service === resolvedService,
          );

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
          .filter((c) =>
            !resolvedService ? true : c.service === resolvedService,
          );

        const emojiForPm2 = (status: string) => {
          const s = status.toLowerCase();
          if (s === "online") return "🟢";
          if (s === "stopped" || s === "stopping") return "🛑";
          if (s === "errored" || s === "error") return "🔴";
          if (s === "launching") return "🟡";
          if (s === "waiting restart") return "🟠";
          return "⚪️";
        };

        const emojiForDocker = (status: string) => {
          const s = status.toLowerCase();
          if (s.includes("up")) return "🟢";
          if (s.includes("exited") || s.includes("dead")) return "🔴";
          if (s.includes("restarting")) return "🟡";
          if (s.includes("created")) return "⚪️";
          return "⚪️";
        };

        const bareMetalSection = ["⛓️ Bare metal"]
          .concat(
            bareMetal.length > 0
              ? bareMetal.map(
                  (p) => `${emojiForPm2(p.status)}  ${p.service}  ${p.status}`,
                )
              : ["(none)"],
          )
          .join("\n");

        const dockerSection = ["🐳 Docker"]
          .concat(
            docker.length > 0
              ? docker.map(
                  (c) =>
                    `${emojiForDocker(c.status)}  ${c.service}  ${c.status}`,
                )
              : ["(none)"],
          )
          .join("\n");

        logger.info(`Status:\n${bareMetalSection}\n\n${dockerSection}`);
        break;
      }

      case "logs": {
        if (!resolvedService) {
          throw new Error(
            "Service name required for logs command. Use: zap logs --service <name>",
          );
        }
        const follow = options.follow ?? true;
        logger.info(
          `Showing logs for ${resolvedService}${follow ? " (following)" : ""}`,
        );
        await zapper.showLogs(resolvedService, follow);
        break;
      }

      case "reset": {
        const proceed = await confirm(
          "This will stop all processes and delete the .zap folder. Continue?",
          { defaultYes: false, force: options.force },
        );
        if (!proceed) {
          logger.info("Aborted.");
          return;
        }
        await zapper.reset();
        break;
      }

      case "clone": {
        await zapper.cloneRepos(
          resolvedService ? [resolvedService] : undefined,
        );
        break;
      }

      default:
        logger.info(CommandParser.getHelp());
        break;
    }
  } catch (error) {
    logger.error(String(error));
    process.exit(1);
  }
}

main();
