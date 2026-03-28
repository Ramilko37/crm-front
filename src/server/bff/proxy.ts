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

function createHeaders(
  request: NextRequest,
  token: string | null,
  options: {
    omitContentType?: boolean;
  } = {},
): Headers {
  const headers = new Headers();
  headers.set("Accept", "application/json");

  const contentType = request.headers.get("content-type");
  if (!options.omitContentType && contentType) {
    headers.set("Content-Type", contentType);
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

function createUnauthorizedResponse() {
  return NextResponse.json(getUnauthorizedPayload(), {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}

function pickForwardHeaders(response: Response) {
  const nextHeaders = new Headers();

  const contentType = response.headers.get("content-type");
  if (contentType) {
    nextHeaders.set("Content-Type", contentType);
  }

  const contentDisposition = response.headers.get("content-disposition");
  if (contentDisposition) {
    nextHeaders.set("Content-Disposition", contentDisposition);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    nextHeaders.set("Content-Length", contentLength);
  }

  const wwwAuthenticate = response.headers.get("www-authenticate");
  if (wwwAuthenticate) {
    nextHeaders.set("WWW-Authenticate", wwwAuthenticate);
  }

  return nextHeaders;
}

async function toProxyResponse(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  const headers = pickForwardHeaders(response);

  if (contentType.includes("application/json")) {
    const payload = await response.json();
    return NextResponse.json(payload, {
      status: response.status,
      headers,
    });
  }

  const payload = await response.arrayBuffer();
  return new NextResponse(payload, {
    status: response.status,
    headers,
  });
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
    return createUnauthorizedResponse();
  }

  const targetUrl = buildBackendUrl(backendPath, request.nextUrl.search);
  const method = options.methodOverride ?? request.method;
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const rawBody = await request.arrayBuffer();
    if (rawBody.byteLength > 0) {
      body = rawBody;
    }
  }

  const response = await fetch(targetUrl, {
    method,
    headers: createHeaders(request, token),
    body,
    cache: "no-store",
  });

  return toProxyResponse(response);
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

export async function proxyJsonPayloadAsMultipart(
  request: NextRequest,
  backendPath: string,
  options: {
    requireAuth?: boolean;
    methodOverride?: string;
    payloadBuilder?: (payload: unknown) => unknown;
  } = {},
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;

  if (options.requireAuth !== false && !token) {
    return createUnauthorizedResponse();
  }

  let incomingPayload: unknown;
  try {
    incomingPayload = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  const payload = options.payloadBuilder ? options.payloadBuilder(incomingPayload) : incomingPayload;
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));

  const targetUrl = buildBackendUrl(backendPath, request.nextUrl.search);
  const method = options.methodOverride ?? request.method;
  const response = await fetch(targetUrl, {
    method,
    headers: createHeaders(request, token, { omitContentType: true }),
    body: formData,
    cache: "no-store",
  });

  return toProxyResponse(response);
}
