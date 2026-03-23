import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  return proxyToBackend(request, `/orders/${orderId}/quote-price`);
}
