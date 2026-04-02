import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> },
) {
  const { companyId, contactId } = await params;
  return proxyToBackend(request, `/companies/${companyId}/contacts/${contactId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; contactId: string }> },
) {
  const { companyId, contactId } = await params;
  return proxyToBackend(request, `/companies/${companyId}/contacts/${contactId}`);
}
