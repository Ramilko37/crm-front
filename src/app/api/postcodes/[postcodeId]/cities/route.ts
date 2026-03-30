import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

type Params = {
  params: Promise<{ postcodeId: string }>;
};

export async function GET(request: NextRequest, { params }: Params) {
  const { postcodeId } = await params;
  return proxyToBackend(request, `/postcodes/${postcodeId}/cities`);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { postcodeId } = await params;
  return proxyToBackend(request, `/postcodes/${postcodeId}/cities`);
}
