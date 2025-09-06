import { z } from "zod";

export const duplicateValidation = <T extends z.ZodTypeAny>(schema: T) =>
  schema.refine(
    (config: any) => {
      const seen = new Map<string, string>();

      const add = (id: string, where: string) => {
        if (seen.has(id)) {
          return false;
        }
        seen.set(id, where);
        return true;
      };

      if (config.bare_metal) {
        for (const [name, proc] of Object.entries(config.bare_metal)) {
          if (!add(name, `bare_metal['${name}']`)) {
            return false;
          }
          if ((proc as any).aliases) {
            for (const alias of (proc as any).aliases) {
              if (!add(alias, `bare_metal['${name}'].aliases`)) {
                return false;
              }
            }
          }
        }
      }

      const containers = config.docker || config.containers;
      if (containers) {
        for (const [name, container] of Object.entries(containers)) {
          if (!add(name, `docker['${name}']`)) {
            return false;
          }
          if ((container as any).aliases) {
            for (const alias of (container as any).aliases) {
              if (!add(alias, `docker['${name}'].aliases`)) {
                return false;
              }
            }
          }
        }
      }

      return true;
    },
    {
      message:
        "Duplicate service identifier. Names and aliases must be globally unique across bare_metal and docker",
    },
  );
