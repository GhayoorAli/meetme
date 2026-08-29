"use client";

import { Button } from "@/components/ui/button";
import { BackgroundControls } from "@/components/meeting/background-controls";
import { ParticipantsSidebar } from "@/components/meeting/participants-sidebar";
import { RecordingControls } from "@/components/meeting/recording-controls";
import { RecordingSyncProvider } from "@/components/meeting/recording-sync";
import { ScreenShareSyncProvider } from "@/components/meeting/screen-share-sync";
import { HandRaiseProvider } from "@/components/meeting/hand-raise-sync";
import { HandRaiseControls } from "@/components/meeting/hand-raise-controls";
import { ScreenShareControls } from "@/components/meeting/screen-share-controls";
import {
  ScreenShareHighlighterControls,
  ScreenShareHighlighterOverlay,
} from "@/components/meeting/screen-share-highlighter";
import { ScreenShareHighlighterProvider } from "@/components/meeting/screen-share-highlighter-sync";
import { WhiteboardPanel } from "@/components/meeting/whiteboard-panel";
import { WhiteboardSyncProvider } from "@/components/meeting/whiteboard-sync";
import { MeetingToasts, useToasts } from "@/components/meeting/meeting-toasts";
import { copyToClipboard } from "@/lib/utils";
import { api } from "@/lib/api";
import {
  LiveKitRoom,
  VideoConference,
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import { RoomEvent, VideoQuality, type RemoteParticipant } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  PhoneOff,
  XCircle,
  RefreshCw,
  AlertCircle,
  Users,
  PenLine,
} from "lucide-react";
import { HD_ROOM_OPTIONS, HD_VIDEO_CAPTURE } from "@/lib/livekit-options";
import type { RecordingPermissionStatus, ScreenSharePermissionStatus } from "@/types";

type MeetingRoomProps = {
  token: string;
  serverUrl: string;
  roomName: string;
  meetingTitle: string;
  meetingCode: string;
  isHost: boolean;
  hostIdentity?: string;
  admitToken?: string;
  identity?: string;
  recordingPermission?: RecordingPermissionStatus;
  screenSharePermission?: ScreenSharePermissionStatus;
  onLeave: () => void;
  onEndMeeting: () => void;
};

function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("permission") ||
    lower.includes("notallowed") ||
    lower.includes("dismissed") ||
    lower.includes("denied")
  );
}

function RoomEventBridge({
  onToast,
}: {
  onToast: (message: string, tone?: "info" | "success" | "warning") => void;
}) {
  const room = useRoomContext();

  useEffect(() => {
    const preferHd = (participant: RemoteParticipant) => {
      participant.videoTrackPublications.forEach((publication) => {
        if (publication.isSubscribed) {
          publication.setVideoQuality(VideoQuality.HIGH);
        }
      });
    };

    const onJoined = (participant: RemoteParticipant) => {
      preferHd(participant);
      onToast(`${participant.name || participant.identity} joined the meeting`);
    };
    const onLeft = (participant: RemoteParticipant) => {
      onToast(
        `${participant.name || participant.identity} left the meeting`,
        "warning",
      );
    };
    const onTrackSubscribed = () => {
      room.remoteParticipants.forEach((participant) => preferHd(participant));
    };

    room.remoteParticipants.forEach((participant) => preferHd(participant));
    room.on(RoomEvent.ParticipantConnected, onJoined);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoined);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
    };
  }, [room, onToast]);

  return null;
}

function MeetingChrome({
  meetingTitle,
  meetingCode,
  isHost,
  hostIdentity,
  admitToken,
  identity,
  recordingPermission = "none",
  screenSharePermission = "none",
  onLeave,
  onEndMeeting,
}: Omit<MeetingRoomProps, "token" | "serverUrl" | "roomName">) {
  const [copied, setCopied] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [waitingCount, setWaitingCount] = useState(0);
  const [recordingRequestCount, setRecordingRequestCount] = useState(0);
  const [screenShareRequestCount, setScreenShareRequestCount] = useState(0);
  const prevWaitingRef = useRef(0);
  const prevRecordingRef = useRef(0);
  const { toasts, pushToast, dismissToast } = useToasts();
  const room = useRoomContext();

  const localIdentity = identity ?? room.localParticipant.identity;
  const localName =
    room.localParticipant.name || room.localParticipant.identity || "You";

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${meetingCode}`
      : "";

  async function handleCopyLink() {
    await copyToClipboard(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleLeaveClick() {
    try {
      await api.leaveMeeting(meetingCode, {
        admit_token: admitToken,
        identity,
      });
    } catch {
      // Still leave the UI even if API fails.
    }
    onLeave();
  }

  useEffect(() => {
    if (isHost && waitingCount > prevWaitingRef.current) {
      const added = waitingCount - prevWaitingRef.current;
      pushToast(
        added === 1
          ? "Someone is waiting to join"
          : `${added} people are waiting to join`,
        "info",
      );
    }
    prevWaitingRef.current = waitingCount;
  }, [waitingCount, isHost, pushToast]);

  useEffect(() => {
    if (isHost && recordingRequestCount > prevRecordingRef.current) {
      const added = recordingRequestCount - prevRecordingRef.current;
      pushToast(
        added === 1
          ? "Someone requested to record"
          : `${added} people requested to record`,
        "info",
      );
    }
    prevRecordingRef.current = recordingRequestCount;
  }, [recordingRequestCount, isHost, pushToast]);

  const prevScreenShareRef = useRef(0);
  useEffect(() => {
    if (isHost && screenShareRequestCount > prevScreenShareRef.current) {
      const added = screenShareRequestCount - prevScreenShareRef.current;
      pushToast(
        added === 1
          ? "Someone requested to share screen"
          : `${added} people requested to share screen`,
        "info",
      );
    }
    prevScreenShareRef.current = screenShareRequestCount;
  }, [screenShareRequestCount, isHost, pushToast]);

  return (
    <RecordingSyncProvider
      localIdentity={localIdentity}
      localName={localName}
      initialPermission={isHost ? "approved" : recordingPermission}
      onToast={pushToast}
    >
      <ScreenShareSyncProvider
        localIdentity={localIdentity}
        initialPermission={isHost ? "approved" : screenSharePermission}
        onToast={pushToast}
      >
        <HandRaiseProvider
          localIdentity={localIdentity}
          localName={localName}
          onToast={pushToast}
        >
        <WhiteboardSyncProvider
          localIdentity={localIdentity}
          localName={localName}
          isHost={isHost}
          onToast={pushToast}
        >
        <ScreenShareHighlighterProvider localIdentity={localIdentity}>
      <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--meet-border)] px-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-[var(--meet-text)]">
            {meetingTitle}
          </p>
          <p className="text-xs text-[var(--meet-text-muted)] font-mono">
            {meetingCode}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <HandRaiseControls />
          <ScreenShareControls
            meetingCode={meetingCode}
            isHost={isHost}
            admitToken={admitToken}
            identity={identity}
            onToast={pushToast}
          />
          <ScreenShareHighlighterControls disabled={whiteboardOpen} />
          <Button
            size="sm"
            variant={whiteboardOpen ? "primary" : "secondary"}
            onClick={() => setWhiteboardOpen((v) => !v)}
          >
            <PenLine className="h-4 w-4" />
            Whiteboard
          </Button>
          <RecordingControls
            meetingCode={meetingCode}
            isHost={isHost}
            admitToken={admitToken}
            identity={identity}
            onToast={pushToast}
          />
          <BackgroundControls />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Users className="h-4 w-4" />
            People
            {isHost && waitingCount > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--meet-danger)] px-1.5 text-[10px] text-white">
                {waitingCount}
              </span>
            ) : null}
            {isHost && recordingRequestCount > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--meet-danger)]/80 px-1.5 text-[10px] text-white">
                {recordingRequestCount}
              </span>
            ) : null}
            {isHost && screenShareRequestCount > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--meet-primary-strong)] px-1.5 text-[10px] text-white">
                {screenShareRequestCount}
              </span>
            ) : null}
          </Button>
          <Button size="sm" variant="secondary" onClick={handleCopyLink}>
            {copied ? (
              <Check className="h-4 w-4 text-[var(--meet-success)]" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copy link
          </Button>
          {isHost ? (
            <Button size="sm" variant="danger" onClick={onEndMeeting}>
              <XCircle className="h-4 w-4" />
              End for all
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={handleLeaveClick}>
            <PhoneOff className="h-4 w-4" />
            Leave
          </Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="relative min-w-0 flex-1">
          <VideoConference />
          <ScreenShareHighlighterOverlay
            localIdentity={localIdentity}
            authorName={localName}
          />
          <WhiteboardPanel
            open={whiteboardOpen}
            onClose={() => setWhiteboardOpen(false)}
            localIdentity={localIdentity}
            authorName={localName}
            isHost={isHost}
          />
          <MeetingToasts toasts={toasts} onDismiss={dismissToast} />
        </div>
        <ParticipantsSidebar
          meetingCode={meetingCode}
          isHost={isHost}
          hostIdentity={hostIdentity}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onWaitingCountChange={setWaitingCount}
          onRecordingRequestCountChange={setRecordingRequestCount}
          onScreenShareRequestCountChange={setScreenShareRequestCount}
        />
      </div>

      <RoomEventBridge onToast={pushToast} />
      </div>
        </ScreenShareHighlighterProvider>
        </WhiteboardSyncProvider>
        </HandRaiseProvider>
      </ScreenShareSyncProvider>
    </RecordingSyncProvider>
  );
}

export function MeetingRoom({
  token,
  serverUrl,
  meetingTitle,
  meetingCode,
  isHost,
  hostIdentity,
  admitToken,
  identity,
  recordingPermission,
  screenSharePermission,
  onLeave,
  onEndMeeting,
}: MeetingRoomProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectKey, setConnectKey] = useState(0);

  const permissionBlocked = connectionError
    ? isPermissionError(connectionError)
    : false;

  const handleError = useCallback((error: Error) => {
    setConnectionError(
      error.message || "Could not connect to the video server.",
    );
  }, []);

  const handleDisconnected = useCallback(() => {
    setConnectionError((prev) =>
      prev ??
      "Disconnected from the meeting. The video connection closed unexpectedly.",
    );
  }, []);

  function handleRetry() {
    setConnectionError(null);
    setConnectKey((k) => k + 1);
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--meet-bg)]">
      <div className="relative flex-1 overflow-hidden">
        {connectionError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--meet-bg)]/95 p-6">
            <div className="max-w-md rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-8 text-center">
              <AlertCircle className="mx-auto h-10 w-10 text-[var(--meet-danger)]" />
              <h2 className="mt-4 text-lg font-medium text-[var(--meet-text)]">
                {permissionBlocked
                  ? "Camera or microphone blocked"
                  : "Connection failed"}
              </h2>
              <p className="mt-2 text-sm text-[var(--meet-text-muted)]">
                {permissionBlocked
                  ? "Chrome needs permission to use your camera and microphone for the call."
                  : connectionError}
              </p>
              {permissionBlocked ? (
                <ol className="mt-4 space-y-2 text-left text-xs text-[var(--meet-text-muted)]">
                  <li>1. Click the lock / camera icon in the address bar</li>
                  <li>2. Allow Camera and Microphone for localhost</li>
                  <li>3. Click Try again</li>
                </ol>
              ) : (
                <p className="mt-4 text-xs text-[var(--meet-text-muted)]">
                  If LiveKit is not running, start it with:{" "}
                  <code className="rounded bg-[var(--meet-bg)] px-1.5 py-0.5">
                    docker compose up -d
                  </code>
                </p>
              )}
              <div className="mt-6 flex justify-center gap-3">
                <Button onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
                <Button variant="secondary" onClick={onLeave}>
                  Back to dashboard
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        <LiveKitRoom
          key={connectKey}
          video={HD_VIDEO_CAPTURE}
          audio
          token={token}
          serverUrl={serverUrl}
          connect
          options={HD_ROOM_OPTIONS}
          onError={handleError}
          onDisconnected={handleDisconnected}
          data-lk-theme="default"
          style={{ height: "100%" }}
        >
          <MeetingChrome
            meetingTitle={meetingTitle}
            meetingCode={meetingCode}
            isHost={isHost}
            hostIdentity={hostIdentity}
            admitToken={admitToken}
            identity={identity}
            recordingPermission={recordingPermission}
            screenSharePermission={screenSharePermission}
            onLeave={onLeave}
            onEndMeeting={onEndMeeting}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
