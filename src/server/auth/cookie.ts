import { ACCESS_COOKIE_NAME } from "@/server/constants";

function resolveCookieSecure() {
  const override = process.env.COOKIE_SECURE;

  if (override === "true") {
    return true;
  }

  if (override === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}

export function getAccessCookieOptions(maxAgeSeconds: number) {
  return {
    name: ACCESS_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: resolveCookieSecure(),
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function getUnauthorizedPayload() {
  return {
    detail: "Authentication credentials were not provided",
  };
}
