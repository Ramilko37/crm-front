import { calculateCoefficient, renderGoodsLineSummary } from "@/features/orders/create-order-wizard-utils";

describe("create-order-wizard-utils", () => {
  it("calculates coefficient with decimal normalization", () => {
    expect(calculateCoefficient("100", "5")).toBe("20");
    expect(calculateCoefficient("10,5", "2")).toBe("5.25");
  });

  it("returns empty coefficient for invalid values", () => {
    expect(calculateCoefficient("0", "10")).toBe("");
    expect(calculateCoefficient("10", "0")).toBe("");
    expect(calculateCoefficient("abc", "2")).toBe("");
    expect(calculateCoefficient("10", "")).toBe("");
  });

  it("renders compact goods line summary", () => {
    expect(
      renderGoodsLineSummary({
        item_type: "chair",
        weight_kg: "2",
        quantity_value: "4",
        quantity_unit: "pcs",
      }),
    ).toBe("chair · 2 кг · 4 pcs");

    expect(
      renderGoodsLineSummary({
        item_type: "other",
        custom_item_type: "stool",
      }),
    ).toBe("stool · вес ? · ? ед.");
  });
});
