import type { Meeting, MeetingParticipant, User } from "@/types";
import type {
  Meeting as DbMeeting,
  MeetingParticipant as DbParticipant,
  User as DbUser,
} from "@prisma/client";

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";

export function serializeUser(user: DbUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    is_admin: user.isAdmin,
    created_at: user.createdAt.toISOString(),
  };
}

export function serializeMeeting(
  meeting: DbMeeting & {
    host?: DbUser | null;
    _count?: { participants?: number };
  },
): Meeting {
  return {
    id: meeting.id,
    code: meeting.code,
    title: meeting.title,
    status: meeting.status,
    waiting_room_enabled: meeting.waitingRoomEnabled,
    host_id: meeting.hostId ?? 0,
    host: meeting.host ? serializeUser(meeting.host) : undefined,
    participant_count: meeting._count?.participants,
    started_at: meeting.startedAt?.toISOString() ?? null,
    ended_at: meeting.endedAt?.toISOString() ?? null,
    created_at: meeting.createdAt.toISOString(),
    join_url: `${appUrl()}/m/${meeting.code}`,
  };
}

export function serializeParticipant(
  participant: DbParticipant,
  extra?: Partial<MeetingParticipant>,
): MeetingParticipant {
  return {
    id: participant.id,
    display_name: participant.displayName,
    identity: participant.identity,
    role: participant.role,
    status: participant.status,
    recording_permission: participant.recordingPermission,
    screen_share_permission: participant.screenSharePermission,
    hand_raised: participant.handRaised,
    admit_token: extra?.admit_token ?? participant.admitToken,
    joined_at: participant.joinedAt?.toISOString() ?? null,
    left_at: participant.leftAt?.toISOString() ?? null,
    created_at: participant.createdAt.toISOString(),
    ...extra,
  };
}
