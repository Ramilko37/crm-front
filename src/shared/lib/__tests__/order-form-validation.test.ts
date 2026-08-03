import type { NamePath } from "antd/es/form/interface";

import {
  factoryMatchesSelectedCountry,
  mergeDefinedOrderFormValues,
  normalizeOrderCurrency,
  resolvePostcodeCitySelection,
  shouldClearOrderCurrencyOtherLabel,
  validateOrderDecimal,
  validateOrderFormValues,
  mapOrderValidationIssueToNamePath,
  isCommercialOrderType,
  getExistingLoadingAddressFieldErrors,
} from "@/shared/lib/order-form-validation";
import type { ApiValidationIssue } from "@/shared/lib/errors";
import type { Country } from "@/shared/types/entities";

describe("order form validation", () => {
  it("requires commercial fields for delivery-like order types only", () => {
    expect(isCommercialOrderType("delivery")).toBe(true);
    expect(isCommercialOrderType("delivery_europe")).toBe(true);
    expect(isCommercialOrderType("quote_request")).toBe(true);
    expect(isCommercialOrderType("request")).toBe(false);
  });

  it("normalizes dot and comma decimals and rejects empty, text, zero and negative values", () => {
    expect(validateOrderDecimal("12.5", { required: true })).toEqual({ ok: true, value: "12.5" });
    expect(validateOrderDecimal("12,5", { required: true })).toEqual({ ok: true, value: "12.5" });
    expect(validateOrderDecimal("", { required: true })).toEqual({ ok: false, reason: "required" });
    expect(validateOrderDecimal("abc", { required: true })).toEqual({ ok: false, reason: "invalid_number" });
    expect(validateOrderDecimal("0", { required: true })).toEqual({ ok: false, reason: "must_be_positive" });
    expect(validateOrderDecimal("-1", { required: true })).toEqual({ ok: false, reason: "must_be_positive" });
  });

  it("allows only USD, EUR and OTHER and requires OTHER label", () => {
    expect(normalizeOrderCurrency(undefined, undefined, { required: true })).toEqual({ ok: true, currency: "EUR" });
    expect(normalizeOrderCurrency("usd", undefined, { required: true })).toEqual({ ok: true, currency: "USD" });
    expect(normalizeOrderCurrency("RUB", undefined, { required: true })).toEqual({ ok: false, reason: "invalid_currency" });
    expect(normalizeOrderCurrency("OTHER", "", { required: true })).toEqual({ ok: false, reason: "other_label_required" });
    expect(normalizeOrderCurrency("OTHER", "CHF", { required: true })).toEqual({
      ok: true,
      currency: "OTHER",
      otherLabel: "CHF",
    });
  });

  it("does not clear OTHER label when currency watcher is temporarily unregistered", () => {
    expect(shouldClearOrderCurrencyOtherLabel(undefined)).toBe(false);
    expect(shouldClearOrderCurrencyOtherLabel("OTHER")).toBe(false);
    expect(shouldClearOrderCurrencyOtherLabel("EUR")).toBe(true);
  });

  it("does not let submit values from an unmounted wizard step erase preserved OTHER currency", () => {
    expect(
      mergeDefinedOrderFormValues(
        { client_goods_value_currency: "OTHER", client_goods_value_currency_other_label: "CHF" },
        { client_goods_value_currency: "OTHER", client_goods_value_currency_other_label: "CHF" },
        { client_goods_value_currency: undefined, client_goods_value_currency_other_label: undefined },
      ),
    ).toEqual({ client_goods_value_currency: "OTHER", client_goods_value_currency_other_label: "CHF" });

    expect(
      mergeDefinedOrderFormValues(
        { client_goods_value_currency: "OTHER", client_goods_value_currency_other_label: "CHF" },
        { client_goods_value_currency: "EUR", client_goods_value_currency_other_label: undefined },
        { client_goods_value_currency: undefined, client_goods_value_currency_other_label: undefined },
      ),
    ).toEqual({ client_goods_value_currency: "EUR", client_goods_value_currency_other_label: undefined });
  });

  it("filters factory options by the selected country even when the backend returns broader results", () => {
    const countries: Country[] = [
      { id: 1, name_en: "Åland Islands", name_ru: "Аландские острова", iso2: "AX", iso3: "ALA" },
      { id: 2, name_en: "Austria", name_ru: "Австрия", iso2: "AT", iso3: "AUT" },
    ];

    expect(factoryMatchesSelectedCountry({ country_id: 1, country: "Austria" }, 1, countries)).toBe(true);
    expect(factoryMatchesSelectedCountry({ country_id: null, country: "Åland Islands" }, 1, countries)).toBe(true);
    expect(factoryMatchesSelectedCountry({ country_id: null, country: "Austria" }, 1, countries)).toBe(false);
    expect(factoryMatchesSelectedCountry({ country_id: 2, country: "Austria" }, 1, countries)).toBe(false);
  });

  it("keeps request metrics optional but rejects provided non-positive values", () => {
    expect(
      validateOrderFormValues({
        order_type: "request",
        client_goods_value_currency: undefined,
        client_goods_value_amount: "",
        declared_volume_m3: undefined,
        declared_total_weight_kg: undefined,
      }),
    ).toEqual({ ok: true, values: { client_goods_value_currency: undefined } });

    expect(
      validateOrderFormValues({
        order_type: "request",
        declared_volume_m3: "0",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: [{ name: ["declared_volume_m3"], message: "Заявленный объем должен быть больше 0" }],
    });
  });

  it("requires invoice and metrics for commercial orders and normalizes payload values", () => {
    expect(
      validateOrderFormValues({
        order_type: "delivery_europe",
        invoice_number: " INV-1 ",
        client_goods_value_amount: "10,5",
        client_goods_value_currency: "EUR",
        declared_volume_m3: "2,25",
        declared_total_weight_kg: "14.3",
      }),
    ).toEqual({
      ok: true,
      values: {
        invoice_number: "INV-1",
        client_goods_value_amount: "10.5",
        client_goods_value_currency: "EUR",
        client_goods_value_currency_other_label: undefined,
        declared_volume_m3: "2.25",
        declared_total_weight_kg: "14.3",
      },
    });

    expect(
      validateOrderFormValues({
        order_type: "quote_request",
        invoice_number: "",
      }),
    ).toEqual({
      ok: false,
      fieldErrors: [
        { name: ["invoice_number"], message: "Укажите номер инвойса" },
        { name: ["client_goods_value_amount"], message: "Укажите сумму инвойса" },
        { name: ["declared_volume_m3"], message: "Укажите заявленный объем" },
        { name: ["declared_total_weight_kg"], message: "Укажите заявленный вес" },
      ],
    });
  });

  it("selects one city automatically, keeps valid manual city and clears stale selection", () => {
    expect(resolvePostcodeCitySelection(undefined, [])).toEqual({ value: undefined, reason: "none" });
    expect(resolvePostcodeCitySelection(undefined, [{ id: 7, city: "Milan" }])).toEqual({
      value: 7,
      reason: "single",
    });
    expect(
      resolvePostcodeCitySelection(8, [
        { id: 7, city: "Milan" },
        { id: 8, city: "Roma" },
      ]),
    ).toEqual({ value: 8, reason: "kept" });
    expect(
      resolvePostcodeCitySelection(9, [
        { id: 7, city: "Milan" },
        { id: 8, city: "Roma" },
      ]),
    ).toEqual({ value: undefined, reason: "stale" });
  });

  it("accepts an existing loading address when it has postcode and city", () => {
    expect(
      getExistingLoadingAddressFieldErrors({
        postcode_id: 12,
        city_id: 34,
      }),
    ).toEqual([]);
  });

  it("maps backend validation locations to order form name paths", () => {
    const cases: Array<[ApiValidationIssue, NamePath | null]> = [
      [{ loc: ["body", "order", "invoice_number"], msg: "required" }, ["invoice_number"]],
      [{ loc: ["order", "client_goods_value_amount"], msg: "required" }, ["client_goods_value_amount"]],
      [{ loc: ["order", "client_goods_value_currency"], msg: "required" }, ["client_goods_value_currency"]],
      [{ loc: ["order", "declared_volume_m3"], msg: "required" }, ["declared_volume_m3"]],
      [{ loc: ["order", "declared_total_weight_kg"], msg: "required" }, ["declared_total_weight_kg"]],
      [
        { loc: ["factory_selection", "create_factory", "loading_address", "postcode_id"], msg: "required" },
        ["loading_postcode_id_ui"],
      ],
      [
        { loc: ["factory_selection", "create_factory", "loading_address", "city_id"], msg: "required" },
        ["loading_city_id_ui"],
      ],
      [{ loc: ["order", "unknown"], msg: "unknown" }, null],
    ];

    for (const [issue, expected] of cases) {
      expect(mapOrderValidationIssueToNamePath(issue)).toEqual(expected);
    }
  });
});
