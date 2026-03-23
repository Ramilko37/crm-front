import { NextRequest } from "next/server";

import { buildInternalOrderMultipartPayload } from "@/server/bff/orchestration";
import { proxyJsonPayloadAsMultipart, proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/orders");
}

export async function POST(request: NextRequest) {
  return proxyJsonPayloadAsMultipart(request, "/orders", {
    payloadBuilder: buildInternalOrderMultipartPayload,
  });
}
