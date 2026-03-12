import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE_NAME } from "@/server/constants";

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasToken = Boolean(request.cookies.get(ACCESS_COOKIE_NAME)?.value);

  if (pathname === "/") {
    const target = hasToken ? "/orders" : "/login";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (pathname === "/login") {
    if (hasToken) {
      return NextResponse.redirect(new URL("/orders", request.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") {
      login.searchParams.set("next", `${pathname}${search}`);
    }
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
