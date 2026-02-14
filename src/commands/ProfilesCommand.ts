import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";
import { StateManager } from "../core/StateManager";
import { Process, Container } from "../types/Context";

export class ProfilesCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options } = context;

    const zapperContext = zapper.getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }

    // Handle --disable flag
    if (options.disable) {
      const stateManager = new StateManager(
        zapper,
        zapperContext.projectRoot,
        options.config,
      );
      await this.disableProfile(
        stateManager,
        zapperContext.state.activeProfile,
      );
      return;
    }

    // Handle --list flag
    if (options.list) {
      const json = !!options.json;
      if (json) {
        renderer.machine.json(renderer.profiles.toJson(zapperContext.profiles));
      } else {
        renderer.log.report(renderer.profiles.toText(zapperContext.profiles));
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

      const stateManager = new StateManager(
        zapper,
        zapperContext.projectRoot,
        options.config,
      );
      await this.enableProfile(stateManager, service);
      return;
    }

    // Handle interactive picker
    await this.showInteractivePicker(
      zapperContext.profiles,
      zapperContext.state.activeProfile,
    );
  }

  private async enableProfile(
    stateManager: StateManager,
    profileName: string,
  ): Promise<void> {
    renderer.log.info(`Enabling profile: ${profileName}`);

    // Update the active profile state (this also reloads config)
    await stateManager.setActiveProfile(profileName);

    // Get all services that have this profile from the updated context
    const zapperContext = stateManager.getZapper().getContext();
    if (!zapperContext) {
      throw new Error("Context not loaded");
    }
    const servicesToStart: string[] = [];

    // Check processes
    zapperContext.processes.forEach((process: Process) => {
      if (
        Array.isArray(process.profiles) &&
        process.profiles.includes(profileName)
      ) {
        servicesToStart.push(process.name);
      }
    });

    // Check containers
    zapperContext.containers.forEach((container: Container) => {
      if (
        Array.isArray(container.profiles) &&
        container.profiles.includes(profileName)
      ) {
        servicesToStart.push(container.name);
      }
    });

    if (servicesToStart.length === 0) {
      renderer.log.info(`No services found for profile: ${profileName}`);
      return;
    }

    renderer.log.info(`Starting services: ${servicesToStart.join(", ")}`);
    await stateManager.getZapper().startProcesses(servicesToStart);
  }

  private async disableProfile(
    stateManager: StateManager,
    currentActiveProfile?: string,
  ): Promise<void> {
    if (!currentActiveProfile) {
      renderer.log.info("No active profile to disable");
      return;
    }

    renderer.log.info(`Disabling active profile: ${currentActiveProfile}`);

    // Clear the active profile state (this also reloads config)
    await stateManager.clearActiveProfile();

    renderer.log.info("Active profile disabled");

    // Run startAll to bring system to good state (stop services that were only running due to the disabled profile)
    renderer.log.info("Adjusting services to match new state...");
    await stateManager.getZapper().startProcesses(); // This will call startAll with no active profile
  }

  private async showInteractivePicker(
    profiles: string[],
    activeProfile?: string,
  ): Promise<void> {
    renderer.log.report(renderer.profiles.pickerText(profiles, activeProfile));
  }
}
