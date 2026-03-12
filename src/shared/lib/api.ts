import { ApiError, extractApiDetail } from "@/shared/lib/errors";
import { buildQueryString, type QueryValue } from "@/shared/lib/query-string";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  cache?: RequestCache;
};

async function parseResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const query = options.query ? buildQueryString(options.query) : "";
  const target = query ? `${path}?${query}` : path;

  const response = await fetch(target, {
    method: options.method ?? "GET",
    credentials: "include",
    cache: options.cache ?? "no-store",
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = await parseResponsePayload(response);

  if (!response.ok) {
    throw new ApiError(response.status, extractApiDetail(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}
