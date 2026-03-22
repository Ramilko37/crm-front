import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ countryId: string }> },
) {
  const { countryId } = await params;
  return proxyToBackend(request, `/countries/${countryId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ countryId: string }> },
) {
  const { countryId } = await params;
  return proxyToBackend(request, `/countries/${countryId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ countryId: string }> },
) {
  const { countryId } = await params;
  return proxyToBackend(request, `/countries/${countryId}`);
}
