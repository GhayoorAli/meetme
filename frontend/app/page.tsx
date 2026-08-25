"use client";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth-context";
import { formatMeetingCode } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Video,
  Users,
  Shield,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  async function handleNewMeeting() {
    if (!user) {
      router.push("/login?redirect=/dashboard");
      return;
    }
    router.push("/dashboard");
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = formatMeetingCode(joinCode);
    if (code) router.push(`/m/${code}`);
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(26,115,232,0.15)_0%,_transparent_60%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-4 text-sm font-medium uppercase tracking-widest text-[var(--meet-primary)]">
                Private video meetings
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-[var(--meet-text)] sm:text-5xl lg:text-6xl">
                Meet with friends,
                <span className="block text-[var(--meet-primary)]">
                  on your own terms
                </span>
              </h1>
              <p className="mt-6 text-lg text-[var(--meet-text-muted)] sm:text-xl">
                No time limits. Up to 30 people per call. Your platform, your
                rules — a Google Meet alternative built for you.
              </p>
            </div>

            <div className="mx-auto mt-12 max-w-xl">
              <div className="rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)]/80 p-6 backdrop-blur-sm">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={handleNewMeeting}
                  >
                    <Video className="h-5 w-5" />
                    New meeting
                  </Button>
                </div>

                <div className="my-6 flex items-center gap-4">
                  <div className="h-px flex-1 bg-[var(--meet-border)]" />
                  <span className="text-sm text-[var(--meet-text-muted)]">or</span>
                  <div className="h-px flex-1 bg-[var(--meet-border)]" />
                </div>

                <form onSubmit={handleJoin} className="flex gap-3">
                  <Input
                    placeholder="Paste link or code (e.g. 8k7-6erk-oic)"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" variant="secondary" size="lg">
                    Join
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--meet-border)] bg-[var(--meet-surface)]/30 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-semibold text-[var(--meet-text)]">
              Everything you need for group calls
            </h2>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Video,
                  title: "HD video & audio",
                  desc: "Crystal-clear calls powered by LiveKit SFU technology.",
                },
                {
                  icon: Users,
                  title: "Up to 30 people",
                  desc: "Comfortable group calls for friends, teams, and communities.",
                },
                {
                  icon: Zap,
                  title: "Instant meetings",
                  desc: "Create a room in one click and share the link instantly.",
                },
                {
                  icon: Shield,
                  title: "Your platform",
                  desc: "Self-hosted control. No surprise time limits or paywalls.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-6"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--meet-primary-strong)]/20 text-[var(--meet-primary)]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-medium text-[var(--meet-text)]">{title}</h3>
                  <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
                    {desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--meet-border)] py-8 text-center text-sm text-[var(--meet-text-muted)]">
        MeetMe — built for personal and friends use
      </footer>
    </div>
  );
}
