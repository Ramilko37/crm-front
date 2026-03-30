import { NextRequest } from "next/server";

import { buildInternalOrderMultipartPayload } from "@/server/bff/orchestration";
import { proxyJsonPayloadAsMultipart, proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/orders");
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  // Canonical create path is multipart/form-data.
  if (contentType.includes("multipart/form-data")) {
    return proxyToBackend(request, "/orders");
  }

  // Keep backward compatibility for JSON callers.
  return proxyJsonPayloadAsMultipart(request, "/orders", {
    payloadBuilder: buildInternalOrderMultipartPayload,
  });
}
