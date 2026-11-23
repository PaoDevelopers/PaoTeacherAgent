// PaoTeacherAgent: the logo uploaded on the dean page, else the built-in one.
import { NextResponse } from "next/server";
import { INTERNAL_URL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(`${INTERNAL_URL}/pao/logo`, {
      cache: "no-store",
    });
    if (upstream.ok) {
      return new NextResponse(upstream.body, {
        headers: {
          "Content-Type":
            upstream.headers.get("content-type") ?? "application/octet-stream",
          "Cache-Control": "no-cache",
        },
      });
    }
  } catch {
    // The API server is unreachable: show the built-in logo.
  }
  // Relative on purpose: behind Docker, request.url is the container's own address.
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/yk-pao-logo.png", "Cache-Control": "no-cache" },
  });
}
