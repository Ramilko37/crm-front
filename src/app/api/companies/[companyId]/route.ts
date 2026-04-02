import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  return proxyToBackend(request, `/companies/${companyId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  return proxyToBackend(request, `/companies/${companyId}`);
}
