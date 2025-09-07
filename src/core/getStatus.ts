import { Pm2Manager } from "./process";
import { DockerManager } from "./docker";

export interface ServiceStatus {
  service: string;
  rawName: string;
  status: string;
  type: "bare_metal" | "docker";
}

export interface StatusResult {
  bareMetal: ServiceStatus[];
  docker: ServiceStatus[];
}

export async function getStatus(
  project?: string | null,
  service?: string,
  all: boolean = false,
): Promise<StatusResult> {
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
      type: "bare_metal" as const,
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
        type: "docker" as const,
      };
    })
    .filter((c) => {
      if (!c.rawName) return false;
      if (!all && project) return c.rawName.startsWith(`zap.${project}.`);
      return true;
    })
    .filter((c) => (!service ? true : c.service === service));

  return { bareMetal, docker };
}
