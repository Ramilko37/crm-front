import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { getOrderPeriodPresetRange } from "@/shared/lib/order-period-presets";

describe("order-period-presets", () => {
  const today = dayjs("2026-07-25");

  it.each([
    ["today", "2026-07-25", "2026-07-25"],
    ["yesterday", "2026-07-24", "2026-07-24"],
    ["last_7_days", "2026-07-19", "2026-07-25"],
    ["last_30_days", "2026-06-26", "2026-07-25"],
    ["current_month", "2026-07-01", "2026-07-25"],
    ["previous_month", "2026-06-01", "2026-06-30"],
  ] as const)("returns %s date range", (preset, expectedFrom, expectedTo) => {
    expect(getOrderPeriodPresetRange(preset, today)).toEqual({
      order_date_from: expectedFrom,
      order_date_to: expectedTo,
    });
  });
});
