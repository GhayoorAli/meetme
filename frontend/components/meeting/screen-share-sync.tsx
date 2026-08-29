"use client";

import {
  decodeScreenShareMessage,
  publishScreenShareMessage,
  SCREEN_SHARE_TOPIC,
  type ScreenShareMessage,
} from "@/lib/screen-share-messages";
import type { ScreenSharePermissionStatus } from "@/types";
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

type ScreenShareSyncContextValue = {
  permission: ScreenSharePermissionStatus;
  setPermission: (status: ScreenSharePermissionStatus) => void;
  activeSharers: Map<string, string>;
  publishScreenShareEvent: (message: ScreenShareMessage) => Promise<void>;
};

const ScreenShareSyncContext = createContext<ScreenShareSyncContextValue | null>(
  null,
);

export function useScreenShareSync() {
  const ctx = useContext(ScreenShareSyncContext);
  if (!ctx) {
    throw new Error("useScreenShareSync must be used within ScreenShareSyncProvider");
  }
  return ctx;
}

export function ScreenShareSyncProvider({
  children,
  localIdentity,
  initialPermission,
  onToast,
}: {
  children: ReactNode;
  localIdentity: string;
  initialPermission: ScreenSharePermissionStatus;
  onToast: (message: string, tone?: "info" | "success" | "warning") => void;
}) {
  const room = useRoomContext();
  const [permission, setPermission] =
    useState<ScreenSharePermissionStatus>(initialPermission);
  const [activeSharers, setActiveSharers] = useState<Map<string, string>>(
    () => new Map(),
  );
  const permissionRef = useRef(initialPermission);

  useEffect(() => {
    setPermission(initialPermission);
    permissionRef.current = initialPermission;
  }, [initialPermission]);

  const publishScreenShareEvent = useCallback(
    async (message: ScreenShareMessage) => {
      await publishScreenShareMessage(room, message);
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
      if (topic !== SCREEN_SHARE_TOPIC) return;
      let message: ScreenShareMessage;
      try {
        message = decodeScreenShareMessage(payload);
      } catch {
        return;
      }
      const senderName = message.name || participant?.identity || "Someone";

      switch (message.type) {
        case "screen_share_approved":
          if (message.identity === localIdentity && permissionRef.current !== "approved") {
            permissionRef.current = "approved";
            setPermission("approved");
            onToast("The host approved your screen share request.", "success");
          }
          break;
        case "screen_share_denied":
          if (message.identity === localIdentity && permissionRef.current !== "denied") {
            permissionRef.current = "denied";
            setPermission("denied");
            onToast("The host denied your screen share request.", "warning");
          }
          break;
        case "screen_share_started":
          setActiveSharers((prev) => {
            const next = new Map(prev);
            next.set(message.identity, senderName);
            return next;
          });
          if (message.identity !== localIdentity) {
            onToast(`${senderName} is sharing their screen`, "info");
          }
          break;
        case "screen_share_stopped":
          setActiveSharers((prev) => {
            const next = new Map(prev);
            next.delete(message.identity);
            return next;
          });
          break;
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, localIdentity, onToast]);

  return (
    <ScreenShareSyncContext.Provider
      value={{
        permission,
        setPermission: (status) => {
          permissionRef.current = status;
          setPermission(status);
        },
        activeSharers,
        publishScreenShareEvent,
      }}
    >
      {children}
    </ScreenShareSyncContext.Provider>
  );
}
