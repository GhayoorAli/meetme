import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  googleAuthConfigured,
  googleAuthorizationUrl,
  safeNextPath,
  upsertGoogleUser,
  verifyGoogleIdToken,
} from "@/lib/server/google";
import { setSessionCookie, toApiUser } from "@/lib/server/auth";
import { applyCors, fail, json, readBody } from "@/lib/server/http";

const OAUTH_COOKIE = "meetme_google_oauth";

export async function GET(request: Request) {
  if (!googleAuthConfigured()) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(login);
  }

  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const state = randomBytes(24).toString("hex");
  const response = NextResponse.redirect(googleAuthorizationUrl(state));
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}

export async function POST(request: Request) {
  const body = await readBody<{ id_token?: string }>(request);
  if (!body.id_token) {
    return applyCors(fail("Google ID token is required.", 422), request);
  }
  try {
    const profile = await verifyGoogleIdToken(body.id_token);
    const user = await upsertGoogleUser(profile);
    const token = await setSessionCookie({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    return applyCors(json({ data: toApiUser(user), token }), request);
  } catch (error) {
    return applyCors(
      fail(error instanceof Error ? error.message : "Google sign-in failed.", 401),
      request,
    );
  }
}

export async function OPTIONS(request: Request) {
  return applyCors(new NextResponse(null, { status: 204 }), request);
}
