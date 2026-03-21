import { NextRequest, NextResponse } from "next/server";

import { getAccessCookieOptions } from "@/server/auth/cookie";
import { postToBackend } from "@/server/bff/proxy";
import type { AuthTokenResponse } from "@/shared/types/entities";

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as { login?: string; password?: string };
  if (!payload.login || !payload.password) {
    return NextResponse.json({ detail: "login and password are required" }, { status: 400 });
  }

  let backendResult: Awaited<ReturnType<typeof postToBackend>>;
  try {
    backendResult = await postToBackend("/auth/login", {
      login: payload.login,
      password: payload.password,
    });
  } catch {
    return NextResponse.json(
      {
        detail: "Backend is unavailable. Check BASE_BACKEND_URL and backend health.",
      },
      { status: 503 },
    );
  }

  const { response, data } = backendResult;

  if (!response.ok) {
    if (response.status >= 500) {
      return NextResponse.json(
        {
          detail: "Login failed on backend. Try root/root or check backend users state.",
        },
        { status: 401 },
      );
    }
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
