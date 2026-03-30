import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

type Params = {
  params: Promise<{ postcodeId: string; cityId: string }>;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const { postcodeId, cityId } = await params;
  return proxyToBackend(request, `/postcodes/${postcodeId}/cities/${cityId}`);
}
