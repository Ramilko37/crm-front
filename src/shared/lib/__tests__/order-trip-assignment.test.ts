import { describe, expect, it } from "vitest";

import {
  buildAssignTripConfirmPayload,
  buildAssignTripForcePayload,
  getAssignTripEligibilityErrorMessage,
  isForceAssignableTripPreviewError,
} from "@/shared/lib/order-trip-assignment";

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

  it("builds force payload with a trimmed reason and no confirmation token", () => {
    expect(buildAssignTripForcePayload({ tripId: 15, reason: " urgent loading " })).toEqual({
      trip_id: 15,
      force: true,
      force_reason: "urgent loading",
    });
    expect(() => buildAssignTripForcePayload({ tripId: 15, reason: "   " })).toThrow("force_reason is required");
  });

  it.each([
    ["Order location is not on the trip route", "Местоположение заказа не входит в маршрут"],
    ["Trip has already left Factory ACME", "Рейс уже покинул Factory ACME"],
    ["force_reason is required to force-assign trip", "Укажите причину обхода проверки"],
    ["force is only allowed when assigning a trip", "Обход нельзя использовать при снятии с рейса"],
    ["Trip with id=15 does not exist", "Рейс не найден"],
    ["Insufficient permissions", "Недостаточно прав для обхода / правки истории"],
  ])("maps backend assignment refusal %s", (detail, expected) => {
    expect(getAssignTripEligibilityErrorMessage(detail)).toBe(expected);
  });

  it("offers force only for eligibility errors that force can bypass", () => {
    expect(isForceAssignableTripPreviewError("Order location is not on the trip route")).toBe(true);
    expect(isForceAssignableTripPreviewError("Trip has already left Factory ACME")).toBe(true);
    expect(isForceAssignableTripPreviewError("Trip Milan is already finished")).toBe(true);
    expect(isForceAssignableTripPreviewError("Order status does not allow loading")).toBe(true);
    expect(isForceAssignableTripPreviewError("Order is already assigned to active trip 7")).toBe(true);
    expect(isForceAssignableTripPreviewError("Trip with id=15 does not exist")).toBe(false);
  });
});
