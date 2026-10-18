import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request script nonce. Next.js reads the nonce from the request's CSP
 * header and applies it to framework and page scripts, so no inline script
 * runs without it. Pages must render dynamically for this to work.
 *
 * Style attributes rendered by React cannot carry a nonce, so styles keep
 * 'unsafe-inline'. Script execution is the injection risk that matters here.
 * Development needs 'unsafe-eval' for React's debugging tools; production does
 * not.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const development = process.env.NODE_ENV === "development";
  const secure = process.env.SITE_URL?.startsWith("https://") ?? false;
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(secure ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  return response;
}
export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
