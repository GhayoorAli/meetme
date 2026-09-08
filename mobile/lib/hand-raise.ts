export const HAND_RAISE_TOPIC = "meetme-hand-raise";

export type HandRaiseMessage =
  | { type: "hand_raised"; identity: string; name: string }
  | { type: "hand_lowered"; identity: string; name: string };

export function encodeHandRaiseMessage(message: HandRaiseMessage): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(message));
}

export function decodeHandRaiseMessage(payload: Uint8Array): HandRaiseMessage {
  return JSON.parse(new TextDecoder().decode(payload)) as HandRaiseMessage;
}
