export type OrderSavedFilterParams = Record<string, string[]>;

export type SavedOrderFilter = {
  id: string;
  name: string;
  params: OrderSavedFilterParams;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

const ORDER_SAVED_FILTER_KEYS = [
  "id",
  "query",
  "quick_tab",
  "status_names",
  "order_types",
  "quote_statuses",
  "priority_codes",
  "office_mark_codes",
  "document_type",
  "country",
  "user_id",
  "company_id",
  "personal_manager_id",
  "assigned_forwarder_user_id",
  "factory_id",
  "trip_id",
  "has_mrn",
  "has_certificate",
  "has_documents",
  "is_checked",
  "order_date_from",
  "order_date_to",
] as const;

const ORDER_SAVED_FILTER_KEY_SET = new Set<string>(ORDER_SAVED_FILTER_KEYS);

function normalizeParams(params: OrderSavedFilterParams): OrderSavedFilterParams {
  return Object.fromEntries(
    Object.entries(params)
      .map(([key, values]) => [key, values.filter(Boolean)] as const)
      .filter(([, values]) => values.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function extractOrderSavedFilterParams(searchParams: URLSearchParams): OrderSavedFilterParams {
  const result: OrderSavedFilterParams = {};

  searchParams.forEach((value, key) => {
    if (!ORDER_SAVED_FILTER_KEY_SET.has(key) || !value) return;
    result[key] = [...(result[key] ?? []), value];
  });

  return normalizeParams(result);
}

export function hasOrderSavedFilterParams(params: OrderSavedFilterParams) {
  return Object.values(params).some((values) => values.length > 0);
}

export function buildOrderSavedFilterSearchParams(params: OrderSavedFilterParams) {
  const searchParams = new URLSearchParams();

  Object.entries(normalizeParams(params)).forEach(([key, values]) => {
    values.forEach((value) => {
      searchParams.append(key, value);
    });
  });

  return searchParams;
}

export function upsertSavedOrderFilter(
  filters: SavedOrderFilter[],
  input: {
    id: string;
    name: string;
    params: OrderSavedFilterParams;
    now: string;
  },
): SavedOrderFilter[] {
  const existing = filters.find((filter) => filter.id === input.id);
  const nextFilter: SavedOrderFilter = {
    id: input.id,
    name: input.name.trim(),
    params: normalizeParams(input.params),
    isDefault: existing?.isDefault ?? false,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
  };

  return existing
    ? filters.map((filter) => (filter.id === input.id ? nextFilter : filter))
    : [...filters, nextFilter];
}

export function renameSavedOrderFilter(filters: SavedOrderFilter[], id: string, name: string, now: string) {
  const nextName = name.trim();
  if (!nextName) return filters;

  return filters.map((filter) =>
    filter.id === id
      ? {
          ...filter,
          name: nextName,
          updatedAt: now,
        }
      : filter,
  );
}

export function markDefaultSavedOrderFilter(filters: SavedOrderFilter[], id: string, now: string) {
  return filters.map((filter) => ({
    ...filter,
    isDefault: filter.id === id,
    updatedAt: filter.id === id ? now : filter.updatedAt,
  }));
}

export function clearDefaultSavedOrderFilter(filters: SavedOrderFilter[]) {
  return filters.map((filter) => ({ ...filter, isDefault: false }));
}

export function deleteSavedOrderFilter(filters: SavedOrderFilter[], id: string) {
  return filters.filter((filter) => filter.id !== id);
}

export function parseSavedOrderFilters(value: string | null | undefined): SavedOrderFilter[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is SavedOrderFilter => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return false;
        const candidate = item as Partial<SavedOrderFilter>;
        return (
          typeof candidate.id === "string" &&
          typeof candidate.name === "string" &&
          typeof candidate.params === "object" &&
          candidate.params !== null &&
          typeof candidate.createdAt === "string" &&
          typeof candidate.updatedAt === "string"
        );
      })
      .map((filter) => ({
        ...filter,
        isDefault: Boolean(filter.isDefault),
        params: normalizeParams(filter.params),
      }));
  } catch {
    return [];
  }
}
