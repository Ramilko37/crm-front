import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME } from "@/server/constants";
import { getUnauthorizedPayload } from "@/server/auth/cookie";
import { buildBackendUrl } from "@/server/bff/backend-url";

async function parseBackendPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function createHeaders(request: NextRequest, token: string | null): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  options: {
    requireAuth?: boolean;
    methodOverride?: string;
  } = {},
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;

  if (options.requireAuth !== false && !token) {
    return NextResponse.json(getUnauthorizedPayload(), {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer" },
    });
  }

  const targetUrl = buildBackendUrl(backendPath, request.nextUrl.search);
  const method = options.methodOverride ?? request.method;
  const body = method === "GET" || method === "HEAD" ? undefined : await request.text();

  const response = await fetch(targetUrl, {
    method,
    headers: createHeaders(request, token),
    body,
    cache: "no-store",
  });

  const payload = await parseBackendPayload(response);

  if (typeof payload === "string") {
    return new NextResponse(payload, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "text/plain",
      },
    });
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: response.headers.get("www-authenticate")
      ? { "WWW-Authenticate": response.headers.get("www-authenticate") ?? "Bearer" }
      : undefined,
  });
}

export async function postToBackend(path: string, payload: unknown) {
  const response = await fetch(buildBackendUrl(path, ""), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await parseBackendPayload(response);
  return { response, data };
}
