import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; loadingPointId: string }> },
) {
  const { tripId, loadingPointId } = await params;
  return proxyToBackend(request, `/trips/${tripId}/loading-points/${loadingPointId}`);
}
