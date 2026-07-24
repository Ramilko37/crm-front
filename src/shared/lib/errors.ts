import type { ApiErrorPayload } from "@/shared/types/entities";

export type ApiValidationIssue = {
  loc: Array<string | number>;
  msg: string;
  type?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;
  readonly issues: ApiValidationIssue[];

  constructor(status: number, detail: string, issues: ApiValidationIssue[] = []) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.issues = issues;
  }
}

function isApiValidationIssue(value: unknown): value is ApiValidationIssue {
  if (!value || typeof value !== "object") return false;
  const issue = value as Partial<ApiValidationIssue>;
  return Array.isArray(issue.loc) && typeof issue.msg === "string";
}

export function extractApiValidationIssues(payload: unknown): ApiValidationIssue[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const detail = (payload as Partial<ApiErrorPayload>).detail;
  if (!Array.isArray(detail)) {
    return [];
  }

  return detail.filter(isApiValidationIssue);
}

export function extractApiDetail(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const maybePayload = payload as Partial<ApiErrorPayload>;
  if (typeof maybePayload.detail === "string" && maybePayload.detail.trim().length > 0) {
    return maybePayload.detail;
  }

  const issues = extractApiValidationIssues(payload);
  if (issues.length > 0) {
    return issues.map((issue) => issue.msg.trim()).filter(Boolean).join("; ") || fallback;
  }

  return fallback;
}
