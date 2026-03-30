import { NextRequest } from "next/server";

import { proxyJsonPayloadAsMultipart, proxyToBackend } from "@/server/bff/proxy";
import { buildClientOrderMultipartPayload } from "@/server/bff/orchestration";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  // Canonical create path is multipart/form-data.
  if (contentType.includes("multipart/form-data")) {
    return proxyToBackend(request, "/client/orders");
  }

  // Keep backward compatibility for JSON callers.
  return proxyJsonPayloadAsMultipart(request, "/client/orders", {
    payloadBuilder: buildClientOrderMultipartPayload,
  });
}
