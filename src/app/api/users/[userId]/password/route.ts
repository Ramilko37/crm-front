import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return proxyToBackend(request, `/users/${userId}/password`);
}
