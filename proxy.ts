import { NextResponse, type NextRequest } from "next/server";

// Optimistic auth check: without a session cookie every page goes to /login.
// The cookie signature and user are verified on the server for each request.
export function proxy(request: NextRequest) {
  if (!request.cookies.has("mh_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/login|_next|favicon.ico).*)"],
};
