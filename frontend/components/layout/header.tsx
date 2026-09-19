"use client";

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { LogOut, Shield, LayoutDashboard } from "lucide-react";

export function Header() {
  const { user, logout, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--meet-border)] bg-[var(--meet-surface)]/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
        <Logo />

        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          {loading ? (
            <div className="h-9 w-20 animate-pulse rounded-full bg-[var(--meet-surface)] sm:w-24" />
          ) : user ? (
            <>
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              {user.is_admin ? (
                <Link href="/admin">
                  <Button variant="ghost" size="sm">
                    <Shield className="h-4 w-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Button>
                </Link>
              ) : null}
              <span className="hidden truncate px-2 text-sm text-[var(--meet-text-muted)] md:inline">
                {user.name}
              </span>
              <Button variant="secondary" size="sm" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
