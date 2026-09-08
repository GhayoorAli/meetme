"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { saveHostToken, saveGuestHostName } from "@/lib/host-token";
import { useAuth } from "@/lib/auth-context";
import { formatMeetingCode } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Video, UserRound } from "lucide-react";

export function HomeCta() {
  const { user } = useAuth();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestStarting, setGuestStarting] = useState(false);
  const [guestError, setGuestError] = useState("");
  const [showGuestForm, setShowGuestForm] = useState(false);

  async function handleNewMeeting() {
    if (!user) {
      router.push("/login?redirect=/dashboard");
      return;
    }
    router.push("/dashboard");
  }

  async function handleGuestMeeting(e: React.FormEvent) {
    e.preventDefault();
    setGuestError("");
    if (guestName.trim().length < 2) {
      setGuestError("Enter your name (at least 2 characters).");
      return;
    }
    setGuestStarting(true);
    try {
      const { meeting, host_token } = await api.createGuestMeeting(
        guestName.trim(),
      );
      saveHostToken(meeting.code, host_token);
      saveGuestHostName(meeting.code, guestName.trim());
      router.push(`/m/${meeting.code}`);
    } catch (err) {
      setGuestError(
        err instanceof Error ? err.message : "Could not start meeting.",
      );
    } finally {
      setGuestStarting(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = formatMeetingCode(joinCode);
    if (code) router.push(`/m/${code}`);
  }

  return (
    <div className="mt-10 rounded-3xl border border-white/50 bg-white/25 p-5 shadow-none backdrop-blur-md sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={handleNewMeeting}>
          <Video className="h-5 w-5" />
          New meeting
        </Button>
        <Button
          size="lg"
          className="flex-1"
          variant="secondary"
          onClick={() => setShowGuestForm((v) => !v)}
        >
          <UserRound className="h-5 w-5" />
          Start as guest
        </Button>
      </div>

      {showGuestForm ? (
        <form
          onSubmit={handleGuestMeeting}
          className="mt-4 space-y-3 rounded-2xl border border-white/40 bg-white/20 p-4"
        >
          <p className="text-sm text-[var(--meet-text-muted)]">
            No account needed — you&apos;ll host as a guest.
          </p>
          {guestError ? (
            <p className="text-sm text-[var(--meet-danger)]">{guestError}</p>
          ) : null}
          <Input
            placeholder="Your name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            minLength={2}
            className="border-white/50 bg-white/30"
          />
          <Button type="submit" className="w-full" loading={guestStarting}>
            Start guest meeting
          </Button>
        </form>
      ) : null}

      <div className="my-5 flex items-center gap-4">
        <div className="h-px flex-1 bg-[var(--meet-border)]" />
        <span className="text-xs uppercase tracking-[0.16em] text-[var(--meet-text-muted)]">
          or join
        </span>
        <div className="h-px flex-1 bg-[var(--meet-border)]" />
      </div>

      <form onSubmit={handleJoin} className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Paste link or code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          className="flex-1 border-white/50 bg-white/30"
        />
        <Button type="submit" variant="secondary" size="lg">
          Join
        </Button>
      </form>
    </div>
  );
}
