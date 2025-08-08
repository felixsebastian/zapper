import { describe, it, expect } from "vitest";
import { SequentialStrategy } from "./sequential-strategy";
import { Process } from "../../types";

describe("SequentialStrategy", () => {
  it("should create a plan with processes in order", () => {
    const strategy = new SequentialStrategy();
    const processes: Process[] = [
      { name: "first", cmd: "echo first" },
      { name: "second", cmd: "echo second" },
      { name: "third", cmd: "echo third" },
    ];

    const plan = strategy.createPlan(processes);

    expect(plan.totalSteps).toBe(3);
    expect(plan.steps).toHaveLength(3);
    expect(plan.steps[0].order).toBe(1);
    expect(plan.steps[0].process.name).toBe("first");
    expect(plan.steps[1].order).toBe(2);
    expect(plan.steps[1].process.name).toBe("second");
    expect(plan.steps[2].order).toBe(3);
    expect(plan.steps[2].process.name).toBe("third");
  });

  it("should validate any plan with steps", () => {
    const strategy = new SequentialStrategy();
    const processes: Process[] = [{ name: "test", cmd: "echo test" }];

    const plan = strategy.createPlan(processes);
    expect(strategy.validatePlan(plan)).toBe(true);
  });

  it("should handle empty processes list", () => {
    const strategy = new SequentialStrategy();
    const plan = strategy.createPlan([]);

    expect(plan.totalSteps).toBe(0);
    expect(plan.steps).toHaveLength(0);
    expect(strategy.validatePlan(plan)).toBe(false);
  });
});
