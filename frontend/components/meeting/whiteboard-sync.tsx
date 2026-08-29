"use client";

import {
  decodeWhiteboardMessage,
  publishWhiteboardMessage,
  WHITEBOARD_TOPIC,
  type WhiteboardOwner,
  type WhiteboardStroke,
} from "@/lib/whiteboard-messages";
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

type WhiteboardSyncContextValue = {
  strokes: WhiteboardStroke[];
  owner: WhiteboardOwner | null;
  canEdit: boolean;
  handoverTo: (target: WhiteboardOwner) => Promise<void>;
  revokeEditor: () => Promise<void>;
  addStroke: (stroke: WhiteboardStroke) => Promise<void>;
  undoStroke: (strokeId: string) => Promise<void>;
  clearOwnStrokes: () => Promise<void>;
  requestSync: () => Promise<void>;
};

const WhiteboardSyncContext = createContext<WhiteboardSyncContextValue | null>(
  null,
);

export function useWhiteboardSync() {
  const ctx = useContext(WhiteboardSyncContext);
  if (!ctx) {
    throw new Error("useWhiteboardSync must be used within WhiteboardSyncProvider");
  }
  return ctx;
}

export function WhiteboardSyncProvider({
  children,
  localIdentity,
  localName,
  isHost,
  onToast,
}: {
  children: ReactNode;
  localIdentity: string;
  localName: string;
  isHost: boolean;
  onToast: (message: string, tone?: "info" | "success" | "warning") => void;
}) {
  const room = useRoomContext();
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [owner, setOwner] = useState<WhiteboardOwner | null>(null);
  const strokesRef = useRef(strokes);
  const ownerRef = useRef(owner);
  const onToastRef = useRef(onToast);

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  useEffect(() => {
    ownerRef.current = owner;
  }, [owner]);

  useEffect(() => {
    onToastRef.current = onToast;
  }, [onToast]);

  const queueToast = useCallback(
    (message: string, tone?: "info" | "success" | "warning") => {
      queueMicrotask(() => onToastRef.current(message, tone));
    },
    [],
  );

  const isAssignedEditor = owner?.identity === localIdentity;
  const canEdit = isHost || isAssignedEditor;

  const requestSync = useCallback(async () => {
    await publishWhiteboardMessage(room, { type: "sync_request" });
  }, [room]);

  const respondSync = useCallback(
    (currentStrokes: WhiteboardStroke[], currentOwner: WhiteboardOwner | null) => {
      publishWhiteboardMessage(room, {
        type: "sync_full",
        strokes: currentStrokes,
        owner: currentOwner,
      }).catch(() => {});
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
      if (topic !== WHITEBOARD_TOPIC) return;
      try {
        const message = decodeWhiteboardMessage(payload);
        const fromSelf = participant?.identity === localIdentity;

        switch (message.type) {
          case "stroke":
            setStrokes((prev) => {
              if (prev.some((s) => s.id === message.stroke.id)) return prev;
              return [...prev, message.stroke];
            });
            break;
          case "undo":
            setStrokes((prev) =>
              prev.filter((s) => s.id !== message.strokeId),
            );
            break;
          case "clear_own":
            setStrokes((prev) =>
              prev.filter((s) => s.authorIdentity !== message.authorIdentity),
            );
            break;
          case "handover":
            setOwner(message.owner);
            if (!fromSelf) {
              queueToast(
                `Admin assigned the whiteboard to ${message.owner.name}`,
                "info",
              );
            }
            break;
          case "revoke_editor":
            setOwner(null);
            if (!fromSelf) {
              queueToast("Admin removed whiteboard editor access.", "info");
            }
            break;
          case "sync_request":
            if (isHost) {
              respondSync(strokesRef.current, ownerRef.current);
            }
            break;
          case "sync_full":
            setStrokes((prev) => {
              if (
                prev.length > 0 &&
                message.strokes.length === 0 &&
                isHost
              ) {
                return prev;
              }
              return message.strokes;
            });
            if (message.owner !== undefined) {
              setOwner(message.owner);
            }
            break;
          case "claim_owner":
            // Legacy message — ignore; admin assigns the editor now.
            break;
        }
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, localIdentity, isHost, queueToast, respondSync]);

  const handoverTo = useCallback(
    async (target: WhiteboardOwner) => {
      if (!isHost) return;
      if (target.identity === owner?.identity) return;
      setOwner(target);
      await publishWhiteboardMessage(room, {
        type: "handover",
        owner: target,
      });
      queueToast(`Whiteboard assigned to ${target.name}.`, "success");
    },
    [isHost, owner?.identity, room, queueToast],
  );

  const revokeEditor = useCallback(async () => {
    if (!isHost || !owner) return;
    const editorName = owner.name;
    setOwner(null);
    await publishWhiteboardMessage(room, { type: "revoke_editor" });
    queueToast(`Removed whiteboard access from ${editorName}.`, "info");
  }, [isHost, owner, room, queueToast]);

  const addStroke = useCallback(
    async (stroke: WhiteboardStroke) => {
      if (!canEdit) return;
      setStrokes((prev) => {
        if (prev.some((s) => s.id === stroke.id)) return prev;
        return [...prev, stroke];
      });
      await publishWhiteboardMessage(room, { type: "stroke", stroke });
    },
    [canEdit, room],
  );

  const undoStroke = useCallback(
    async (strokeId: string) => {
      if (!canEdit) return;
      const stroke = strokes.find((s) => s.id === strokeId);
      if (!stroke || stroke.authorIdentity !== localIdentity) return;
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
      await publishWhiteboardMessage(room, {
        type: "undo",
        strokeId,
        authorIdentity: localIdentity,
      });
    },
    [canEdit, strokes, localIdentity, room],
  );

  const clearOwnStrokes = useCallback(async () => {
    if (!canEdit) return;
    setStrokes((prev) =>
      prev.filter((s) => s.authorIdentity !== localIdentity),
    );
    await publishWhiteboardMessage(room, {
      type: "clear_own",
      authorIdentity: localIdentity,
    });
    queueToast("Your whiteboard strokes cleared.", "info");
  }, [canEdit, localIdentity, room, queueToast]);

  return (
    <WhiteboardSyncContext.Provider
      value={{
        strokes,
        owner,
        canEdit,
        handoverTo,
        revokeEditor,
        addStroke,
        undoStroke,
        clearOwnStrokes,
        requestSync,
      }}
    >
      {children}
    </WhiteboardSyncContext.Provider>
  );
}
