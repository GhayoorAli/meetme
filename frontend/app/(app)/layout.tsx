"use client";

import { Header } from "@/components/layout/header";
import { useAuth } from "@/lib/auth-context";
import { Spinner } from "@/components/ui/spinner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login?redirect=/dashboard");
    }
  }, [user, loading, router]);

  if (!loading && !user) return null;

  return (
    <div className="relative flex min-h-full flex-col">
      <div className="meet-atmosphere meet-atmosphere-page" aria-hidden />
      <Header />
      {loading ? (
        <div className="relative z-10 flex flex-1 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <main className="relative z-10 flex-1">{children}</main>
      )}
    </div>
  );
}
