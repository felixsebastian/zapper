import { ZapperConfig, Process } from "../utils";

export const findProcess = (
  config: ZapperConfig,
  name: string,
): Process | undefined => {
  const bareMetal = config.bare_metal?.[name];
  if (bareMetal) return bareMetal;
  return undefined;
};
