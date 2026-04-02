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

function pickBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function pickStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const values = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => Boolean(item));
  return values.length ? values : undefined;
}

function pickObject(value: unknown): JsonObject | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return undefined;
}

function pickArray(value: unknown): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
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

function isStructuredOrderCreatePayload(body: JsonObject): boolean {
  return (
    ("order" in body && typeof body.order === "object" && body.order !== null) ||
    ("factory_selection" in body && typeof body.factory_selection === "object" && body.factory_selection !== null) ||
    Array.isArray(body.goods_lines) ||
    Array.isArray(body.documents)
  );
}

export function buildInternalOrderMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  if (isStructuredOrderCreatePayload(body)) {
    return {
      order: pickObject(body.order) ?? {},
      factory_selection: pickObject(body.factory_selection) ?? {},
      goods_lines: pickArray(body.goods_lines) ?? [],
      documents: pickArray(body.documents) ?? [],
    };
  }

  const order = compactObject({
    order_number: pickString(body.order_number),
    company_id: pickNumber(body.company_id),
    ready_date: pickString(body.ready_date),
    order_type: pickString(body.order_type),
    company_contact_id: pickNumber(body.company_contact_id) ?? pickNumber(body.contact_user_id) ?? pickNumber(body.user_id),
    invoice_on_other_company: pickBoolean(body.invoice_on_other_company),
    invoice_company_name: pickString(body.invoice_company_name),
    comment: pickString(body.comment),
    additional_description: pickString(body.additional_description),
    invoice_number: pickString(body.invoice_number),
    declared_volume_m3: pickString(body.declared_volume_m3),
    declared_total_weight_kg: pickString(body.declared_total_weight_kg),
    cargo_places_qty: pickNumber(body.cargo_places_qty),
    client_goods_value_amount: pickString(body.client_goods_value_amount),
    client_goods_value_currency: pickString(body.client_goods_value_currency),
    user_comment: pickString(body.user_comment),
    forwarder_comment: pickString(body.forwarder_comment),
    warehouse_comment: pickString(body.warehouse_comment),
    assigned_forwarder_user_id: pickNumber(body.assigned_forwarder_user_id),
    factory_payment_via_label: pickString(body.factory_payment_via_label),
    is_factory_payment_completed: pickBoolean(body.is_factory_payment_completed),
    is_checked: pickBoolean(body.is_checked),
    priority_codes: pickStringArray(body.priority_codes),
    office_mark_codes: pickStringArray(body.office_mark_codes),
    product_characteristic_codes: pickStringArray(body.product_characteristic_codes),
    self_delivery: pickBoolean(body.self_delivery),
    self_delivery_forwarder_user_id: pickNumber(body.self_delivery_forwarder_user_id),
    office_marks: pickObject(body.office_marks),
    product_characteristics: pickObject(body.product_characteristics),
    measurement_payload: pickObject(body.measurement_payload),
    weighing_payload: pickObject(body.weighing_payload),
  });

  const createFactory = pickObject(body.create_factory);
  const factorySelection = compactObject({
    factory_id: pickNumber(body.factory_id),
    loading_address_id: pickNumber(body.loading_address_id),
    email_id: pickNumber(body.email_id),
    create_factory: createFactory,
  });

  const goodsLines = pickArray(body.goods_lines) ?? [];
  const documents = pickArray(body.documents) ?? [];

  if (!order.additional_description && order.comment && goodsLines.length === 0) {
    order.additional_description = order.comment;
  }

  return {
    order,
    factory_selection: factorySelection,
    goods_lines: goodsLines,
    documents,
  };
}

function isStructuredClientOrderCreatePayload(body: JsonObject): boolean {
  return (
    ("order" in body && typeof body.order === "object" && body.order !== null) ||
    ("factory_selection" in body && typeof body.factory_selection === "object" && body.factory_selection !== null) ||
    Array.isArray(body.goods_lines) ||
    Array.isArray(body.documents)
  );
}

export function buildClientOrderMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  if (isStructuredClientOrderCreatePayload(body)) {
    return {
      order: pickObject(body.order) ?? {},
      factory_selection: pickObject(body.factory_selection) ?? {},
      goods_lines: pickArray(body.goods_lines) ?? [],
      documents: pickArray(body.documents) ?? [],
    };
  }

  const order = compactObject({
    order_number: pickString(body.order_number),
    ready_date: pickString(body.ready_date),
    comment: pickString(body.comment),
    additional_description: pickString(body.additional_description),
    invoice_number: pickString(body.invoice_number),
    invoice_on_other_company: pickBoolean(body.invoice_on_other_company),
    invoice_company_name: pickString(body.invoice_company_name),
    declared_volume_m3: pickString(body.declared_volume_m3),
    declared_total_weight_kg: pickString(body.declared_total_weight_kg),
    cargo_places_qty: pickNumber(body.cargo_places_qty),
    client_goods_value_amount: pickString(body.client_goods_value_amount),
    client_goods_value_currency: pickString(body.client_goods_value_currency),
  });

  const createFactory = pickObject(body.create_factory);
  const factorySelection = compactObject({
    factory_id: pickNumber(body.factory_id),
    loading_address_id: pickNumber(body.loading_address_id),
    create_factory: createFactory,
  });

  const goodsLines = pickArray(body.goods_lines) ?? [];
  const documents = pickArray(body.documents) ?? [];

  if (!order.additional_description && order.comment && goodsLines.length === 0) {
    order.additional_description = order.comment;
  }

  return {
    order,
    factory_selection: factorySelection,
    goods_lines: goodsLines,
    documents,
  };
}

export function buildRequestMultipartPayload(payload: unknown) {
  const body = asObject(payload);

  return {
    request: compactObject({
      company_id: pickNumber(body.company_id),
      company_contact_id: pickNumber(body.company_contact_id) ?? pickNumber(body.contact_user_id),
      comment: pickString(body.comment),
      payload_json:
        body.payload_json && typeof body.payload_json === "object" && !Array.isArray(body.payload_json)
          ? (body.payload_json as JsonObject)
          : undefined,
    }),
    documents: [],
  };
}
