import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}`);
}
