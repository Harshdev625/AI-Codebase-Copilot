/** Frontend unit tests for change-set types and plan review helpers */

import type { ChangeSetStatus, PlanJson } from "@/features/change-sets/types/change-set-types";

describe("change-set types", () => {
  it("accepts plan json shape", () => {
    const plan: PlanJson = {
      summary: "Refactor auth",
      steps: [{ id: "1", title: "Update login", files: ["src/auth.ts"], description: "Fix tokens" }],
      risks: ["Regression"],
      testing_strategy: ["Unit tests"],
    };
    expect(plan.steps).toHaveLength(1);
  });

  it("includes workflow statuses", () => {
    const statuses: ChangeSetStatus[] = ["PLAN_READY", "PLAN_APPROVED", "PATCH_APPROVED", "APPLIED"];
    expect(statuses).toContain("PLAN_APPROVED");
  });
});
