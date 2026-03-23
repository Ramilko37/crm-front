import { NextRequest } from "next/server";

import { proxyJsonPayloadAsMultipart } from "@/server/bff/proxy";
import { buildClientOrderMultipartPayload } from "@/server/bff/orchestration";

export async function POST(request: NextRequest) {
  return proxyJsonPayloadAsMultipart(request, "/client/orders", {
    payloadBuilder: buildClientOrderMultipartPayload,
  });
}
