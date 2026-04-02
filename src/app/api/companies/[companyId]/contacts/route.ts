import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  return proxyToBackend(request, `/companies/${companyId}/contacts`);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  return proxyToBackend(request, `/companies/${companyId}/contacts`);
}
