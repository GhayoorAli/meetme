"use client";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useRoomRecording } from "@/lib/use-room-recording";
import { useRecordingSync } from "@/components/meeting/recording-sync";
import { useRoomContext } from "@livekit/components-react";
import { Circle, Square, Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type RecordingControlsProps = {
  meetingCode: string;
  isHost: boolean;
  admitToken?: string;
  identity?: string;
  onToast?: (message: string, tone?: "info" | "success" | "warning") => void;
};

export function RecordingControls({
  meetingCode,
  isHost,
  admitToken,
  identity,
  onToast,
}: RecordingControlsProps) {
  const room = useRoomContext();
  const { permission, setPermission, publishRecordingEvent } = useRecordingSync();
  const { isRecording, startRecording, stopRecording } = useRoomRecording(
    room,
    meetingCode,
  );
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");
  const prevPermissionRef = useRef(permission);

  const canRecord = isHost || permission === "approved";
  const localIdentity = identity ?? room.localParticipant.identity;
  const localName =
    room.localParticipant.name || room.localParticipant.identity || "You";

  const pollStatus = useCallback(async () => {
    if (isHost || permission !== "pending") return;

    try {
      const status = await api.getRecordingStatus(meetingCode, {
        admit_token: admitToken,
        identity,
      });

      if (status.recording_permission === prevPermissionRef.current) return;

      prevPermissionRef.current = status.recording_permission;
      setPermission(status.recording_permission);

      if (status.recording_permission === "approved") {
        onToast?.(
          "The host approved your recording request. You can now record.",
          "success",
        );
      } else if (status.recording_permission === "denied") {
        onToast?.("The host denied your recording request.", "warning");
      }
    } catch {
      // Ignore polling errors.
    }
  }, [
    isHost,
    permission,
    meetingCode,
    admitToken,
    identity,
    onToast,
    setPermission,
  ]);

  useEffect(() => {
    prevPermissionRef.current = permission;
  }, [permission]);

  useEffect(() => {
    if (isHost || permission !== "pending") return;
    const interval = setInterval(pollStatus, 2500);
    return () => clearInterval(interval);
  }, [isHost, permission, pollStatus]);

  async function handleRecordClick() {
    setError("");

    if (isRecording) {
      stopRecording();
      try {
        await publishRecordingEvent({
          type: "recording_stopped",
          identity: localIdentity,
          name: localName,
        });
      } catch {
        // Local recording already stopped.
      }
      onToast?.("Recording saved to your device.", "success");
      return;
    }

    if (canRecord) {
      try {
        startRecording();
        await publishRecordingEvent({
          type: "recording_started",
          identity: localIdentity,
          name: localName,
        });
        onToast?.("You started recording this meeting.", "info");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not start recording.",
        );
      }
      return;
    }

    if (permission === "pending") {
      onToast?.("Waiting for the host to approve recording.", "info");
      return;
    }

    if (permission === "denied") {
      setError("The host denied your recording request.");
      return;
    }

    setRequesting(true);
    try {
      const result = await api.requestRecording(meetingCode, {
        admit_token: admitToken,
        identity,
      });
      setPermission(result.recording_permission);
      prevPermissionRef.current = result.recording_permission;
      onToast?.("Recording permission requested.", "info");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not request recording.",
      );
    } finally {
      setRequesting(false);
    }
  }

  function buttonLabel() {
    if (isRecording) return "Stop recording";
    if (isHost) return "Record";
    if (permission === "approved") return "Record";
    if (permission === "pending") return "Awaiting approval";
    if (permission === "denied") return "Recording denied";
    return "Request to record";
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={isRecording ? "danger" : "secondary"}
        loading={requesting}
        disabled={!isHost && permission === "denied"}
        onClick={handleRecordClick}
      >
        {isRecording ? (
          <Square className="h-4 w-4 fill-current" />
        ) : permission === "pending" ? (
          <Clock className="h-4 w-4" />
        ) : (
          <Circle
            className={`h-4 w-4 ${isRecording ? "" : "fill-[var(--meet-danger)] text-[var(--meet-danger)]"}`}
          />
        )}
        {buttonLabel()}
        {isRecording ? (
          <span className="ml-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
        ) : null}
      </Button>
      {error ? (
        <p className="max-w-[200px] text-right text-[10px] text-[var(--meet-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
