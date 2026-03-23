import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ factoryId: string; addressId: string }> },
) {
  const { factoryId, addressId } = await context.params;
  return proxyToBackend(request, `/factories/${factoryId}/loading-addresses/${addressId}/make-primary`);
}
