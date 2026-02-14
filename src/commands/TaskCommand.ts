import { CommandHandler, CommandContext } from "./CommandHandler";
import { renderer } from "../ui/renderer";

export class TaskCommand extends CommandHandler {
  async execute(context: CommandContext): Promise<void> {
    const { zapper, service, options, taskParams } = context;

    if (!service) {
      const zapperContext = zapper.getContext();
      if (!zapperContext) throw new Error("Context not loaded");

      if (options.json) {
        renderer.machine.json(renderer.tasks.toJson(zapperContext.tasks));
      } else {
        renderer.log.report(renderer.tasks.toText(zapperContext.tasks));
      }
      return;
    }

    // Handle --list-params option
    if (options.listParams) {
      const zapperContext = zapper.getContext();
      if (!zapperContext) throw new Error("Context not loaded");

      const task = zapperContext.tasks.find((t) => t.name === service);
      if (!task) throw new Error(`Task not found: ${service}`);

      renderer.machine.json(
        renderer.tasks.paramsToJson(task, zapperContext.taskDelimiters),
      );
      return;
    }

    await zapper.runTask(service, taskParams);
  }
}
