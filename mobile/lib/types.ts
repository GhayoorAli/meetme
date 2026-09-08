export type User = {
  id: number;
  name: string;
  email: string;
  is_admin: boolean;
  created_at: string;
};

export type Meeting = {
  id: number;
  code: string;
  title: string;
  status: "active" | "ended";
  waiting_room_enabled?: boolean;
  host_id: number;
  host?: User;
  participant_count?: number;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  join_url: string;
};

export type MeetingParticipant = {
  id: number;
  display_name: string;
  identity?: string;
  role: "host" | "guest";
  status: "waiting" | "admitted" | "denied" | "left";
  admit_token?: string;
};

export type JoinMeetingResponse = {
  status: "waiting" | "admitted" | "denied" | "left";
  message?: string;
  meeting: Meeting;
  participant: MeetingParticipant;
  host_identity?: string;
  host_token?: string;
  livekit?: {
    url: string;
    token: string;
    room: string;
  };
};
