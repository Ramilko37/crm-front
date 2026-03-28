import { NextRequest } from "next/server";

import { buildRequestMultipartPayload } from "@/server/bff/orchestration";
import { proxyJsonPayloadAsMultipart, proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/requests");
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  // Canonical request create is multipart/form-data. In that case proxy body as-is.
  if (contentType.includes("multipart/form-data")) {
    return proxyToBackend(request, "/requests");
  }

  // Keep backward compatibility for JSON callers.
  return proxyJsonPayloadAsMultipart(request, "/requests", {
    payloadBuilder: buildRequestMultipartPayload,
  });
}
