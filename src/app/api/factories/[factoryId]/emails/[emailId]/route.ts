import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string; emailId: string }> },
) {
  const { factoryId, emailId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/emails/${emailId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string; emailId: string }> },
) {
  const { factoryId, emailId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/emails/${emailId}`);
}
