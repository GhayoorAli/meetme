"use client";

import { AuthSheet } from "@/components/auth/auth-sheet";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState, Suspense } from "react";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured:
    "Google sign-in is not set up yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
  google_denied: "Google sign-in was cancelled.",
  google_failed: "Google sign-in failed. Try again.",
};

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const googleError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(GOOGLE_ERRORS[googleError ?? ""] ?? "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSheet
      eyebrow="Welcome back"
      title="Sign in to your rooms"
      subtitle="Host meetings, admit guests, and pick up where you left off."
    >
      <GoogleSignInButton next={redirect} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-[var(--meet-danger)]/10 px-4 py-3 text-sm text-[var(--meet-danger)]">
            {error}
          </p>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
            Password
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" className="mt-2 w-full" size="lg" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--meet-text-muted)]">
        No account?{" "}
        <Link href="/register" className="font-medium text-[var(--meet-primary)] hover:underline">
          Create one
        </Link>
      </p>
    </AuthSheet>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthSheet
          eyebrow="Welcome back"
          title="Sign in to your rooms"
          subtitle="Host meetings, admit guests, and pick up where you left off."
        >
          <div className="h-40 animate-pulse rounded-2xl bg-white/40" />
        </AuthSheet>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
