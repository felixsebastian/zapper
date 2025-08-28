import { ZapperConfig, Container } from "../utils";

export const findContainer = (
  config: ZapperConfig,
  name: string,
): [string, Container] | undefined => {
  const docker = config.docker || config.containers;
  if (!docker) return undefined;
  const c = docker[name];
  if (!c) return undefined;
  return [name, c];
};
