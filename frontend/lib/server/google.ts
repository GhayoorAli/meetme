import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/server/db";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
};

export function googleRedirectUri() {
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/api/auth/google/callback`;
}

export function googleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAuthorizationUrl(state: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error("GOOGLE_CLIENT_ID is not set.");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export function safeNextPath(raw: string | null | undefined) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function exchangeGoogleCode(code: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured.");
  }

  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json()) as { id_token?: string; error?: string };
  if (!response.ok || !data.id_token) {
    throw new Error(data.error ?? "Google did not return an ID token.");
  }
  return data.id_token;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  const audiences = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter((value): value is string => Boolean(value));

  if (audiences.length === 0) {
    throw new Error("GOOGLE_CLIENT_ID is not set.");
  }

  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience: audiences,
  });

  const email = String(payload.email ?? "").toLowerCase().trim();
  const googleId = String(payload.sub ?? "");
  if (!email || !googleId) {
    throw new Error("Google did not provide an email address.");
  }
  if (payload.email_verified !== true) {
    throw new Error("Google email is not verified.");
  }

  return {
    googleId,
    email,
    name: String(payload.name ?? email.split("@")[0]),
  };
}

export async function upsertGoogleUser(profile: GoogleProfile) {
  const existingGoogle = await prisma.user.findUnique({
    where: { googleId: profile.googleId },
  });
  if (existingGoogle) {
    return prisma.user.update({
      where: { id: existingGoogle.id },
      data: {
        name: profile.name || existingGoogle.name,
        email: profile.email,
      },
    });
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email: profile.email },
  });
  if (existingEmail) {
    return prisma.user.update({
      where: { id: existingEmail.id },
      data: {
        googleId: profile.googleId,
        name: profile.name || existingEmail.name,
      },
    });
  }

  const count = await prisma.user.count();
  return prisma.user.create({
    data: {
      name: profile.name,
      email: profile.email,
      googleId: profile.googleId,
      passwordHash: null,
      isAdmin: count === 0,
    },
  });
}
