import { NextResponse } from "next/server";

function removedResponse() {
  return NextResponse.json(
    { detail: "Requests API removed. Use /api/orders with order_types=request." },
    { status: 410 },
  );
}

export async function GET() {
  return removedResponse();
}

export async function POST() {
  return removedResponse();
}
