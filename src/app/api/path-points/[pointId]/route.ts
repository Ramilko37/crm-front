import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ pointId: string }> },
) {
  const { pointId } = await params;
  return proxyToBackend(request, `/path-points/${pointId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ pointId: string }> },
) {
  const { pointId } = await params;
  return proxyToBackend(request, `/path-points/${pointId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ pointId: string }> },
) {
  const { pointId } = await params;
  return proxyToBackend(request, `/path-points/${pointId}`);
}
