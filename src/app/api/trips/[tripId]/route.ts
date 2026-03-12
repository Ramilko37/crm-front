import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return proxyToBackend(request, `/trips/${tripId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  return proxyToBackend(request, `/trips/${tripId}`);
}
