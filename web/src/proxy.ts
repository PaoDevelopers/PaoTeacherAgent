import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SERVER_SIDE_ONLY__AUTH_COOKIE_NAME } from "@/lib/constants";
import { loginPath, ORIGINAL_PATH_HEADER } from "@/lib/auth/paths";

// Route prefixes that never allow anonymous access, so we fast-fail at the edge
// when no auth cookie is present. "/app" is intentionally excluded: it allows
// anonymous access via a runtime (Redis-backed) setting the edge can't read from
// cookies, so it's gated server-side by requireAuth() in
// web/src/app/app/layout.tsx instead.
const PROTECTED_ROUTES = ["/admin", "/agents", "/connector"];

// Public route prefixes (no authentication required)
const PUBLIC_ROUTES = ["/auth", "/anonymous", "/_next", "/api"];

// The CSP is emitted here, not in next.config.js `headers()` (which is baked
// into the build), so WEB_FRAME_PROTECTION_ENABLED is read at runtime and
// applies on restart without a rebuild.
//
// frame-ancestors controls who may embed Onyx in an <iframe>. On by default;
// WEB_FRAME_PROTECTION_ENABLED=false drops it so any origin may frame Onyx.
// chrome-extension:/moz-extension: are app-wide (the extension iframes every
// route, not just /nrf) and cover both Chromium and Firefox builds.
// X-Frame-Options is omitted: it can't express the extension allowance and
// modern browsers honor frame-ancestors.
const frameProtectionEnabled =
  process.env.WEB_FRAME_PROTECTION_ENABLED?.toLowerCase() !== "false";

// Strict CSP (default-src/script-src/connect-src/etc. directives). Off by
// default while the allowlist is validated against real deployments; enable
// with WEB_STRICT_CSP_ENABLED=true (runtime, no rebuild needed).
const strictCspEnabled =
  process.env.WEB_STRICT_CSP_ENABLED?.toLowerCase() === "true";

// NEXT_PUBLIC_* and NODE_ENV are inlined at build, so this stays build-time —
// only the frame-ancestors flag above is runtime.
const upgradeInsecureRequests =
  process.env.NEXT_PUBLIC_CLOUD_ENABLED === "true" &&
  process.env.NODE_ENV !== "development";

const CSP_HEADER = [
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
  "font-src 'self' https://fonts.gstatic.com;",
  "object-src 'none';",
  "base-uri 'self';",
  "form-action 'self';",
  frameProtectionEnabled
    ? "frame-ancestors 'self' chrome-extension: moz-extension:;"
    : "",
  upgradeInsecureRequests ? "upgrade-insecure-requests;" : "",
  // 'unsafe-inline' is required: the App Router emits inline scripts for
  // hydration (nonce-based CSP is a deferred follow-up).
  strictCspEnabled ? "default-src 'self';" : "",
  strictCspEnabled ? "script-src 'self' 'unsafe-inline';" : "",
  // connect-src blob: for the DOCX preview modal, which fetches the document
  // back out of a blob: URL to render it.
  strictCspEnabled ? "connect-src 'self' blob:;" : "",
  // img-src stays broad: chat markdown and connector content render remote
  // images.
  strictCspEnabled ? "img-src 'self' data: blob: https:;" : "",
  // cdn.onyx.app serves the Craft page's animated background video.
  strictCspEnabled ? "media-src 'self' blob: data: https://cdn.onyx.app;" : "",
  // worker-src blob: covers pdf.js-style workers; frame-src blob: covers in-app
  // PDF preview.
  strictCspEnabled ? "worker-src 'self' blob:;" : "",
  strictCspEnabled ? "frame-src 'self' blob:;" : "",
]
  .filter(Boolean)
  .join(" ");

// Match every route except Next.js internals and static assets so the CSP rides
// on all document responses. The auth logic below is pathname-gated, so the
// broader match doesn't change its behavior. Matchers must be static strings —
// no JS runs before `config` is read.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy", CSP_HEADER);
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathWithQuery = pathname + request.nextUrl.search;

  // Set, not merged, so a client cannot supply its own.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(ORIGINAL_PATH_HEADER, pathWithQuery);

  // Auth Check: Fast-fail at edge if no cookie (defense in depth)
  // Note: Layouts still do full verification (token validity, roles, etc.)
  const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !isPublicRoute) {
    const authCookie = request.cookies.get(SERVER_SIDE_ONLY__AUTH_COOKIE_NAME);

    // Require a real auth cookie; the anonymous-user cookie must not satisfy the
    // edge gate for these routes (the server-side role checks reject it anyway).
    if (!authCookie) {
      const loginUrl = new URL(loginPath({ next: pathWithQuery }), request.url);
      return withSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}
