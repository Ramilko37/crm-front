import type { ApiErrorPayload } from "@/shared/types/entities";

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export function extractApiDetail(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybePayload = payload as Partial<ApiErrorPayload>;
  if (typeof maybePayload.detail === "string" && maybePayload.detail.trim().length > 0) {
    return maybePayload.detail;
  }

  return fallback;
}
