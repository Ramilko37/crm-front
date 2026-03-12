import { NextRequest, NextResponse } from "next/server";

import { getAccessCookieOptions } from "@/server/auth/cookie";
import { postToBackend } from "@/server/bff/proxy";
import type { AuthTokenResponse } from "@/shared/types/entities";

export async function POST(request: NextRequest) {
  const payload = await request.json();
  const { response, data } = await postToBackend("/auth/login", payload);

  if (!response.ok) {
    return NextResponse.json(data, { status: response.status });
  }

  const authData = data as AuthTokenResponse;
  if (!authData.access_token) {
    return NextResponse.json({ detail: "Invalid login response" }, { status: 502 });
  }

  const nextResponse = NextResponse.json(authData, { status: response.status });
  nextResponse.cookies.set(
    getAccessCookieOptions(authData.expires_in).name,
    authData.access_token,
    getAccessCookieOptions(authData.expires_in),
  );

  return nextResponse;
}
