import { Process } from "../types";
import { ProcessExecutor } from "../core/strategies";
import { Pm2Manager } from "./pm2-manager";

export class Pm2Executor implements ProcessExecutor {
  private projectName?: string;

  constructor(projectName?: string) {
    this.projectName = projectName;
  }

  async startProcess(process: Process, projectName: string): Promise<void> {
    await Pm2Manager.startProcess(process, projectName);
  }

  async stopProcess(processName: string): Promise<void> {
    await Pm2Manager.stopProcess(processName, this.projectName);
  }

  async restartProcess(processName: string): Promise<void> {
    await Pm2Manager.restartProcess(processName, this.projectName);
  }
}
