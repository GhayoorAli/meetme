"use client";

import { Button } from "@/components/ui/button";
import { useScreenShareSync } from "@/components/meeting/screen-share-sync";
import { api } from "@/lib/api";
import { useRoomContext, useLocalParticipant } from "@livekit/components-react";
import { ParticipantEvent } from "livekit-client";
import { MonitorUp, Clock, MonitorOff } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ScreenShareControlsProps = {
  meetingCode: string;
  isHost: boolean;
  admitToken?: string;
  identity?: string;
  onToast?: (message: string, tone?: "info" | "success" | "warning") => void;
};

function isScreenShareCancelled(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("permission denied") ||
    msg.includes("notallowed") ||
    msg.includes("aborterror") ||
    msg.includes("cancel") ||
    msg.includes("dismissed")
  );
}

export function ScreenShareControls({
  meetingCode,
  isHost,
  admitToken,
  identity,
  onToast,
}: ScreenShareControlsProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { permission, setPermission, publishScreenShareEvent } =
    useScreenShareSync();
  const [requesting, setRequesting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const prevPermissionRef = useRef(permission);

  const canShare = isHost || permission === "approved";
  const localIdentity = identity ?? room.localParticipant.identity;
  const localName =
    room.localParticipant.name || room.localParticipant.identity || "You";

  useEffect(() => {
    const syncSharing = () => {
      setSharing(localParticipant.isScreenShareEnabled);
    };
    syncSharing();
    localParticipant.on(ParticipantEvent.LocalTrackPublished, syncSharing);
    localParticipant.on(ParticipantEvent.LocalTrackUnpublished, syncSharing);
    return () => {
      localParticipant.off(ParticipantEvent.LocalTrackPublished, syncSharing);
      localParticipant.off(ParticipantEvent.LocalTrackUnpublished, syncSharing);
    };
  }, [localParticipant]);

  const pollStatus = useCallback(async () => {
    if (isHost || permission !== "pending") return;
    try {
      const status = await api.getScreenShareStatus(meetingCode, {
        admit_token: admitToken,
        identity,
      });
      if (status.screen_share_permission === prevPermissionRef.current) return;
      prevPermissionRef.current = status.screen_share_permission;
      setPermission(status.screen_share_permission);
      if (status.screen_share_permission === "approved") {
        onToast?.("The host approved your screen share request.", "success");
      } else if (status.screen_share_permission === "denied") {
        onToast?.("The host denied your screen share request.", "warning");
      }
    } catch {
      // ignore
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

  async function stopSharing() {
    try {
      await localParticipant.setScreenShareEnabled(false);
      await publishScreenShareEvent({
        type: "screen_share_stopped",
        identity: localIdentity,
        name: localName,
      });
      onToast?.("Screen sharing stopped.", "info");
    } catch {
      // ignore
    }
  }

  async function handleClick() {
    if (sharing) {
      await stopSharing();
      return;
    }

    if (canShare) {
      try {
        await localParticipant.setScreenShareEnabled(true, { audio: false });
        await publishScreenShareEvent({
          type: "screen_share_started",
          identity: localIdentity,
          name: localName,
        });
        onToast?.("You are sharing your screen.", "info");
      } catch (err) {
        if (!isScreenShareCancelled(err)) {
          onToast?.("Could not share screen. Please try again.", "warning");
        }
      }
      return;
    }

    if (permission === "pending") {
      onToast?.("Waiting for host to approve screen share.", "info");
      return;
    }

    if (permission === "denied") {
      onToast?.("The host denied your screen share request.", "warning");
      return;
    }

    setRequesting(true);
    try {
      const result = await api.requestScreenShare(meetingCode, {
        admit_token: admitToken,
        identity,
      });
      setPermission(result.screen_share_permission);
      prevPermissionRef.current = result.screen_share_permission;
      onToast?.("Screen share permission requested.", "info");
    } catch (err) {
      onToast?.(
        err instanceof Error ? err.message : "Could not request screen share.",
        "warning",
      );
    } finally {
      setRequesting(false);
    }
  }

  function label() {
    if (sharing) return "Stop sharing";
    if (isHost) return "Share screen";
    if (permission === "approved") return "Share screen";
    if (permission === "pending") return "Awaiting approval";
    if (permission === "denied") return "Share denied";
    return "Request to share";
  }

  return (
    <Button
      size="sm"
      variant={sharing ? "danger" : "secondary"}
      loading={requesting}
      disabled={!isHost && permission === "denied"}
      onClick={handleClick}
    >
      {sharing ? (
        <MonitorOff className="h-4 w-4" />
      ) : permission === "pending" ? (
        <Clock className="h-4 w-4" />
      ) : (
        <MonitorUp className="h-4 w-4" />
      )}
      {label()}
      {sharing ? (
        <span className="ml-1 inline-flex h-2 w-2 animate-pulse rounded-full bg-white" />
      ) : null}
    </Button>
  );
}
