"use client";

import {
  decodeRecordingMessage,
  publishRecordingMessage,
  RECORDING_TOPIC,
  type RecordingMessage,
} from "@/lib/recording-messages";
import type { RecordingPermissionStatus } from "@/types";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type RecordingSyncContextValue = {
  permission: RecordingPermissionStatus;
  setPermission: (status: RecordingPermissionStatus) => void;
  activeRecorders: Map<string, string>;
  publishRecordingEvent: (message: RecordingMessage) => Promise<void>;
};

const RecordingSyncContext = createContext<RecordingSyncContextValue | null>(
  null,
);

export function useRecordingSync() {
  const ctx = useContext(RecordingSyncContext);
  if (!ctx) {
    throw new Error("useRecordingSync must be used within RecordingSyncProvider");
  }
  return ctx;
}

type RecordingSyncProviderProps = {
  children: ReactNode;
  localIdentity: string;
  localName: string;
  initialPermission: RecordingPermissionStatus;
  onToast: (message: string, tone?: "info" | "success" | "warning") => void;
};

export function RecordingSyncProvider({
  children,
  localIdentity,
  localName,
  initialPermission,
  onToast,
}: RecordingSyncProviderProps) {
  const room = useRoomContext();
  const [permission, setPermission] =
    useState<RecordingPermissionStatus>(initialPermission);
  const [activeRecorders, setActiveRecorders] = useState<Map<string, string>>(
    () => new Map(),
  );
  const permissionRef = useRef(initialPermission);

  useEffect(() => {
    setPermission(initialPermission);
    permissionRef.current = initialPermission;
  }, [initialPermission]);

  const publishRecordingEvent = useCallback(
    async (message: RecordingMessage) => {
      await publishRecordingMessage(room, message);
    },
    [room],
  );

  useEffect(() => {
    const onDataReceived = (
      payload: Uint8Array,
      participant?: { identity: string },
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== RECORDING_TOPIC) return;

      let message: RecordingMessage;
      try {
        message = decodeRecordingMessage(payload);
      } catch {
        return;
      }

      const senderName = message.name || participant?.identity || "Someone";

      switch (message.type) {
        case "recording_approved":
          if (message.identity === localIdentity) {
            if (permissionRef.current !== "approved") {
              permissionRef.current = "approved";
              setPermission("approved");
              onToast(
                "The host approved your recording request. You can now record.",
                "success",
              );
            }
          }
          break;

        case "recording_denied":
          if (message.identity === localIdentity) {
            if (permissionRef.current !== "denied") {
              permissionRef.current = "denied";
              setPermission("denied");
              onToast("The host denied your recording request.", "warning");
            }
          }
          break;

        case "recording_started":
          setActiveRecorders((prev) => {
            const next = new Map(prev);
            next.set(message.identity, senderName);
            return next;
          });
          if (message.identity !== localIdentity) {
            onToast(`${senderName} is recording this meeting`, "warning");
          }
          break;

        case "recording_stopped":
          setActiveRecorders((prev) => {
            const next = new Map(prev);
            next.delete(message.identity);
            return next;
          });
          if (message.identity !== localIdentity) {
            onToast(`${senderName} stopped recording`, "info");
          }
          break;
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, localIdentity, onToast]);

  return (
    <RecordingSyncContext.Provider
      value={{
        permission,
        setPermission: (status) => {
          permissionRef.current = status;
          setPermission(status);
        },
        activeRecorders,
        publishRecordingEvent,
      }}
    >
      {children}
      <RecordingBanner activeRecorders={activeRecorders} localName={localName} />
    </RecordingSyncContext.Provider>
  );
}

function RecordingBanner({
  activeRecorders,
  localName,
}: {
  activeRecorders: Map<string, string>;
  localName: string;
}) {
  if (activeRecorders.size === 0) return null;

  const names = [...activeRecorders.values()];
  const label =
    names.length === 1
      ? `${names[0] === localName ? "You are" : `${names[0]} is`} recording`
      : `${names.length} participants are recording`;

  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full border border-[var(--meet-danger)]/50 bg-[var(--meet-danger)]/15 px-4 py-1.5 text-sm text-[var(--meet-text)] shadow-lg backdrop-blur-sm">
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-[var(--meet-danger)]" />
        {label}
      </div>
    </div>
  );
}
