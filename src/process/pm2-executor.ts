import { Process } from "../types";
import { ProcessExecutor } from "../core/strategies";
import { Pm2Manager } from "./pm2-manager";

export class Pm2Executor implements ProcessExecutor {
  async startProcess(process: Process): Promise<void> {
    await Pm2Manager.startProcess(process);
  }

  async stopProcess(processName: string): Promise<void> {
    await Pm2Manager.stopProcess(processName);
  }

  async restartProcess(processName: string): Promise<void> {
    await Pm2Manager.restartProcess(processName);
  }
}
