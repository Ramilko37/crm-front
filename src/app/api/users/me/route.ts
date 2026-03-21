import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/users/me");
}

export async function PATCH(request: NextRequest) {
  return proxyToBackend(request, "/users/me");
}
