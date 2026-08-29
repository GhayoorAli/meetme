"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { MeetingParticipant } from "@/types";
import { useParticipants } from "@livekit/components-react";
import { useRecordingSync } from "@/components/meeting/recording-sync";
import { useScreenShareSync } from "@/components/meeting/screen-share-sync";
import { useHandRaise } from "@/components/meeting/hand-raise-sync";
import { Check, Hand, Mic, MicOff, MonitorUp, UserPlus, X, Video } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ParticipantsSidebarProps = {
  meetingCode: string;
  isHost: boolean;
  hostIdentity?: string;
  open: boolean;
  onClose: () => void;
  onWaitingCountChange?: (count: number) => void;
  onRecordingRequestCountChange?: (count: number) => void;
  onScreenShareRequestCountChange?: (count: number) => void;
};

function AdminBadge() {
  return (
    <span className="ml-1.5 rounded bg-[var(--meet-primary-strong)]/25 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--meet-primary)]">
      Admin
    </span>
  );
}

export function ParticipantsSidebar({
  meetingCode,
  isHost,
  hostIdentity,
  open,
  onClose,
  onWaitingCountChange,
  onRecordingRequestCountChange,
  onScreenShareRequestCountChange,
}: ParticipantsSidebarProps) {
  const liveParticipants = useParticipants();
  const { publishRecordingEvent } = useRecordingSync();
  const { publishScreenShareEvent } = useScreenShareSync();
  const { raisedHands } = useHandRaise();
  const [waiting, setWaiting] = useState<MeetingParticipant[]>([]);
  const [recordingRequests, setRecordingRequests] = useState<
    MeetingParticipant[]
  >([]);
  const [screenShareRequests, setScreenShareRequests] = useState<
    MeetingParticipant[]
  >([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const onWaitingCountChangeRef = useRef(onWaitingCountChange);
  const onRecordingRequestCountChangeRef = useRef(onRecordingRequestCountChange);
  const onScreenShareRequestCountChangeRef = useRef(onScreenShareRequestCountChange);

  useEffect(() => {
    onWaitingCountChangeRef.current = onWaitingCountChange;
    onRecordingRequestCountChangeRef.current = onRecordingRequestCountChange;
    onScreenShareRequestCountChangeRef.current = onScreenShareRequestCountChange;
  });

  const pollHostQueues = useCallback(async () => {
    if (!isHost) return;
    try {
      const [waitingList, recordingList, screenShareList] = await Promise.all([
        api.getWaitingParticipants(meetingCode),
        api.getRecordingRequests(meetingCode),
        api.getScreenShareRequests(meetingCode),
      ]);
      setWaiting(waitingList);
      setRecordingRequests(recordingList);
      setScreenShareRequests(screenShareList);
      onWaitingCountChangeRef.current?.(waitingList.length);
      onRecordingRequestCountChangeRef.current?.(recordingList.length);
      onScreenShareRequestCountChangeRef.current?.(screenShareList.length);
    } catch {
      // Host may have lost session; ignore quietly.
    }
  }, [isHost, meetingCode]);

  useEffect(() => {
    if (!isHost) return;
    void pollHostQueues();
    const interval = setInterval(() => {
      void pollHostQueues();
    }, 5000);
    return () => clearInterval(interval);
  }, [isHost, meetingCode, pollHostQueues]);

  const loadWaiting = useCallback(async () => {
    if (!isHost) return;
    try {
      const list = await api.getWaitingParticipants(meetingCode);
      setWaiting(list);
      onWaitingCountChangeRef.current?.(list.length);
    } catch {
      // Host may have lost session; ignore quietly.
    }
  }, [isHost, meetingCode]);

  async function handleAdmit(id: number) {
    setBusyId(id);
    try {
      await api.admitParticipant(meetingCode, id);
      await loadWaiting();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeny(id: number) {
    setBusyId(id);
    try {
      await api.denyParticipant(meetingCode, id);
      await loadWaiting();
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveRecording(id: number) {
    const person = recordingRequests.find((p) => p.id === id);
    setBusyId(id);
    try {
      await api.approveRecording(meetingCode, id);
      if (person?.identity) {
        await publishRecordingEvent({
          type: "recording_approved",
          identity: person.identity,
          name: person.display_name,
        });
      }
      await pollHostQueues();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDenyRecording(id: number) {
    const person = recordingRequests.find((p) => p.id === id);
    setBusyId(id);
    try {
      await api.denyRecording(meetingCode, id);
      if (person?.identity) {
        await publishRecordingEvent({
          type: "recording_denied",
          identity: person.identity,
          name: person.display_name,
        });
      }
      await pollHostQueues();
    } finally {
      setBusyId(null);
    }
  }

  async function handleApproveScreenShare(id: number) {
    const person = screenShareRequests.find((p) => p.id === id);
    setBusyId(id);
    try {
      await api.approveScreenShare(meetingCode, id);
      if (person?.identity) {
        await publishScreenShareEvent({
          type: "screen_share_approved",
          identity: person.identity,
          name: person.display_name,
        });
      }
      await pollHostQueues();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDenyScreenShare(id: number) {
    const person = screenShareRequests.find((p) => p.id === id);
    setBusyId(id);
    try {
      await api.denyScreenShare(meetingCode, id);
      if (person?.identity) {
        await publishScreenShareEvent({
          type: "screen_share_denied",
          identity: person.identity,
          name: person.display_name,
        });
      }
      await pollHostQueues();
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-l border-[var(--meet-border)] bg-[var(--meet-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--meet-border)] px-4 py-3">
        <div>
          <h2 className="font-medium text-[var(--meet-text)]">People</h2>
          <p className="text-xs text-[var(--meet-text-muted)]">
            {liveParticipants.length} in call
            {isHost && waiting.length > 0
              ? ` · ${waiting.length} waiting`
              : ""}
            {isHost && recordingRequests.length > 0
              ? ` · ${recordingRequests.length} recording`
              : ""}
            {isHost && screenShareRequests.length > 0
              ? ` · ${screenShareRequests.length} screen`
              : ""}
            {raisedHands.size > 0 ? ` · ${raisedHands.size} raised` : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {isHost && waiting.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--meet-primary)]">
              <UserPlus className="h-3.5 w-3.5" />
              Waiting to join
            </h3>
            <ul className="space-y-2">
              {waiting.map((person) => (
                <li
                  key={person.id}
                  className="rounded-xl border border-[var(--meet-border)] bg-[var(--meet-bg)] p-3"
                >
                  <p className="font-medium text-[var(--meet-text)]">
                    {person.display_name}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={busyId === person.id}
                      onClick={() => handleAdmit(person.id)}
                    >
                      <Check className="h-4 w-4" />
                      Admit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === person.id}
                      onClick={() => handleDeny(person.id)}
                    >
                      <X className="h-4 w-4" />
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isHost && recordingRequests.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--meet-danger)]">
              <Video className="h-3.5 w-3.5" />
              Recording requests
            </h3>
            <ul className="space-y-2">
              {recordingRequests.map((person) => (
                <li
                  key={person.id}
                  className="rounded-xl border border-[var(--meet-border)] bg-[var(--meet-bg)] p-3"
                >
                  <p className="font-medium text-[var(--meet-text)]">
                    {person.display_name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--meet-text-muted)]">
                    Wants to record this meeting
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={busyId === person.id}
                      onClick={() => handleApproveRecording(person.id)}
                    >
                      <Check className="h-4 w-4" />
                      Allow
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === person.id}
                      onClick={() => handleDenyRecording(person.id)}
                    >
                      <X className="h-4 w-4" />
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {raisedHands.size > 0 ? (
          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--meet-primary)]">
              <Hand className="h-3.5 w-3.5" />
              Raised hands
            </h3>
            <ul className="space-y-2">
              {[...raisedHands.entries()].map(([identity, name]) => (
                <li
                  key={identity}
                  className="rounded-xl border border-[var(--meet-primary)]/30 bg-[var(--meet-bg)] px-3 py-2.5 text-sm text-[var(--meet-text)]"
                >
                  ✋ {name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {isHost && screenShareRequests.length > 0 ? (
          <section className="mb-6">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--meet-primary-strong)]">
              <MonitorUp className="h-3.5 w-3.5" />
              Screen share requests
            </h3>
            <ul className="space-y-2">
              {screenShareRequests.map((person) => (
                <li
                  key={person.id}
                  className="rounded-xl border border-[var(--meet-border)] bg-[var(--meet-bg)] p-3"
                >
                  <p className="font-medium text-[var(--meet-text)]">
                    {person.display_name}
                  </p>
                  <p className="mt-1 text-xs text-[var(--meet-text-muted)]">
                    Wants to share their screen
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      loading={busyId === person.id}
                      onClick={() => handleApproveScreenShare(person.id)}
                    >
                      <Check className="h-4 w-4" />
                      Allow
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={busyId === person.id}
                      onClick={() => handleDenyScreenShare(person.id)}
                    >
                      <X className="h-4 w-4" />
                      Deny
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
            In this call
          </h3>
          <ul className="space-y-2">
            {liveParticipants.map((participant) => {
              const micOn = participant.isMicrophoneEnabled;
              const handUp = raisedHands.has(participant.identity);
              return (
                <li
                  key={participant.identity}
                  className="flex items-center justify-between rounded-xl border border-[var(--meet-border)] bg-[var(--meet-bg)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--meet-text)]">
                      {handUp ? "✋ " : ""}
                      {participant.name || participant.identity}
                      {participant.isLocal ? " (You)" : ""}
                      {hostIdentity && participant.identity === hostIdentity ? (
                        <AdminBadge />
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--meet-text-muted)]">
                      {participant.isLocal ? "You" : "In call"}
                    </p>
                  </div>
                  {micOn ? (
                    <Mic className="h-4 w-4 shrink-0 text-[var(--meet-success)]" />
                  ) : (
                    <MicOff className="h-4 w-4 shrink-0 text-[var(--meet-text-muted)]" />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </aside>
  );
}
