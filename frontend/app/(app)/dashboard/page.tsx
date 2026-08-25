"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { copyToClipboard, formatMeetingCode } from "@/lib/utils";
import type { Meeting } from "@/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Video,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Users,
} from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [joinError, setJoinError] = useState("");

  const loadMeetings = useCallback(async () => {
    try {
      const data = await api.getMeetings();
      setMeetings(data);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  async function handleNewMeeting() {
    setCreating(true);
    setError("");
    try {
      const meeting = await api.createMeeting();
      router.push(`/m/${meeting.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting.");
      setCreating(false);
    }
  }

  async function handleCopy(code: string, url: string) {
    await copyToClipboard(url);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    const code = formatMeetingCode(joinCode);
    if (!code) {
      setJoinError("Enter a meeting code or paste a join link.");
      return;
    }
    router.push(`/m/${code}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-10">
        <h1 className="text-2xl font-semibold text-[var(--meet-text)]">
          Welcome back, {user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[var(--meet-text-muted)]">
          Start a new meeting or join one with a code.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {error ? (
          <div className="lg:col-span-2 rounded-xl bg-[var(--meet-danger)]/10 px-4 py-3 text-sm text-[var(--meet-danger)]">
            {error}
            {!error.includes("Unauthenticated") ? null : (
              <span> Make sure the Laravel API is running on port 8000.</span>
            )}
          </div>
        ) : null}

        <Card>
          <CardTitle>Start a meeting</CardTitle>
          <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
            Create an instant meeting and share the link with friends.
          </p>
          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={handleNewMeeting}
            loading={creating}
          >
            <Video className="h-5 w-5" />
            New meeting
          </Button>
        </Card>

        <Card>
          <CardTitle>Join with code</CardTitle>
          <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
            Enter the meeting code shared with you.
          </p>
          <form onSubmit={handleJoin} className="mt-6 flex flex-col gap-2">
            <div className="flex gap-3">
              <input
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError("");
                }}
                placeholder="Paste link or code"
                className="h-11 flex-1 rounded-lg border border-[var(--meet-border)] bg-[var(--meet-bg)] px-4 text-[var(--meet-text)] outline-none focus:border-[var(--meet-primary)]"
              />
              <Button type="submit" variant="secondary">
                Join
              </Button>
            </div>
            {joinError ? (
              <p className="text-sm text-[var(--meet-danger)]">{joinError}</p>
            ) : null}
          </form>
        </Card>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-lg font-medium text-[var(--meet-text)]">
          Your recent meetings
        </h2>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : meetings.length === 0 ? (
          <Card className="text-center py-12">
            <p className="text-[var(--meet-text-muted)]">
              No meetings yet. Create your first one above.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {meetings.map((meeting) => (
              <div
                key={meeting.id}
                className="flex flex-col gap-4 rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[var(--meet-text)]">
                    {meeting.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--meet-text-muted)]">
                    <span className="font-mono">{meeting.code}</span>
                    <span
                      className={
                        meeting.status === "active"
                          ? "text-[var(--meet-success)]"
                          : ""
                      }
                    >
                      {meeting.status}
                    </span>
                    {meeting.participant_count != null ? (
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {meeting.participant_count}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {meeting.status === "active" ? (
                    <Link href={`/m/${meeting.code}`}>
                      <Button size="sm">
                        <ExternalLink className="h-4 w-4" />
                        Join
                      </Button>
                    </Link>
                  ) : null}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCopy(meeting.code, meeting.join_url)}
                  >
                    {copiedCode === meeting.code ? (
                      <Check className="h-4 w-4 text-[var(--meet-success)]" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    Copy link
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
