import { AccessToken } from "livekit-server-sdk";

export function livekitUrl() {
  return process.env.LIVEKIT_URL ?? "ws://localhost:7880";
}

export async function createLiveKitToken(input: {
  roomName: string;
  identity: string;
  displayName: string;
  isHost: boolean;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY ?? "devkey";
  const apiSecret = process.env.LIVEKIT_API_SECRET ?? "secret";
  const ttl = Number(process.env.LIVEKIT_TOKEN_TTL ?? 86400);

  const token = new AccessToken(apiKey, apiSecret, {
    identity: input.identity,
    name: input.displayName,
    ttl,
  });
  token.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: input.isHost,
    roomCreate: input.isHost,
  });
  return token.toJwt();
}
