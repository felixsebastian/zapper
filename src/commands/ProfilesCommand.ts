import { CommandHandler, CommandContext } from "./CommandHandler";
import { formatProfiles, formatProfilesAsJson } from "../core/formatProfiles";
import { logger } from "../utils/logger";
import { saveState } from "../config/stateLoader";
import { Zapper } from "../core/Zapper";
import { Process, Container } from "../types/Context";

export class ProfilesCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    // Handle --list flag
    if (options.list) {
      const json = !!options.json;
      if (json) {
        const jsonOutput = formatProfilesAsJson(zapperContext.profiles);
        console.log(jsonOutput);
      } else {
        const formattedOutput = formatProfiles(zapperContext.profiles);
        logger.info(formattedOutput, { noEmoji: true });
      }
      return;
    }

    // Handle specific profile selection
    if (service) {
      if (!zapperContext.profiles.includes(service)) {
        throw new Error(
          `Profile not found: ${service}. Available profiles: ${zapperContext.profiles.join(", ")}`,
        );
      }

      await this.enableProfile(zapper, service, zapperContext.projectRoot);
      return;
    }

    // Handle interactive picker
    await this.showInteractivePicker(
      zapperContext.profiles,
      zapperContext.state.activeProfile,
    );
  }

  private async enableProfile(
    zapper: Zapper,
    profileName: string,
    projectRoot: string,
  ): Promise<void> {
    logger.info(`Enabling profile: ${profileName}`);

    // Save the active profile to state
    saveState(projectRoot, { activeProfile: profileName });

    // Get all services that have this profile
    const context = zapper.getContext();
    if (!context) {
      throw new Error("Context not loaded");
    }
    const servicesToStart: string[] = [];

    // Check processes
    context.processes.forEach((process: Process) => {
      if (
        Array.isArray(process.profiles) &&
        process.profiles.includes(profileName)
      ) {
        servicesToStart.push(process.name);
      }
    });

    // Check containers
    context.containers.forEach((container: Container) => {
      if (
        Array.isArray(container.profiles) &&
        container.profiles.includes(profileName)
      ) {
        servicesToStart.push(container.name);
      }
    });

    if (servicesToStart.length === 0) {
      logger.info(`No services found for profile: ${profileName}`);
      return;
    }

    logger.info(`Starting services: ${servicesToStart.join(", ")}`);
    await zapper.startProcesses(servicesToStart);
  }

  private async showInteractivePicker(
    profiles: string[],
    activeProfile?: string,
  ): Promise<void> {
    if (profiles.length === 0) {
      logger.info("No profiles defined");
      return;
    }

    // Show current active profile if any
    if (activeProfile) {
      logger.info(`Currently active profile: ${activeProfile}`);
      logger.info("");
    }

    // For now, show a simple list and ask user to use the command with a profile name
    // TODO: Implement proper interactive picker with a library like inquirer
    logger.info("Available profiles:");
    profiles.forEach((profile, index) => {
      const isActive = profile === activeProfile;
      const marker = isActive ? " (active)" : "";
      logger.info(`  ${index + 1}. ${profile}${marker}`);
    });
    logger.info("\nTo enable a profile, use: zap profile <profile-name>");
  }
}
