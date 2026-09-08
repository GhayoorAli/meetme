"use client";

import { AuthSheet } from "@/components/auth/auth-sheet";
import { AuthDivider, GoogleSignInButton } from "@/components/auth/google-sign-in";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password, passwordConfirmation);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSheet
      eyebrow="Get started"
      title="Create your MeetMe account"
      subtitle="A room in one click — then invite anyone with a short code."
    >
      <GoogleSignInButton />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p className="rounded-xl bg-[var(--meet-danger)]/10 px-4 py-3 text-sm text-[var(--meet-danger)]">
            {error}
          </p>
        ) : null}

        <div>
          <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
            Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
              Password
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
              Confirm
            </label>
            <Input
              type="password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <Button type="submit" className="mt-2 w-full" size="lg" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[var(--meet-text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--meet-primary)] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthSheet>
  );
}
