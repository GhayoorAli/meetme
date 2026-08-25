"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Logo } from "@/components/ui/logo";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { formatMeetingCode } from "@/lib/utils";
import type { JoinMeetingResponse, Meeting } from "@/types";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MeetingRoom } from "@/components/meeting/meeting-room";
import { Video, AlertCircle, Clock } from "lucide-react";

export default function MeetingPage() {
  const params = useParams<{ code: string }>();
  const rawCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = formatMeetingCode(decodeURIComponent(rawCode ?? ""));
  const { user } = useAuth();
  const router = useRouter();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [joinData, setJoinData] = useState<JoinMeetingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inCall, setInCall] = useState(false);
  const admitTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (rawCode && code && formatMeetingCode(decodeURIComponent(rawCode)) !== rawCode) {
      router.replace(`/m/${code}`);
    }
  }, [rawCode, code, router]);

  const loadMeeting = useCallback(async () => {
    if (!code) {
      setError("Meeting not found.");
      setLoading(false);
      return;
    }

    try {
      const data = await api.getMeeting(code);
      setMeeting(data);
    } catch {
      setError("Meeting not found.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    loadMeeting();
  }, [loadMeeting]);

  useEffect(() => {
    if (user?.name) setDisplayName(user.name);
  }, [user]);

  useEffect(() => {
    if (!waiting || !admitTokenRef.current) return;

    const interval = setInterval(async () => {
      try {
        const status = await api.getJoinStatus(code, admitTokenRef.current!);
        if (status.status === "admitted" && status.livekit) {
          setJoinData(status);
          setWaiting(false);
          setInCall(true);
        } else if (status.status === "denied") {
          setWaiting(false);
          setError("The host denied your request to join.");
        }
      } catch {
        // Keep polling while waiting.
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [waiting, code]);

  async function handleJoin() {
    setJoining(true);
    setError("");
    try {
      const data = await api.joinMeeting(
        code,
        user ? undefined : displayName,
      );

      if (data.status === "waiting") {
        admitTokenRef.current = data.participant.admit_token ?? null;
        setJoinData(data);
        setWaiting(true);
        return;
      }

      if (data.status === "admitted" && data.livekit) {
        admitTokenRef.current = data.participant.admit_token ?? null;
        setJoinData(data);
        setInCall(true);
        return;
      }

      setError(data.message ?? "Could not join meeting.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join meeting.");
    } finally {
      setJoining(false);
    }
  }

  async function handleCancelWaiting() {
    if (admitTokenRef.current) {
      try {
        await api.leaveMeeting(code, { admit_token: admitTokenRef.current });
      } catch {
        // ignore
      }
    }
    setWaiting(false);
    setJoinData(null);
    admitTokenRef.current = null;
  }

  async function handleLeave() {
    setInCall(false);
    setJoinData(null);
    admitTokenRef.current = null;
    router.push(user ? "/dashboard" : "/");
  }

  async function handleEndMeeting() {
    if (!joinData || joinData.participant.role !== "host") return;
    try {
      await api.endMeeting(code);
    } finally {
      handleLeave();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--meet-bg)]">
        <Spinner />
      </div>
    );
  }

  if (inCall && joinData?.livekit) {
    return (
      <MeetingRoom
        token={joinData.livekit.token}
        serverUrl={joinData.livekit.url}
        roomName={joinData.livekit.room}
        meetingTitle={joinData.meeting.title}
        meetingCode={code}
        isHost={joinData.participant.role === "host"}
        admitToken={joinData.participant.admit_token}
        identity={joinData.participant.identity}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
      />
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--meet-bg)]">
      <header className="flex h-16 items-center px-6">
        <Logo size="sm" />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg">
          {error ? (
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-[var(--meet-danger)]/10 p-4 text-sm text-[var(--meet-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {waiting ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--meet-primary-strong)]/20 text-[var(--meet-primary)]">
                <Clock className="h-6 w-6" />
              </div>
              <CardTitle>Waiting for the host</CardTitle>
              <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
                You&apos;ll join automatically once the host admits you.
              </p>
              <div className="mt-6 flex justify-center">
                <Spinner />
              </div>
              <Button
                className="mt-8"
                variant="secondary"
                onClick={handleCancelWaiting}
              >
                Cancel
              </Button>
            </div>
          ) : meeting && meeting.status !== "ended" ? (
            <>
              <CardTitle>{meeting.title}</CardTitle>
              <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
                Hosted by {meeting.host?.name ?? "Unknown"} ·{" "}
                <span className="font-mono">{meeting.code}</span>
              </p>
              {meeting.waiting_room_enabled ? (
                <p className="mt-3 text-xs text-[var(--meet-text-muted)]">
                  Waiting room is on — the host will admit you before you enter.
                </p>
              ) : null}

              {!user ? (
                <div className="mt-6">
                  <label className="mb-1.5 block text-sm text-[var(--meet-text-muted)]">
                    Your name
                  </label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    minLength={2}
                  />
                </div>
              ) : (
                <p className="mt-6 text-sm text-[var(--meet-text-muted)]">
                  Joining as{" "}
                  <strong className="text-[var(--meet-text)]">{user.name}</strong>
                </p>
              )}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  size="lg"
                  onClick={handleJoin}
                  loading={joining}
                  disabled={!user && displayName.trim().length < 2}
                >
                  <Video className="h-5 w-5" />
                  {user && meeting.host_id === user.id
                    ? "Join now"
                    : meeting.waiting_room_enabled
                      ? "Ask to join"
                      : "Join now"}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => router.push("/")}
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : meeting && meeting.status === "ended" ? (
            <div className="text-center py-4">
              <p className="mb-4 text-[var(--meet-text-muted)]">
                This meeting has ended.
              </p>
              <Button onClick={() => router.push("/")}>Go home</Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <Button onClick={() => router.push("/")}>Go home</Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
