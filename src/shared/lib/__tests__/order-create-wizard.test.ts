import { describe, expect, it } from "vitest";

import { clampOrderCreateWizardStep, getOrderCreateWizardSteps } from "@/shared/lib/order-create-wizard";

describe("order create wizard", () => {
  it("uses documents as the next and final step for request orders", () => {
    expect(getOrderCreateWizardSteps("request").map((step) => step.key)).toEqual(["base", "documents"]);
    expect(clampOrderCreateWizardStep(4, "request")).toBe(1);
  });

  it("keeps the full create flow for non-request orders", () => {
    expect(getOrderCreateWizardSteps("delivery").map((step) => step.key)).toEqual([
      "base",
      "factory",
      "order_data",
      "goods",
      "documents",
    ]);
    expect(clampOrderCreateWizardStep(4, "delivery")).toBe(4);
  });
});
