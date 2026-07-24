import type { NamePath } from "antd/es/form/interface";

import type { OrderType } from "@/shared/lib/domain-enums";
import type { ApiValidationIssue } from "@/shared/lib/errors";

export type OrderDecimalFailureReason = "required" | "invalid_number" | "must_be_positive";

export type OrderDecimalResult =
  | { ok: true; value: string }
  | { ok: false; reason: OrderDecimalFailureReason };

export type OrderCurrencyResult =
  | { ok: true; currency: "USD" | "EUR" | "OTHER" | undefined; otherLabel?: string }
  | { ok: false; reason: "invalid_currency" | "other_label_required" | "other_label_forbidden" };

export type OrderFormValidationValues = {
  order_type?: OrderType;
  invoice_number?: string;
  client_goods_value_amount?: string;
  client_goods_value_currency?: string;
  client_goods_value_currency_other_label?: string;
  declared_volume_m3?: string;
  declared_total_weight_kg?: string;
};

export type OrderFormFieldError = {
  name: NamePath;
  message: string;
};

export type OrderFormValidationResult =
  | {
      ok: true;
      values: {
        invoice_number?: string;
        client_goods_value_amount?: string;
        client_goods_value_currency?: "USD" | "EUR" | "OTHER";
        client_goods_value_currency_other_label?: string;
        declared_volume_m3?: string;
        declared_total_weight_kg?: string;
      };
    }
  | { ok: false; fieldErrors: OrderFormFieldError[] };

const COMMERCIAL_ORDER_TYPES = new Set<OrderType>(["delivery", "delivery_europe", "quote_request"]);
const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "OTHER"]);

const DECIMAL_MESSAGES: Record<keyof Pick<
  Required<OrderFormValidationValues>,
  "client_goods_value_amount" | "declared_volume_m3" | "declared_total_weight_kg"
>, Record<OrderDecimalFailureReason, string>> = {
  client_goods_value_amount: {
    required: "Укажите сумму инвойса",
    invalid_number: "Сумма инвойса должна быть числом",
    must_be_positive: "Сумма инвойса должна быть больше 0",
  },
  declared_volume_m3: {
    required: "Укажите заявленный объем",
    invalid_number: "Заявленный объем должен быть числом",
    must_be_positive: "Заявленный объем должен быть больше 0",
  },
  declared_total_weight_kg: {
    required: "Укажите заявленный вес",
    invalid_number: "Заявленный вес должен быть числом",
    must_be_positive: "Заявленный вес должен быть больше 0",
  },
};

function trimOrUndefined(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isCommercialOrderType(orderType: OrderType | undefined) {
  return COMMERCIAL_ORDER_TYPES.has(orderType ?? "delivery");
}

export function validateOrderDecimal(
  value: string | number | null | undefined,
  options: { required: boolean },
): OrderDecimalResult {
  const raw = typeof value === "number" ? String(value) : value?.trim();
  if (!raw) {
    return options.required ? { ok: false, reason: "required" } : { ok: true, value: undefined as never };
  }

  const normalized = raw.replace(",", ".");
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    return { ok: false, reason: "invalid_number" };
  }

  if (Number(normalized) <= 0) {
    return { ok: false, reason: "must_be_positive" };
  }

  return { ok: true, value: normalized };
}

export function normalizeOrderCurrency(
  currency: string | null | undefined,
  otherLabel: string | null | undefined,
  options: { required: boolean },
): OrderCurrencyResult {
  const rawCurrency = trimOrUndefined(currency);
  if (!rawCurrency && !options.required) {
    return { ok: true, currency: undefined };
  }

  const normalizedCurrency = (rawCurrency ?? "EUR").toUpperCase();
  if (!ALLOWED_CURRENCIES.has(normalizedCurrency)) {
    return { ok: false, reason: "invalid_currency" };
  }

  const normalizedOtherLabel = trimOrUndefined(otherLabel);
  if (normalizedCurrency === "OTHER" && !normalizedOtherLabel) {
    return { ok: false, reason: "other_label_required" };
  }
  if (normalizedCurrency !== "OTHER" && normalizedOtherLabel) {
    return { ok: false, reason: "other_label_forbidden" };
  }

  return {
    ok: true,
    currency: normalizedCurrency as "USD" | "EUR" | "OTHER",
    otherLabel: normalizedCurrency === "OTHER" ? normalizedOtherLabel : undefined,
  };
}

export function validateOrderFormValues(values: OrderFormValidationValues): OrderFormValidationResult {
  const commercial = isCommercialOrderType(values.order_type);
  const fieldErrors: OrderFormFieldError[] = [];
  const normalized: Extract<OrderFormValidationResult, { ok: true }>["values"] = {};
  const invoiceNumber = trimOrUndefined(values.invoice_number);

  if (commercial) {
    if (!invoiceNumber) {
      fieldErrors.push({ name: ["invoice_number"], message: "Укажите номер инвойса" });
    } else {
      normalized.invoice_number = invoiceNumber;
    }
  } else if (invoiceNumber) {
    normalized.invoice_number = invoiceNumber;
  }

  const currencyResult = normalizeOrderCurrency(
    values.client_goods_value_currency,
    values.client_goods_value_currency_other_label,
    { required: commercial },
  );
  if (!currencyResult.ok) {
    fieldErrors.push({
      name:
        currencyResult.reason === "other_label_required" || currencyResult.reason === "other_label_forbidden"
          ? ["client_goods_value_currency_other_label"]
          : ["client_goods_value_currency"],
      message:
        currencyResult.reason === "invalid_currency"
          ? "Валюта должна быть USD, EUR или OTHER"
          : currencyResult.reason === "other_label_required"
            ? "Для валюты OTHER укажите текстовое обозначение валюты"
            : "Текстовое обозначение валюты допустимо только для OTHER",
    });
  } else {
    normalized.client_goods_value_currency = currencyResult.currency;
    normalized.client_goods_value_currency_other_label = currencyResult.otherLabel;
  }

  (["client_goods_value_amount", "declared_volume_m3", "declared_total_weight_kg"] as const).forEach((fieldName) => {
    const result = validateOrderDecimal(values[fieldName], { required: commercial });
    if (!result.ok) {
      fieldErrors.push({ name: [fieldName], message: DECIMAL_MESSAGES[fieldName][result.reason] });
      return;
    }
    if (result.value !== undefined) {
      normalized[fieldName] = result.value;
    }
  });

  if (fieldErrors.length) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, values: normalized };
}

export function resolvePostcodeCitySelection(
  currentCityId: number | undefined,
  cities: Array<{ id: number; city?: string | null }>,
):
  | { value: number | undefined; reason: "none" | "single" | "multiple" | "kept" | "stale" } {
  if (cities.length === 0) {
    return { value: undefined, reason: "none" };
  }
  if (currentCityId && cities.some((city) => city.id === currentCityId)) {
    return { value: currentCityId, reason: "kept" };
  }
  if (cities.length === 1) {
    return { value: cities[0]?.id, reason: "single" };
  }
  return { value: undefined, reason: currentCityId ? "stale" : "multiple" };
}

export function mapOrderValidationIssueToNamePath(issue: ApiValidationIssue): NamePath | null {
  const loc = issue.loc.map(String);
  const key = loc.at(-1);
  const joined = loc.join(".");

  if (key === "invoice_number") return ["invoice_number"];
  if (key === "client_goods_value_amount") return ["client_goods_value_amount"];
  if (key === "client_goods_value_currency") return ["client_goods_value_currency"];
  if (key === "client_goods_value_currency_other_label") return ["client_goods_value_currency_other_label"];
  if (key === "declared_volume_m3") return ["declared_volume_m3"];
  if (key === "declared_total_weight_kg") return ["declared_total_weight_kg"];
  if (joined.includes("loading_address") && key === "postcode_id") return ["loading_postcode_id_ui"];
  if (joined.includes("loading_address") && key === "city_id") return ["loading_city_id_ui"];
  if (key === "company_contact_id") return ["company_contact_id"];
  if (key === "factory_contact_id" || key === "email_id") return ["factory_contact_id"];
  if (key === "loading_address_id") return ["loading_address_id"];

  return null;
}
