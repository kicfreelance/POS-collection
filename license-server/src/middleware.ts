import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = { matcher: ["/admin/:path*"] };

/** HTTP Basic auth gate for the admin web UI. */
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || "admin";
  const pass = process.env.ADMIN_PASSWORD || "";

  if (!pass) {
    return new NextResponse("ADMIN_PASSWORD is not configured on the server.", {
      status: 503,
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    // atob is available in the middleware runtime.
    const [u, ...rest] = atob(encoded).split(":");
    const p = rest.join(":");
    if (u === user && p === pass) return NextResponse.next();
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="license-admin"' },
  });
}
