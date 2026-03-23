import { NextRequest } from "next/server";

import { buildRequestMultipartPayload } from "@/server/bff/orchestration";
import { proxyJsonPayloadAsMultipart, proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/requests");
}

export async function POST(request: NextRequest) {
  return proxyJsonPayloadAsMultipart(request, "/requests", {
    payloadBuilder: buildRequestMultipartPayload,
  });
}
