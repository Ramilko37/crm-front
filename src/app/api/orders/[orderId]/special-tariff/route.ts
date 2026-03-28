import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  return proxyToBackend(request, `/orders/${orderId}/special-tariff`);
}
