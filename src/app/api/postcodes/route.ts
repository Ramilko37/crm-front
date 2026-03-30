import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(request: NextRequest) {
  return proxyToBackend(request, "/postcodes");
}

export async function POST(request: NextRequest) {
  return proxyToBackend(request, "/postcodes");
}
