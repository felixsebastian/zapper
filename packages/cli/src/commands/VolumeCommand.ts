import { StoredVolume } from "../config/schemas";
import {
  collectManagedVolumeSpecs,
  findStaleManagedVolumes,
  pruneStaleManagedVolumesForInstance,
  resetManagedVolumesForInstance,
} from "../config/volumeManager";
import { DockerManager } from "../core/docker";
import { confirm } from "../utils/confirm";
import { renderer } from "../ui/renderer";
import { CommandHandler, CommandContext } from "./CommandHandler";
import { CommandResult } from "./CommandResult";

export class VolumeCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<CommandResult> {
    const { zapper, options, service } = context;
    const ctx = zapper.getContext();
    if (!ctx) throw new Error("Context not loaded");
    if (Array.isArray(service)) {
      throw new Error("Volume command accepts one subcommand: prune or reset");
    }

    const subcommand = service || "prune";
    if (subcommand !== "prune" && subcommand !== "reset") {
      throw new Error(`Unknown volume command: ${subcommand}`);
    }

    if (subcommand === "reset") {
      const reset = resetManagedVolumesForInstance(
        ctx.projectRoot,
        ctx.instanceKey,
      );
      return {
        kind: "volume.reset",
        instanceKey: ctx.instanceKey,
        volumes: reset,
      };
    }

    const currentSpecs = collectManagedVolumeSpecs(ctx.containers);
    const stale = findStaleManagedVolumes(
      ctx.projectRoot,
      ctx.instanceKey,
      currentSpecs,
    );
    const volumeNames = Object.keys(stale);
    if (volumeNames.length === 0) {
      return {
        kind: "volume.prune",
        status: "completed",
        instanceKey: ctx.instanceKey,
        volumes: stale,
      };
    }

    renderer.log.info(
      `This will remove ${volumeNames.length} stale managed Docker volume(s) for instance "${ctx.instanceKey}".`,
    );
    const proceed = await confirm(
      renderer.confirm.deleteResourcesPromptText(),
      {
        defaultYes: false,
        force: options.force,
      },
    );

    if (!proceed) {
      return {
        kind: "volume.prune",
        status: "aborted",
        instanceKey: ctx.instanceKey,
        volumes: stale,
      };
    }

    for (const volumeName of volumeNames) {
      await DockerManager.removeVolume(volumeName);
    }
    pruneStaleManagedVolumesForInstance(
      ctx.projectRoot,
      ctx.instanceKey,
      currentSpecs,
    );

    return {
      kind: "volume.prune",
      status: "completed",
      instanceKey: ctx.instanceKey,
      volumes: stale,
    };
  }
}

export type VolumeCommandVolumes = Record<string, StoredVolume>;
