import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/server/db";
import type { User as ApiUser } from "@/types";

const COOKIE = "meetme_session";

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to a long random string.");
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
};

export function toApiUser(user: {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: Date;
}): ApiUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    is_admin: user.isAdmin,
    created_at: user.createdAt.toISOString(),
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(user: SessionUser) {
  return new SignJWT({
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || id < 1) return null;
    return {
      id,
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

export async function getSessionUser(request?: Request): Promise<SessionUser | null> {
  const header = request?.headers.get("authorization");
  if (header?.startsWith("Bearer ")) {
    return readSessionToken(header.slice(7).trim());
  }

  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  const jar = await cookies();
  jar.set(COOKIE, token, sessionCookieOptions());
  return token;
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function registerUser(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });
  if (existing) {
    throw new Error("That email is already registered.");
  }

  const count = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      passwordHash: await hashPassword(input.password),
      isAdmin: count === 0,
    },
  });
  return user;
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) {
    throw new Error("Invalid email or password.");
  }
  if (!user.passwordHash) {
    throw new Error("This account uses Google. Sign in with Google.");
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw new Error("Invalid email or password.");
  }
  return user;
}
