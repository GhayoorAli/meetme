"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { MeetingParticipant } from "@/types";
import { useParticipants } from "@livekit/components-react";
import { Check, Mic, MicOff, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type ParticipantsSidebarProps = {
  meetingCode: string;
  isHost: boolean;
  open: boolean;
  onClose: () => void;
  onWaitingCountChange?: (count: number) => void;
};

export function ParticipantsSidebar({
  meetingCode,
  isHost,
  open,
  onClose,
  onWaitingCountChange,
}: ParticipantsSidebarProps) {
  const liveParticipants = useParticipants();
  const [waiting, setWaiting] = useState<MeetingParticipant[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadWaiting = useCallback(async () => {
    if (!isHost) return;
    try {
      const list = await api.getWaitingParticipants(meetingCode);
      setWaiting(list);
      onWaitingCountChange?.(list.length);
    } catch {
      // Host may have lost session; ignore quietly.
    }
  }, [isHost, meetingCode, onWaitingCountChange]);

  useEffect(() => {
    if (!open && !isHost) return;
    loadWaiting();
    if (!isHost) return;
    const interval = setInterval(loadWaiting, 3000);
    return () => clearInterval(interval);
  }, [open, isHost, loadWaiting]);

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

        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--meet-text-muted)]">
            In this call
          </h3>
          <ul className="space-y-2">
            {liveParticipants.map((participant) => {
              const micOn = participant.isMicrophoneEnabled;
              return (
                <li
                  key={participant.identity}
                  className="flex items-center justify-between rounded-xl border border-[var(--meet-border)] bg-[var(--meet-bg)] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--meet-text)]">
                      {participant.name || participant.identity}
                      {participant.isLocal ? " (You)" : ""}
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
