import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; documentId: string }> },
) {
  const { orderId, documentId } = await params;
  return proxyToBackend(request, `/orders/${orderId}/documents/${documentId}/download`);
}
