import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ factoryId: string; addressId: string }> },
) {
  const { factoryId, addressId } = await context.params;
  return proxyToBackend(request, `/factories/${factoryId}/loading-addresses/${addressId}`);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ factoryId: string; addressId: string }> },
) {
  const { factoryId, addressId } = await context.params;
  return proxyToBackend(request, `/factories/${factoryId}/loading-addresses/${addressId}`);
}
