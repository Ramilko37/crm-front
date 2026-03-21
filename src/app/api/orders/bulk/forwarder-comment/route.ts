import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "/orders/bulk/forwarder-comment");
}
