import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await context.params;
  return proxyToBackend(request, `/factories/${factoryId}/loading-addresses`);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await context.params;
  return proxyToBackend(request, `/factories/${factoryId}/loading-addresses`);
}
