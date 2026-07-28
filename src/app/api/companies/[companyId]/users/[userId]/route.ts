import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ companyId: string; userId: string }> },
) {
  const { companyId, userId } = await params;
  return proxyToBackend(request, `/companies/${companyId}/users/${userId}`);
}
