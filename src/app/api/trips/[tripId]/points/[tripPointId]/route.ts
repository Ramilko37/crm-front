import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; tripPointId: string }> },
) {
  const { tripId, tripPointId } = await params;
  return proxyToBackend(request, `/trips/${tripId}/points/${tripPointId}`);
}
