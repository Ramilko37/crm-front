import { describe, expect, it } from "vitest";

import { getOrderActivityText, normalizeSpecialTariffText } from "@/shared/lib/order-activity";
import type { OrderStatusHistoryItem } from "@/shared/types/entities";

describe("order activity helpers", () => {
  it("normalizes blank special tariff input to null", () => {
    expect(normalizeSpecialTariffText(" Special terms ")).toBe("Special terms");
    expect(normalizeSpecialTariffText("   ")).toBeNull();
    expect(normalizeSpecialTariffText(null)).toBeNull();
  });

  it("uses archive comment as the primary activity text", () => {
    const item: OrderStatusHistoryItem = {
      id: 1,
      order_id: 10,
      status_name: "new_request",
      status_date: "2026-04-10",
      comment: "Pickup window set: from 2026-04-10 to 2026-04-12",
      changed_by_user_id: 7,
      created_at: "2026-04-10T10:00:00Z",
    };

    expect(getOrderActivityText(item)).toBe("Pickup window set: from 2026-04-10 to 2026-04-12");
  });

  it("falls back to status text for legacy archive rows without comment", () => {
    const item: OrderStatusHistoryItem = {
      id: 2,
      order_id: 10,
      status_name: "factory_confirmed",
      status_date: "2026-04-12",
      comment: null,
      changed_by_user_id: null,
      created_at: "2026-04-12T10:00:00Z",
    };

    expect(getOrderActivityText(item)).toBe("Status: factory_confirmed");
  });
});
