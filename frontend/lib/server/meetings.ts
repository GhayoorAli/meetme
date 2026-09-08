import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/server/db";
import { generateMeetingCode, generateRoomName, randomToken } from "@/lib/server/codes";
import { createLiveKitToken, livekitUrl } from "@/lib/server/livekit";
import { serializeMeeting, serializeParticipant } from "@/lib/server/serialize";
import type { SessionUser } from "@/lib/server/auth";
import type { JoinMeetingResponse } from "@/types";
import type { Meeting, MeetingParticipant, PermissionStatus, User as DbUser } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function hostTokenFrom(input: { host_token?: string; hostToken?: string }) {
  return input.host_token || input.hostToken || undefined;
}

export function isHostOf(
  meeting: Meeting,
  user: SessionUser | null,
  hostToken?: string,
) {
  if (user && meeting.hostId === user.id) return true;
  return Boolean(
    hostToken && meeting.guestHostToken && hostToken === meeting.guestHostToken,
  );
}

export async function findMeetingByCode(code: string) {
  return prisma.meeting.findUnique({
    where: { code },
    include: { host: true },
  });
}

async function uniqueCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = generateMeetingCode();
    const exists = await prisma.meeting.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new ApiError("Could not generate a meeting code.", 500);
}

export async function listHostMeetings(userId: number) {
  const meetings = await prisma.meeting.findMany({
    where: { hostId: userId },
    include: {
      host: true,
      _count: {
        select: {
          participants: {
            where: { status: "admitted", leftAt: null },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return meetings.map(serializeMeeting);
}

export async function createMeeting(user: SessionUser, title?: string) {
  const meeting = await prisma.meeting.create({
    data: {
      hostId: user.id,
      code: await uniqueCode(),
      title: title?.trim() || `${user.name}'s meeting`,
      livekitRoom: generateRoomName(),
      status: "active",
      waitingRoomEnabled: true,
      startedAt: new Date(),
    },
    include: { host: true },
  });
  return serializeMeeting(meeting);
}

export async function createGuestMeeting(displayName: string, title?: string) {
  const hostToken = randomToken(24);
  const meeting = await prisma.meeting.create({
    data: {
      hostId: null,
      guestHostToken: hostToken,
      code: await uniqueCode(),
      title: title?.trim() || `${displayName}'s meeting`,
      livekitRoom: generateRoomName(),
      status: "active",
      waitingRoomEnabled: true,
      startedAt: new Date(),
    },
  });
  return { meeting: serializeMeeting(meeting), host_token: hostToken };
}

async function admittedPayload(
  meeting: Meeting & { host?: DbUser | null },
  participant: MeetingParticipant,
  isHost: boolean,
): Promise<JoinMeetingResponse> {
  const token = await createLiveKitToken({
    roomName: meeting.livekitRoom,
    identity: participant.identity,
    displayName: participant.displayName,
    isHost,
  });

  const host = await prisma.meetingParticipant.findFirst({
    where: { meetingId: meeting.id, role: "host", status: "admitted" },
    orderBy: { joinedAt: "desc" },
  });

  const full = await prisma.meeting.findUniqueOrThrow({
    where: { id: meeting.id },
    include: { host: true },
  });

  return {
    status: "admitted",
    meeting: serializeMeeting(full),
    participant: serializeParticipant(participant, {
      admit_token: participant.admitToken,
      identity: participant.identity,
    }),
    host_identity: host?.identity,
    livekit: {
      url: livekitUrl(),
      token,
      room: meeting.livekitRoom,
    },
  };
}

export async function joinMeeting(
  code: string,
  input: {
    display_name?: string;
    host_token?: string;
    admit_token?: string;
  },
  user: SessionUser | null,
): Promise<JoinMeetingResponse> {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  if (meeting.status !== "active") throw new ApiError("This meeting has ended.", 410);

  const hostToken = hostTokenFrom(input);
  const isHost = isHostOf(meeting, user, hostToken);
  const displayName = user?.name ?? input.display_name;
  if (!displayName) throw new ApiError("Display name is required.", 422);

  if (input.admit_token) {
    const existing = await prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, admitToken: input.admit_token },
    });
    if (existing) {
      if (existing.status === "denied") {
        return {
          status: "denied",
          message: "The host denied your request to join.",
          meeting: serializeMeeting(meeting),
          participant: serializeParticipant(existing),
        };
      }
      if (existing.status === "waiting") {
        return {
          status: "waiting",
          message: "Waiting for the host to admit you.",
          meeting: serializeMeeting(meeting),
          participant: serializeParticipant(existing, {
            admit_token: existing.admitToken,
          }),
        };
      }
      if (existing.status === "admitted") {
        return admittedPayload(meeting, existing, existing.role === "host");
      }
    }
  }

  if (user) {
    const existingAdmitted = await prisma.meetingParticipant.findFirst({
      where: { meetingId: meeting.id, userId: user.id, status: "admitted" },
      orderBy: { createdAt: "desc" },
    });
    if (existingAdmitted) {
      return admittedPayload(meeting, existingAdmitted, meeting.hostId === user.id);
    }
  }

  const identity = user ? `user_${user.id}` : `guest_${randomUUID()}`;
  const needsWaitingRoom = meeting.waitingRoomEnabled && !isHost;
  const status = needsWaitingRoom ? "waiting" : "admitted";

  const participant = await prisma.meetingParticipant.create({
    data: {
      meetingId: meeting.id,
      userId: user?.id,
      displayName,
      identity,
      role: isHost ? "host" : "guest",
      status,
      recordingPermission: isHost ? "approved" : "none",
      screenSharePermission: isHost ? "approved" : "none",
      admitToken: randomToken(24),
      joinedAt: status === "admitted" ? new Date() : null,
    },
  });

  if (needsWaitingRoom) {
    return {
      status: "waiting",
      message: "Waiting for the host to admit you.",
      meeting: serializeMeeting(meeting),
      participant: serializeParticipant(participant, {
        admit_token: participant.admitToken,
      }),
    };
  }

  return admittedPayload(meeting, participant, isHost);
}

export async function joinStatus(code: string, admitToken: string) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  if (!admitToken) throw new ApiError("Admit token is required.", 422);

  const participant = await prisma.meetingParticipant.findFirst({
    where: { meetingId: meeting.id, admitToken },
  });
  if (!participant) throw new ApiError("Join request not found.", 404);

  if (participant.status === "denied") {
    return {
      status: "denied" as const,
      message: "The host denied your request to join.",
      meeting: serializeMeeting(meeting),
      participant: serializeParticipant(participant),
    };
  }
  if (participant.status === "waiting") {
    return {
      status: "waiting" as const,
      message: "Still waiting for the host to admit you.",
      meeting: serializeMeeting(meeting),
      participant: serializeParticipant(participant),
    };
  }
  if (participant.status === "left") {
    return {
      status: "left" as const,
      message: "You have left this meeting.",
      meeting: serializeMeeting(meeting),
      participant: serializeParticipant(participant),
    };
  }
  return admittedPayload(meeting, participant, participant.role === "host");
}

export async function requireHost(
  meeting: Meeting,
  user: SessionUser | null,
  hostToken?: string,
) {
  if (!isHostOf(meeting, user, hostToken)) {
    throw new ApiError("Only the host can perform this action.", 403);
  }
}

export async function listWaiting(code: string, user: SessionUser | null, hostToken?: string) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const waiting = await prisma.meetingParticipant.findMany({
    where: { meetingId: meeting.id, status: "waiting" },
    orderBy: { createdAt: "desc" },
  });
  return waiting.map((row) => serializeParticipant(row));
}

export async function admitParticipant(
  code: string,
  participantId: number,
  user: SessionUser | null,
  hostToken?: string,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const participant = await prisma.meetingParticipant.findFirst({
    where: { id: participantId, meetingId: meeting.id },
  });
  if (!participant) throw new ApiError("Meeting not found.", 404);
  if (participant.status !== "waiting") {
    throw new ApiError("This participant is not waiting.", 422);
  }
  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: { status: "admitted", joinedAt: new Date() },
  });
  return serializeParticipant(updated);
}

export async function denyParticipant(
  code: string,
  participantId: number,
  user: SessionUser | null,
  hostToken?: string,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const participant = await prisma.meetingParticipant.findFirst({
    where: { id: participantId, meetingId: meeting.id },
  });
  if (!participant) throw new ApiError("Meeting not found.", 404);
  if (participant.status !== "waiting") {
    throw new ApiError("This participant is not waiting.", 422);
  }
  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: { status: "denied", leftAt: new Date() },
  });
  return serializeParticipant(updated);
}

export async function leaveMeeting(
  code: string,
  input: { admit_token?: string; identity?: string },
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);

  const participant = await prisma.meetingParticipant.findFirst({
    where: {
      meetingId: meeting.id,
      status: { in: ["waiting", "admitted"] },
      ...(input.admit_token
        ? { admitToken: input.admit_token }
        : input.identity
          ? { identity: input.identity }
          : { id: -1 }),
    },
    orderBy: { createdAt: "desc" },
  });

  if (participant) {
    await prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { status: "left", leftAt: new Date() },
    });
  }
}

export async function endMeeting(code: string, user: SessionUser | null, hostToken?: string) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "ended", endedAt: new Date() },
    include: { host: true },
  });
  await prisma.meetingParticipant.updateMany({
    where: { meetingId: meeting.id, status: { in: ["waiting", "admitted"] } },
    data: { status: "left", leftAt: new Date() },
  });
  return serializeMeeting(updated);
}

async function resolveParticipant(
  meetingId: number,
  input: { admit_token?: string; identity?: string },
  user: SessionUser | null,
) {
  return prisma.meetingParticipant.findFirst({
    where: {
      meetingId,
      ...(input.admit_token
        ? { admitToken: input.admit_token }
        : input.identity
          ? { identity: input.identity }
          : user
            ? { userId: user.id, status: { in: ["admitted", "waiting"] } }
            : { id: -1 }),
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestPermission(
  code: string,
  kind: "recording" | "screenShare",
  input: { admit_token?: string; identity?: string },
  user: SessionUser | null,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  const participant = await resolveParticipant(meeting.id, input, user);
  if (!participant) throw new ApiError("Participant not found.", 404);
  if (participant.role === "host") {
    throw new ApiError(
      kind === "recording"
        ? "Hosts can record without requesting permission."
        : "Hosts can share their screen without requesting permission.",
      422,
    );
  }
  if (participant.status !== "admitted") {
    throw new ApiError("You must be in the meeting to request this.", 422);
  }

  const field =
    kind === "recording" ? "recordingPermission" : "screenSharePermission";
  const current = participant[field] as PermissionStatus;
  if (current === "approved") {
    return {
      message:
        kind === "recording"
          ? "You already have permission to record."
          : "You already have permission to share your screen.",
      permission: current,
    };
  }
  if (current === "pending") {
    return {
      message:
        kind === "recording"
          ? "Your recording request is pending host approval."
          : "Your screen share request is pending host approval.",
      permission: current,
    };
  }

  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: { [field]: "pending" },
  });
  return {
    message:
      kind === "recording"
        ? "Recording permission requested. Waiting for host approval."
        : "Screen share permission requested. Waiting for host approval.",
    permission: updated[field],
  };
}

export async function permissionStatus(
  code: string,
  kind: "recording" | "screenShare",
  input: { admit_token?: string; identity?: string },
  user: SessionUser | null,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  const participant = await resolveParticipant(meeting.id, input, user);
  if (!participant) throw new ApiError("Participant not found.", 404);
  if (kind === "recording") {
    return {
      recording_permission: participant.recordingPermission,
      can_record: participant.recordingPermission === "approved",
    };
  }
  return {
    screen_share_permission: participant.screenSharePermission,
    can_share_screen: participant.screenSharePermission === "approved",
  };
}

export async function listPermissionRequests(
  code: string,
  kind: "recording" | "screenShare",
  user: SessionUser | null,
  hostToken?: string,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const rows = await prisma.meetingParticipant.findMany({
    where: {
      meetingId: meeting.id,
      status: "admitted",
      leftAt: null,
      ...(kind === "recording"
        ? { recordingPermission: "pending" }
        : { screenSharePermission: "pending" }),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => serializeParticipant(row));
}

export async function decidePermission(
  code: string,
  participantId: number,
  kind: "recording" | "screenShare",
  decision: "approved" | "denied",
  user: SessionUser | null,
  hostToken?: string,
) {
  const meeting = await findMeetingByCode(code);
  if (!meeting) throw new ApiError("Meeting not found.", 404);
  await requireHost(meeting, user, hostToken);
  const participant = await prisma.meetingParticipant.findFirst({
    where: { id: participantId, meetingId: meeting.id },
  });
  if (!participant) throw new ApiError("Meeting not found.", 404);
  const field =
    kind === "recording" ? "recordingPermission" : "screenSharePermission";
  if (participant[field] !== "pending") {
    throw new ApiError(
      kind === "recording"
        ? "This participant has not requested recording."
        : "This participant has not requested screen share.",
      422,
    );
  }
  const updated = await prisma.meetingParticipant.update({
    where: { id: participant.id },
    data: { [field]: decision },
  });
  return serializeParticipant(updated);
}
