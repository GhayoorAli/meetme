"use client";

import {
  decodeScreenShareHighlighterMessage,
  publishScreenShareHighlighterMessage,
  SCREEN_SHARE_HIGHLIGHTER_TOPIC,
  type HighlightStroke,
} from "@/lib/screen-share-highlighter-messages";
import { useRoomContext, useTracks } from "@livekit/components-react";
import { RoomEvent, Track } from "livekit-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ScreenShareHighlighterContextValue = {
  strokes: HighlightStroke[];
  isScreenSharing: boolean;
  sharerName: string | null;
  highlightMode: boolean;
  setHighlightMode: (enabled: boolean) => void;
  addStroke: (stroke: HighlightStroke) => Promise<void>;
  undoOwnStroke: (strokeId: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

const ScreenShareHighlighterContext =
  createContext<ScreenShareHighlighterContextValue | null>(null);

export function useScreenShareHighlighter() {
  const ctx = useContext(ScreenShareHighlighterContext);
  if (!ctx) {
    throw new Error(
      "useScreenShareHighlighter must be used within ScreenShareHighlighterProvider",
    );
  }
  return ctx;
}

export function ScreenShareHighlighterProvider({
  children,
  localIdentity,
}: {
  children: ReactNode;
  localIdentity: string;
}) {
  const room = useRoomContext();
  const [strokes, setStrokes] = useState<HighlightStroke[]>([]);
  const [highlightMode, setHighlightMode] = useState(false);
  const strokesRef = useRef(strokes);
  const prevSharerRef = useRef<string | null>(null);

  const screenShareTracks = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: true },
  );

  const activeTrack = screenShareTracks[0];
  const isScreenSharing = screenShareTracks.length > 0;
  const sharerName =
    activeTrack?.participant.name ||
    activeTrack?.participant.identity ||
    null;
  const sharerIdentity = activeTrack?.participant.identity ?? null;

  useEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  const clearAllLocal = useCallback(() => {
    setStrokes([]);
    setHighlightMode(false);
  }, []);

  const broadcastClear = useCallback(async () => {
    clearAllLocal();
    await publishScreenShareHighlighterMessage(room, { type: "highlight_clear" });
  }, [room, clearAllLocal]);

  useEffect(() => {
    if (!isScreenSharing) {
      if (strokesRef.current.length > 0) {
        void broadcastClear();
      } else {
        setHighlightMode(false);
      }
      prevSharerRef.current = null;
      return;
    }

    if (
      prevSharerRef.current &&
      sharerIdentity &&
      prevSharerRef.current !== sharerIdentity
    ) {
      void broadcastClear();
    }
    prevSharerRef.current = sharerIdentity;
  }, [isScreenSharing, sharerIdentity, broadcastClear]);

  useEffect(() => {
    const onDataReceived = (
      payload: Uint8Array,
      _participant?: { identity: string },
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== SCREEN_SHARE_HIGHLIGHTER_TOPIC) return;
      try {
        const message = decodeScreenShareHighlighterMessage(payload);
        switch (message.type) {
          case "highlight_stroke":
            setStrokes((prev) => {
              if (prev.some((s) => s.id === message.stroke.id)) return prev;
              return [...prev, message.stroke];
            });
            break;
          case "highlight_undo":
            setStrokes((prev) =>
              prev.filter((s) => s.id !== message.strokeId),
            );
            break;
          case "highlight_clear":
            setStrokes([]);
            setHighlightMode(false);
            break;
          case "sync_request":
            publishScreenShareHighlighterMessage(room, {
              type: "sync_full",
              strokes: strokesRef.current,
            }).catch(() => {});
            break;
          case "sync_full":
            setStrokes(message.strokes);
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
  }, [room]);

  useEffect(() => {
    if (!highlightMode || !isScreenSharing) return;
    void publishScreenShareHighlighterMessage(room, { type: "sync_request" });
  }, [highlightMode, isScreenSharing, room]);

  const addStroke = useCallback(
    async (stroke: HighlightStroke) => {
      setStrokes((prev) => {
        if (prev.some((s) => s.id === stroke.id)) return prev;
        return [...prev, stroke];
      });
      await publishScreenShareHighlighterMessage(room, {
        type: "highlight_stroke",
        stroke,
      });
    },
    [room],
  );

  const undoOwnStroke = useCallback(
    async (strokeId: string) => {
      const stroke = strokes.find((s) => s.id === strokeId);
      if (!stroke || stroke.authorIdentity !== localIdentity) return;
      setStrokes((prev) => prev.filter((s) => s.id !== strokeId));
      await publishScreenShareHighlighterMessage(room, {
        type: "highlight_undo",
        strokeId,
      });
    },
    [strokes, localIdentity, room],
  );

  const clearAll = useCallback(async () => {
    await broadcastClear();
  }, [broadcastClear]);

  return (
    <ScreenShareHighlighterContext.Provider
      value={{
        strokes,
        isScreenSharing,
        sharerName,
        highlightMode,
        setHighlightMode,
        addStroke,
        undoOwnStroke,
        clearAll,
      }}
    >
      {children}
    </ScreenShareHighlighterContext.Provider>
  );
}
