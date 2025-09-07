import { Process } from "../../config/schemas";
import { Pm2Manager } from "./Pm2Manager";

export class Pm2Executor {
  private projectName?: string;
  private configDir?: string;

  constructor(projectName?: string, configDir?: string) {
    this.projectName = projectName;
    this.configDir = configDir;
  }

  async startProcess(process: Process, projectName: string): Promise<void> {
    await Pm2Manager.startProcessWithTempEcosystem(
      projectName,
      process,
      this.configDir,
    );
  }

  async stopProcess(processName: string): Promise<void> {
    await Pm2Manager.deleteAllMatchingProcesses(
      processName,
      this.projectName,
      this.configDir,
    );
  }

  async restartProcess(processName: string): Promise<void> {
    await Pm2Manager.restartProcess(processName, this.projectName);
  }

  async showLogs(processName: string, follow: boolean = false): Promise<void> {
    await Pm2Manager.showLogs(
      processName,
      this.projectName,
      follow,
      this.configDir,
    );
  }
}
