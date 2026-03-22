import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; tripPathPointId: string }> },
) {
  const { tripId, tripPathPointId } = await params;
  return proxyToBackend(request, `/trips/${tripId}/path-points/${tripPathPointId}`);
}
