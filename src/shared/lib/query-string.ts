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

function normalizeArrayValues(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseSearchArray(searchParams: URLSearchParams, key: string): string[] {
  const repeatedValues = searchParams.getAll(key);
  if (repeatedValues.length === 0) {
    return [];
  }

  return normalizeArrayValues(repeatedValues);
}

export function setSearchPatch(
  current: URLSearchParams,
  patch: Record<
    string,
    string | number | boolean | (string | number | boolean)[] | null | undefined
  >,
): string {
  const next = new URLSearchParams(current.toString());

  Object.entries(patch).forEach(([key, value]) => {
    next.delete(key);

    if (value === undefined || value === null || value === "") {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null || item === "") {
          return;
        }
        next.append(key, String(item));
      });
      return;
    }

    next.set(key, String(value));
  });

  return next.toString();
}
