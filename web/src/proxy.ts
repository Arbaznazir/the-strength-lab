import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Admin UI is still client-gated; API enforces real authz.
  // Block obviously malicious path traversal / null bytes early.
  const path = request.nextUrl.pathname;
  if (path.includes("\0") || path.includes("..")) {
    return new NextResponse("Bad Request", { status: 400 });
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
