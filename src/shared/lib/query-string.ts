export type QueryPrimitive = string | number | boolean;
export type QueryValue = QueryPrimitive | QueryPrimitive[] | null | undefined;

export function buildQueryString(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === "" || item === null || item === undefined) {
          return;
        }
        search.append(key, String(item));
      });
      return;
    }

    search.set(key, String(value));
  });

  return search.toString();
}

export function parseCsv(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function setSearchPatch(
  current: URLSearchParams,
  patch: Record<string, string | number | boolean | string[] | null | undefined>,
): string {
  const next = new URLSearchParams(current.toString());

  Object.entries(patch).forEach(([key, value]) => {
    next.delete(key);

    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        next.set(key, value.join(","));
      }
      return;
    }

    next.set(key, String(value));
  });

  return next.toString();
}
