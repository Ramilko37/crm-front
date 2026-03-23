type JsonObject = Record<string, unknown>;

function asObject(payload: unknown): JsonObject {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as JsonObject;
  }
  return {};
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function pickNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function compactObject<T extends JsonObject>(value: T): T {
  const next: JsonObject = {};
  Object.entries(value).forEach(([key, item]) => {
    if (item === undefined || item === null || item === "") {
      return;
    }
    next[key] = item;
  });
  return next as T;
}

export function buildInternalOrderMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  const order = compactObject({
    order_number: pickString(body.order_number),
    company_id: pickNumber(body.company_id),
    ready_date: pickString(body.ready_date),
    order_type: pickString(body.order_type),
    contact_user_id: pickNumber(body.contact_user_id) ?? pickNumber(body.user_id),
    comment: pickString(body.comment),
    additional_description: pickString(body.additional_description) ?? pickString(body.comment),
    invoice_number: pickString(body.invoice_number),
  });

  const factorySelection = compactObject({
    factory_id: pickNumber(body.factory_id),
    loading_address_id: pickNumber(body.loading_address_id),
  });

  return {
    order,
    factory_selection: factorySelection,
    goods_lines: [],
    documents: [],
  };
}

export function buildClientOrderMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  const order = compactObject({
    order_number: pickString(body.order_number),
    ready_date: pickString(body.ready_date),
    comment: pickString(body.comment),
    additional_description: pickString(body.additional_description) ?? pickString(body.comment),
    invoice_number: pickString(body.invoice_number),
    invoice_on_other_company: Boolean(body.invoice_on_other_company),
    invoice_company_name: pickString(body.invoice_company_name),
  });

  const factorySelection = compactObject({
    factory_id: pickNumber(body.factory_id),
    loading_address_id: pickNumber(body.loading_address_id),
  });

  return {
    order,
    factory_selection: factorySelection,
    goods_lines: [],
    documents: [],
  };
}

export function buildRequestMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  return {
    request: compactObject({
      company_id: pickNumber(body.company_id),
      contact_user_id: pickNumber(body.contact_user_id),
      contact_name_snapshot: pickString(body.contact_name_snapshot),
      comment: pickString(body.comment),
      payload_json:
        body.payload_json && typeof body.payload_json === "object" && !Array.isArray(body.payload_json)
          ? (body.payload_json as JsonObject)
          : undefined,
    }),
    documents: [],
  };
}
