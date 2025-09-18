import { z } from "zod";
import { processValidation, duplicateValidation } from "./validators";

const validNameSchema = z
  .string()
  .min(1, "Name cannot be empty")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Name must contain only alphanumeric characters, underscores, and hyphens",
  );

export const VolumeSchema = z.object({
  name: z.string().min(1, "Volume name cannot be empty"),
  internal_dir: z
    .string()
    .min(1, "Internal directory cannot be empty")
    .startsWith("/", "Internal directory must be an absolute path"),
});

export const ContainerVolumeSchema = z.union([
  VolumeSchema,
  z
    .string()
    .regex(
      /^[^:]+:[^:]+$/,
      "Volume string must be in 'name:/container/path' form",
    ),
]);

export const ProcessSchema = z.object({
  name: z.string().optional(),
  cmd: z.string().min(1, "Command cannot be empty"),
  cwd: z.string().optional(),
  envs: z.array(z.string()).optional(),
  env: z.array(z.string()).optional(),
  aliases: z.array(validNameSchema).optional(),
  resolvedEnv: z.record(z.string(), z.string()).optional(),
  source: z.string().optional(),
  repo: z.string().optional(),
  env_files: z.array(z.string()).optional(),
  profiles: z
    .array(z.string().min(1, "Profile name cannot be empty"))
    .optional(),
});

export const ContainerSchema = z.object({
  name: z.string().optional(),
  image: z.string().min(1, "Image cannot be empty"),
  ports: z.array(z.string().min(1, "Port cannot be empty")).optional(),
  env: z
    .array(z.string().min(1, "Environment variable cannot be empty"))
    .optional(),
  volumes: z.array(ContainerVolumeSchema).optional(),
  networks: z
    .array(z.string().min(1, "Network name cannot be empty"))
    .optional(),
  command: z.string().optional(),
  aliases: z.array(validNameSchema).optional(),
  resolvedEnv: z.record(z.string(), z.string()).optional(),
  profiles: z
    .array(z.string().min(1, "Profile name cannot be empty"))
    .optional(),
});

export const TaskCmdSchema = z.union([
  z.string(),
  z.object({
    task: z.string().min(1, "Task name cannot be empty"),
  }),
]);

export const TaskSchema = z.object({
  name: z.string().optional(),
  desc: z.string().optional(),
  cmds: z.array(TaskCmdSchema).min(1, "Task must have at least one command"),
  env: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  aliases: z.array(validNameSchema).optional(),
  resolvedEnv: z.record(z.string(), z.string()).optional(),
  env_files: z.array(z.string()).optional(),
});

export const ZapperConfigSchema = processValidation(
  duplicateValidation(
    z.object({
      project: validNameSchema,
      env_files: z
        .array(z.string().min(1, "Environment file path cannot be empty"))
        .optional(),
      git_method: z.enum(["http", "ssh", "cli"]).optional(),
      bare_metal: z.record(validNameSchema, ProcessSchema).optional(),
      docker: z.record(validNameSchema, ContainerSchema).optional(),
      containers: z.record(validNameSchema, ContainerSchema).optional(),
      processes: z.array(ProcessSchema).optional(),
      tasks: z.record(validNameSchema, TaskSchema).optional(),
    }),
  ),
);

export type Process = z.infer<typeof ProcessSchema>;
export type Container = z.infer<typeof ContainerSchema>;
export type Volume = z.infer<typeof VolumeSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type ZapperConfig = z.infer<typeof ZapperConfigSchema>;
