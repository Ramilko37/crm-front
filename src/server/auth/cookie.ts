import { ACCESS_COOKIE_NAME } from "@/server/constants";

export function getAccessCookieOptions(maxAgeSeconds: number) {
  return {
    name: ACCESS_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function getUnauthorizedPayload() {
  return {
    detail: "Authentication credentials were not provided",
  };
}
