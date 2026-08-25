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

export type ParticipantStatus = "waiting" | "admitted" | "denied" | "left";

export type MeetingParticipant = {
  id: number;
  display_name: string;
  identity?: string;
  role: "host" | "guest";
  status: ParticipantStatus;
  admit_token?: string;
  joined_at?: string | null;
  left_at?: string | null;
  created_at?: string;
};

export type JoinMeetingResponse = {
  status: "waiting" | "admitted" | "denied" | "left";
  message?: string;
  meeting: Meeting;
  participant: MeetingParticipant;
  livekit?: {
    url: string;
    token: string;
    room: string;
  };
};

export type AdminStats = {
  users: number;
  meetings: number;
  active_meetings: number;
  total_participants: number;
};

export type ApiError = {
  message: string;
  errors?: Record<string, string[]>;
};

export type PaginatedResponse<T> = {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
};
