import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function corsHeaders(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  };
}

export function proxy(request: NextRequest) {
  const headers = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: headers ?? {} });
  }
  const response = NextResponse.next();
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
