import { describe, expect, it } from "vitest";

import { useOrderCreateDraftStore } from "@/shared/stores/order-create-draft-store";

describe("order create draft", () => {
  it("defaults measurement and weighing to not required", () => {
    useOrderCreateDraftStore.getState().resetDraft();

    expect(useOrderCreateDraftStore.getState().draft).toMatchObject({
      measurement_status: "not_required",
      weighing_status: "not_required",
    });
  });
});
