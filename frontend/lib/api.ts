import type { ApiError } from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie(): Promise<void> {
  await fetch(`${API_URL}/sanctum/csrf-cookie`, {
    credentials: "include",
  });
}

function getCsrfToken(): string | null {
  return getCookie("XSRF-TOKEN");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrfCookie();
  }

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Requested-With", "XMLHttpRequest");

  if (options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers.set("X-XSRF-TOKEN", csrf);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = data as ApiError;
    const firstFieldError = error.errors
      ? Object.values(error.errors)[0]?.[0]
      : undefined;
    throw new Error(firstFieldError ?? error.message ?? "Something went wrong.");
  }

  return data as T;
}

export const api = {
  async initCsrf(): Promise<void> {
    await ensureCsrfCookie();
  },

  async getUser() {
    const response = await request<{ data: import("@/types").User }>("/api/user");
    return response.data;
  },

  async login(email: string, password: string) {
    await ensureCsrfCookie();
    await request<void>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await ensureCsrfCookie();
  },

  async register(name: string, email: string, password: string, password_confirmation: string) {
    await ensureCsrfCookie();
    await request<void>("/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, password_confirmation }),
    });
    await ensureCsrfCookie();
  },

  async logout() {
    return request<void>("/logout", { method: "POST" });
  },

  async getMeetings() {
    const response = await request<{ data: import("@/types").Meeting[] }>("/api/meetings");
    return response.data;
  },

  async createMeeting(title?: string) {
    const response = await request<{ data: import("@/types").Meeting }>("/api/meetings", {
      method: "POST",
      body: JSON.stringify({ title }),
    });
    return response.data;
  },

  async getMeeting(code: string) {
    const response = await request<{ data: import("@/types").Meeting }>(`/api/meetings/${code}`);
    return response.data;
  },

  async joinMeeting(code: string, displayName?: string) {
    const body: Record<string, string> = {};
    if (displayName) {
      body.display_name = displayName;
    }

    return request<import("@/types").JoinMeetingResponse>(
      `/api/meetings/${code}/join`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  async getJoinStatus(code: string, admitToken: string) {
    return request<import("@/types").JoinMeetingResponse>(
      `/api/meetings/${code}/join-status?admit_token=${encodeURIComponent(admitToken)}`,
    );
  },

  async getWaitingParticipants(code: string) {
    const response = await request<{
      data: import("@/types").MeetingParticipant[];
    }>(`/api/meetings/${code}/waiting`);
    return response.data;
  },

  async admitParticipant(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/participants/${participantId}/admit`,
      { method: "POST" },
    );
  },

  async denyParticipant(code: string, participantId: number) {
    return request<{ message: string }>(
      `/api/meetings/${code}/participants/${participantId}/deny`,
      { method: "POST" },
    );
  },

  async leaveMeeting(code: string, data: { admit_token?: string; identity?: string }) {
    return request<{ message: string }>(`/api/meetings/${code}/leave`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async endMeeting(code: string) {
    return request<{ message: string }>(`/api/meetings/${code}/end`, {
      method: "POST",
    });
  },

  async getAdminStats() {
    return request<import("@/types").AdminStats>("/api/admin/stats");
  },

  async getAdminUsers(page = 1) {
    return request<import("@/types").PaginatedResponse<import("@/types").User>>(
      `/api/admin/users?page=${page}`,
    );
  },

  async getAdminMeetings(page = 1) {
    return request<import("@/types").PaginatedResponse<import("@/types").Meeting>>(
      `/api/admin/meetings?page=${page}`,
    );
  },

  async updateUser(id: number, data: { is_admin?: boolean; name?: string }) {
    return request<{ data: import("@/types").User }>(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  async deleteMeeting(id: number) {
    return request<{ message: string }>(`/api/admin/meetings/${id}`, {
      method: "DELETE",
    });
  },
};
