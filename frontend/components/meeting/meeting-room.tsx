"use client";

import "@livekit/components-styles";
import "./meeting-room.css";
import { Button } from "@/components/ui/button";
import { ParticipantsSidebar } from "@/components/meeting/participants-sidebar";
import { RecordingControls } from "@/components/meeting/recording-controls";
import { RecordingSyncProvider } from "@/components/meeting/recording-sync";
import { ScreenShareSyncProvider } from "@/components/meeting/screen-share-sync";
import { HandRaiseProvider } from "@/components/meeting/hand-raise-sync";
import { HandRaiseControls } from "@/components/meeting/hand-raise-controls";
import { MeetingMediaControls } from "@/components/meeting/meeting-media-controls";
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
  RoomAudioRenderer,
  useRoomContext,
} from "@livekit/components-react";
import { MeetingDockButton } from "@/components/meeting/meeting-dock-button";
import { MeetingVideoStage } from "@/components/meeting/meeting-video-stage";
import { RoomEvent, type RemoteParticipant } from "livekit-client";
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
    const onJoined = (participant: RemoteParticipant) => {
      onToast(`${participant.name || participant.identity} joined the meeting`);
    };
    const onLeft = (participant: RemoteParticipant) => {
      onToast(
        `${participant.name || participant.identity} left the meeting`,
        "warning",
      );
    };

    room.on(RoomEvent.ParticipantConnected, onJoined);
    room.on(RoomEvent.ParticipantDisconnected, onLeft);

    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoined);
      room.off(RoomEvent.ParticipantDisconnected, onLeft);
    };
  }, [room, onToast]);

  return null;
}

function MeetingTimer() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  const stamp =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return <span className="meet-topbar-timer">{stamp}</span>;
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
    // Navigate/leave first so LiveKit disconnect is treated as intentional.
    onLeave();
    try {
      await api.leaveMeeting(meetingCode, {
        admit_token: admitToken,
        identity,
      });
    } catch {
      // Best-effort; UI already left.
    }
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
      <div className="meet-room-shell">
        <div className="meet-room-stage">
          <MeetingVideoStage />
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

        <header className="meet-topbar">
          <div className="meet-topbar-title">
            <p>{meetingTitle}</p>
            <div className="meet-topbar-meta">
              <span className="meet-live-dot" />
              <span className="font-mono tracking-wide">{meetingCode}</span>
            </div>
          </div>
          <MeetingTimer />
          <div className="flex items-center gap-2">
            {isHost ? <span className="meet-host-chip">Host</span> : null}
            <button type="button" className="meet-ghost-btn" onClick={handleCopyLink}>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-[var(--meet-success)]" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Invite"}</span>
            </button>
          </div>
        </header>

        <div className="meet-dock">
          <div className="meet-dock-inner">
            <MeetingMediaControls />
            <ScreenShareControls
              meetingCode={meetingCode}
              isHost={isHost}
              admitToken={admitToken}
              identity={identity}
              onToast={pushToast}
            />
            <HandRaiseControls />
            <ScreenShareHighlighterControls disabled={whiteboardOpen} />
            <MeetingDockButton
              title={whiteboardOpen ? "Close whiteboard" : "Whiteboard"}
              active={whiteboardOpen}
              onClick={() => setWhiteboardOpen((v) => !v)}
            >
              <PenLine className="h-4 w-4" />
            </MeetingDockButton>
            <RecordingControls
              meetingCode={meetingCode}
              isHost={isHost}
              admitToken={admitToken}
              identity={identity}
              onToast={pushToast}
            />
            <MeetingDockButton
              title="People"
              active={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              badge={
                isHost &&
                waitingCount + recordingRequestCount + screenShareRequestCount > 0
                  ? waitingCount + recordingRequestCount + screenShareRequestCount
                  : undefined
              }
            >
              <Users className="h-4 w-4" />
            </MeetingDockButton>
            {isHost ? (
              <button type="button" className="meet-end-btn" onClick={onEndMeeting}>
                <XCircle className="h-4 w-4" />
                End for all
              </button>
            ) : null}
            <button
              type="button"
              className="meet-leave-btn"
              title="Leave"
              onClick={handleLeaveClick}
            >
              <PhoneOff className="h-4 w-4" />
              <span className="meet-leave-label">Leave</span>
            </button>
          </div>
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
  const intentionalLeaveRef = useRef(false);

  const permissionBlocked = connectionError
    ? isPermissionError(connectionError)
    : false;

  const leaveIntentionally = useCallback(() => {
    intentionalLeaveRef.current = true;
    setConnectionError(null);
    onLeave();
  }, [onLeave]);

  const endMeetingIntentionally = useCallback(() => {
    intentionalLeaveRef.current = true;
    setConnectionError(null);
    onEndMeeting();
  }, [onEndMeeting]);

  const handleError = useCallback((error: Error) => {
    if (intentionalLeaveRef.current) return;
    setConnectionError(
      error.message || "Could not connect to the video server.",
    );
  }, []);

  const handleDisconnected = useCallback(() => {
    // Leave / End for all disconnect LiveKit on purpose — go home, don't show error.
    if (intentionalLeaveRef.current) return;
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
    <div className="meet-room">
      <div className="relative flex-1 overflow-hidden" style={{ height: "100%" }}>
        {connectionError ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-6">
            <div className="meet-error-card">
              <AlertCircle className="mx-auto h-10 w-10 text-[var(--meet-danger)]" />
              <h2 className="mt-4 text-lg font-medium text-white">
                {permissionBlocked
                  ? "Camera or microphone blocked"
                  : "Connection failed"}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {permissionBlocked
                  ? "Chrome needs permission to use your camera and microphone for the call."
                  : connectionError}
              </p>
              {permissionBlocked ? (
                <ol className="mt-4 space-y-2 text-left text-xs text-white/55">
                  <li>1. Click the lock / camera icon in the address bar</li>
                  <li>2. Allow Camera and Microphone for this site</li>
                  <li>3. Click Try again</li>
                </ol>
              ) : process.env.NODE_ENV === "development" ? (
                <p className="mt-4 text-xs text-white/55">
                  If LiveKit is not running, start it with:{" "}
                  <code className="rounded bg-white/10 px-1.5 py-0.5">
                    docker compose up -d
                  </code>
                </p>
              ) : null}
              <div className="mt-6 flex justify-center gap-3">
                <Button onClick={handleRetry}>
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
                <Button variant="secondary" onClick={leaveIntentionally}>
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
            onLeave={leaveIntentionally}
            onEndMeeting={endMeetingIntentionally}
          />
          <RoomAudioRenderer />
        </LiveKitRoom>
      </div>
    </div>
  );
}
