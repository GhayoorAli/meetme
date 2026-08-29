"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  decodeHandRaiseMessage,
  HAND_RAISE_TOPIC,
  publishHandRaiseMessage,
} from "@/lib/hand-raise-messages";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";

type HandRaiseContextValue = {
  raisedHands: Map<string, string>;
  isHandRaised: boolean;
  toggleHandRaise: () => Promise<void>;
};

const HandRaiseContext = createContext<HandRaiseContextValue | null>(null);

export function useHandRaise() {
  const ctx = useContext(HandRaiseContext);
  if (!ctx) {
    throw new Error("useHandRaise must be used within HandRaiseProvider");
  }
  return ctx;
}

export function HandRaiseProvider({
  children,
  localIdentity,
  localName,
  onToast,
}: {
  children: ReactNode;
  localIdentity: string;
  localName: string;
  onToast: (message: string, tone?: "info" | "success" | "warning") => void;
}) {
  const room = useRoomContext();
  const [raisedHands, setRaisedHands] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [isHandRaised, setIsHandRaised] = useState(false);

  useEffect(() => {
    const onDataReceived = (
      payload: Uint8Array,
      _participant?: { identity: string },
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic !== HAND_RAISE_TOPIC) return;
      try {
        const message = decodeHandRaiseMessage(payload);
        if (message.type === "hand_raised") {
          setRaisedHands((prev) => {
            const next = new Map(prev);
            next.set(message.identity, message.name);
            return next;
          });
          if (message.identity !== localIdentity) {
            onToast(`${message.name} raised their hand`, "info");
          }
        } else {
          setRaisedHands((prev) => {
            const next = new Map(prev);
            next.delete(message.identity);
            return next;
          });
          if (message.identity !== localIdentity) {
            onToast(`${message.name} lowered their hand`, "info");
          }
        }
      } catch {
        // ignore
      }
    };

    room.on(RoomEvent.DataReceived, onDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, onDataReceived);
    };
  }, [room, localIdentity, onToast]);

  const toggleHandRaise = useCallback(async () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    await publishHandRaiseMessage(room, {
      type: next ? "hand_raised" : "hand_lowered",
      identity: localIdentity,
      name: localName,
    });
    setRaisedHands((prev) => {
      const map = new Map(prev);
      if (next) map.set(localIdentity, localName);
      else map.delete(localIdentity);
      return map;
    });
    onToast(next ? "Hand raised" : "Hand lowered", "info");
  }, [isHandRaised, room, localIdentity, localName, onToast]);

  return (
    <HandRaiseContext.Provider
      value={{ raisedHands, isHandRaised, toggleHandRaise }}
    >
      {children}
    </HandRaiseContext.Provider>
  );
}
