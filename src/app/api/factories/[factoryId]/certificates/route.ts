import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/certificates`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string }> },
) {
  const { factoryId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/certificates`);
}
