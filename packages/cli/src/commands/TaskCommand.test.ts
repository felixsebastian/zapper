import { TaskCommand } from "./TaskCommand";
import { Zapper } from "../core/Zapper";
import { TaskNotFoundError } from "../errors";
import { vi, describe, it, expect } from "vitest";
import { Context } from "../types";

describe("TaskCommand", () => {
  it("throws TaskNotFoundError when listing params for an unknown task", async () => {
    const zapper = new Zapper();
    const mockContext: Context = {
      projectName: "test",
      profiles: [],
      processes: [],
      containers: [],
      tasks: [{ name: "build", cmds: ["pnpm build"] }],
      environments: [],
      links: [],
      instanceKey: "default",
      state: {},
      projectRoot: "/test",
    };

    vi.spyOn(zapper, "getContext").mockReturnValue(mockContext);

    const command = new TaskCommand();
    await expect(
      command.execute({
        zapper,
        service: "missing",
        options: { listParams: true },
      }),
    ).rejects.toThrow(TaskNotFoundError);
  });
});
