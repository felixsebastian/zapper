import { StoredVolume, ZapperState } from "../config/schemas";
import { StatusResult } from "../core/getStatus";
import { ServiceListResult } from "../core/getServiceList";
import type {
  SystemProjectStatus,
  SystemResourceAuditResult,
  SystemRegistryProject,
} from "../system";
import { Context, Task } from "../types/Context";

export interface ProjectLinkResult {
  name: string;
  url: string;
  isHomepage: boolean;
}

export type CommandResult =
  | {
      kind: "status";
      statusResult: StatusResult;
      context?: Context;
    }
  | {
      kind: "list";
      listResult: ServiceListResult;
      context: Context;
    }
  | {
      kind: "tasks.list";
      tasks: Task[];
    }
  | {
      kind: "tasks.params";
      task: Task;
      delimiters?: [string, string];
    }
  | {
      kind: "profiles.list";
      profiles: string[];
    }
  | {
      kind: "environments.list";
      environments: string[];
    }
  | {
      kind: "env.service";
      resolvedEnv: Record<string, string>;
    }
  | {
      kind: "state";
      state: ZapperState;
    }
  | {
      kind: "config";
      filteredConfig: unknown;
      pretty: boolean;
    }
  | {
      kind: "services.action";
      action: "up" | "down" | "restart";
      services?: string[];
    }
  | {
      kind: "clone.completed";
      services?: string[];
    }
  | {
      kind: "reset";
      status: "aborted" | "completed";
    }
  | {
      kind: "kill";
      status: "aborted" | "completed";
      projectName: string;
      prefix: string;
      pm2: string[];
      containers: string[];
    }
  | {
      kind: "launch.opened";
      url: string;
    }
  | {
      kind: "links.list";
      links: ProjectLinkResult[];
    }
  | {
      kind: "home.value";
      value: string;
    }
  | {
      kind: "notes.value";
      value: string;
    }
  | {
      kind: "git.checkout.completed";
      branch: string;
    }
  | {
      kind: "git.pull.completed";
    }
  | {
      kind: "git.status.completed";
    }
  | {
      kind: "git.stash.completed";
    }
  | {
      kind: "profiles.picker";
      profiles: string[];
      activeProfile?: string;
    }
  | {
      kind: "profiles.enabled";
      profile: string;
      startedServices: string[];
    }
  | {
      kind: "profiles.disabled";
      activeProfile?: string;
    }
  | {
      kind: "environments.picker";
      environments: string[];
      activeEnvironment?: string;
    }
  | {
      kind: "environments.enabled";
      environment: string;
    }
  | {
      kind: "environments.disabled";
      activeEnvironment?: string;
    }
  | {
      kind: "global.list";
      allProjects?: boolean;
      projects: Array<{
        name: string;
        prefix: string;
        pm2: string[];
        containers: string[];
      }>;
    }
  | {
      kind: "global.kill";
      status: "aborted" | "completed";
      allProjects: boolean;
      projects: Array<{
        name: string;
        prefix: string;
        pm2: string[];
        containers: string[];
      }>;
    }
  | {
      kind: "system.projects";
      projects: SystemProjectStatus[];
    }
  | {
      kind: "system.registry.prune";
      removed: SystemRegistryProject[];
    }
  | {
      kind: "system.registry.forget";
      removed: SystemRegistryProject | null;
    }
  | {
      kind: "system.registry.repair";
      removed: SystemRegistryProject[];
      projects: SystemProjectStatus[];
    }
  | {
      kind: "system.resources.audit";
      audit: SystemResourceAuditResult;
    }
  | {
      kind: "system.resources.cleanup";
      status: "aborted" | "completed";
      cleanup: SystemResourceAuditResult;
    }
  | {
      kind: "init";
      isolated: boolean;
      instanceKey: string;
      instanceId?: string;
      ports: Record<string, string>;
      path: string;
      randomized: boolean;
      warningShown: boolean;
    }
  | {
      kind: "instance.label";
      instanceKey: string;
      instanceId: string;
      label?: string;
      displayLabel: string;
      updated: boolean;
    }
  | {
      kind: "volume.reset";
      instanceKey: string;
      volumes: Record<string, StoredVolume>;
    }
  | {
      kind: "volume.prune";
      status: "aborted" | "completed";
      instanceKey: string;
      volumes: Record<string, StoredVolume>;
    };
