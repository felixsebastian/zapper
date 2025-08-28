import { ZapperConfig, Process } from "../utils";

export const findProcess = (
  config: ZapperConfig,
  name: string,
): Process | undefined => {
  if (config.bare_metal && config.bare_metal[name]) {
    const p = config.bare_metal[name];
    return { ...p, name: p.name || name };
  }
  if (Array.isArray(config.processes)) {
    return config.processes.find((p) => p.name === name);
  }
  return undefined;
};
