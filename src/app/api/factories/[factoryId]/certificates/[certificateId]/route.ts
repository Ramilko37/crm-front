import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string; certificateId: string }> },
) {
  const { factoryId, certificateId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/certificates/${certificateId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ factoryId: string; certificateId: string }> },
) {
  const { factoryId, certificateId } = await params;
  return proxyToBackend(request, `/factories/${factoryId}/certificates/${certificateId}`);
}
