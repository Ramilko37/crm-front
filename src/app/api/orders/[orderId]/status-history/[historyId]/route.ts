import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; historyId: string }> },
) {
  const { orderId, historyId } = await params;
  return proxyToBackend(request, `/orders/${orderId}/status-history/${historyId}`);
}
