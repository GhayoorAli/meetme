"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import type { AdminStats, Meeting, User } from "@/types";
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Video,
  Activity,
  UserCheck,
  Trash2,
  Shield,
  ShieldOff,
} from "lucide-react";

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "meetings">("users");

  const load = useCallback(async () => {
    try {
      const [statsData, usersData, meetingsData] = await Promise.all([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getAdminMeetings(),
      ]);
      setStats(statsData);
      setUsers(usersData.data);
      setMeetings(meetingsData.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAdmin(user: User) {
    await api.updateUser(user.id, { is_admin: !user.is_admin });
    load();
  }

  async function deleteMeeting(id: number) {
    if (!confirm("Delete this meeting record?")) return;
    await api.deleteMeeting(id);
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold text-[var(--meet-text)]">
        Admin dashboard
      </h1>
      <p className="mt-1 text-[var(--meet-text-muted)]">
        Manage users and meetings across the platform.
      </p>

      {stats ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total users", value: stats.users, icon: Users },
            { label: "Total meetings", value: stats.meetings, icon: Video },
            { label: "Active now", value: stats.active_meetings, icon: Activity },
            {
              label: "Participants",
              value: stats.total_participants,
              icon: UserCheck,
            },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--meet-primary-strong)]/20 text-[var(--meet-primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-[var(--meet-text)]">
                  {value}
                </p>
                <p className="text-sm text-[var(--meet-text-muted)]">{label}</p>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="mt-10 flex gap-2 border-b border-[var(--meet-border)]">
        {(["users", "meetings"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? "border-[var(--meet-primary)] text-[var(--meet-primary)]"
                : "border-transparent text-[var(--meet-text-muted)] hover:text-[var(--meet-text)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "users" ? (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-[var(--meet-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--meet-border)] bg-[var(--meet-surface)]">
                <th className="px-4 py-3 text-left font-medium text-[var(--meet-text-muted)]">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--meet-text-muted)]">
                  Email
                </th>
                <th className="px-4 py-3 text-left font-medium text-[var(--meet-text-muted)]">
                  Role
                </th>
                <th className="px-4 py-3 text-right font-medium text-[var(--meet-text-muted)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-[var(--meet-border)] last:border-0"
                >
                  <td className="px-4 py-3 text-[var(--meet-text)]">
                    {user.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--meet-text-muted)]">
                    {user.email}
                  </td>
                  <td className="px-4 py-3">
                    {user.is_admin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--meet-primary-strong)]/20 px-2.5 py-0.5 text-xs text-[var(--meet-primary)]">
                        <Shield className="h-3 w-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="text-[var(--meet-text-muted)]">User</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleAdmin(user)}
                    >
                      {user.is_admin ? (
                        <>
                          <ShieldOff className="h-4 w-4" />
                          Revoke
                        </>
                      ) : (
                        <>
                          <Shield className="h-4 w-4" />
                          Make admin
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {meetings.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--meet-border)] bg-[var(--meet-surface)] p-4"
            >
              <div>
                <p className="font-medium text-[var(--meet-text)]">
                  {meeting.title}
                </p>
                <p className="text-sm text-[var(--meet-text-muted)]">
                  {meeting.code} · {meeting.host?.name} · {meeting.status}
                </p>
              </div>
              <Button
                size="sm"
                variant="danger"
                onClick={() => deleteMeeting(meeting.id)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
