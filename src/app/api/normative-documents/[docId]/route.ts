import { NextRequest } from "next/server";

import { proxyToBackend } from "@/server/bff/proxy";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const { docId } = await params;
  return proxyToBackend(request, `/normative-documents/${docId}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const { docId } = await params;
  return proxyToBackend(request, `/normative-documents/${docId}`);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ docId: string }> },
) {
  const { docId } = await params;
  return proxyToBackend(request, `/normative-documents/${docId}`);
}
