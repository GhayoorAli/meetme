import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeGoogleCode,
  safeNextPath,
  upsertGoogleUser,
  verifyGoogleIdToken,
} from "@/lib/server/google";
import { sessionCookieOptions, signSession } from "@/lib/server/auth";

const OAUTH_COOKIE = "meetme_google_oauth";
const SESSION_COOKIE = "meetme_session";

function loginError(request: Request, code: string) {
  const login = new URL("/login", request.url);
  login.searchParams.set("error", code);
  const response = NextResponse.redirect(login);
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("error")) {
    return loginError(request, "google_denied");
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return loginError(request, "google_failed");
  }

  const jar = await cookies();
  let stored: { state?: string; next?: string } = {};
  try {
    const raw = jar.get(OAUTH_COOKIE)?.value;
    stored = raw ? (JSON.parse(raw) as { state?: string; next?: string }) : {};
  } catch {
    stored = {};
  }
  if (!stored.state || stored.state !== state) {
    return loginError(request, "google_failed");
  }

  try {
    const idToken = await exchangeGoogleCode(code);
    const profile = await verifyGoogleIdToken(idToken);
    const user = await upsertGoogleUser(profile);
    const token = await signSession({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    });
    const destination = new URL(safeNextPath(stored.next), request.url);
    const response = NextResponse.redirect(destination);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    response.cookies.delete(OAUTH_COOKIE);
    return response;
  } catch {
    return loginError(request, "google_failed");
  }
}
