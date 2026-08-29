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

export async function publishHandRaiseMessage(
  room: import("livekit-client").Room,
  message: HandRaiseMessage,
): Promise<void> {
  const data = encodeHandRaiseMessage(message);
  await room.localParticipant.publishData(data as Uint8Array<ArrayBuffer>, {
    reliable: true,
    topic: HAND_RAISE_TOPIC,
  });
}
