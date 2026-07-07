import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { detail: "Requests API removed. Use /api/orders/{id}/documents/{documentId}/download." },
    { status: 410 },
  );
}
