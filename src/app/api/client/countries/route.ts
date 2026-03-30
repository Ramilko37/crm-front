import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/client/countries");
}
