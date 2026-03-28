import { ApiError, extractApiDetail } from "@/shared/lib/errors";
import { buildQueryString, type QueryValue } from "@/shared/lib/query-string";

type RequestBody = BodyInit | Record<string, unknown> | unknown[] | null;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: RequestBody;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  cache?: RequestCache;
  responseType?: "json" | "blob" | "text";
};

function isBodyInitValue(value: unknown): value is BodyInit {
  return (
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    typeof value === "string"
  );
}

async function parseResponsePayload(response: Response, responseType: "json" | "blob" | "text"): Promise<unknown> {
  if (responseType === "blob") {
    return response.blob();
  }

  if (responseType === "text") {
    return response.text();
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const query = options.query ? buildQueryString(options.query) : "";
  const target = query ? `${path}?${query}` : path;

  const body = options.body;
  const hasBody = body !== undefined;
  const isBodyInit = hasBody && isBodyInitValue(body);
  const isMultipart = body instanceof FormData;

  const response = await fetch(target, {
    method: options.method ?? "GET",
    credentials: "include",
    cache: options.cache ?? "no-store",
    headers: {
      ...(!isMultipart && hasBody && !isBodyInit ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
    body:
      hasBody && isBodyInit
        ? (body as BodyInit)
        : hasBody
          ? JSON.stringify(body)
          : undefined,
  });

  if (response.status === 204) {
    return null as T;
  }

  const payload = await parseResponsePayload(response, options.responseType ?? "json");

  if (!response.ok) {
    throw new ApiError(response.status, extractApiDetail(payload, `HTTP ${response.status}`));
  }

  return payload as T;
}
