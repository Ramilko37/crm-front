import { describe, expect, it } from "vitest";

import { buildAssignTripConfirmPayload } from "@/shared/lib/order-trip-assignment";

describe("order trip assignment payloads", () => {
  it("includes the confirmation token when assigning a trip", () => {
    expect(buildAssignTripConfirmPayload({ tripId: 15, confirmationToken: "token-123" })).toEqual({
      trip_id: 15,
      confirmation_token: "token-123",
    });
  });

  it("does not include a confirmation token when unassigning a trip", () => {
    expect(buildAssignTripConfirmPayload({ tripId: null, confirmationToken: "token-123" })).toEqual({
      trip_id: null,
    });
  });

  it("rejects assigning a trip without a confirmation token", () => {
    expect(() => buildAssignTripConfirmPayload({ tripId: 15 })).toThrow("confirmation_token is required");
  });
});
