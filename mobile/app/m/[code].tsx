import { MeetingRoom } from "@/components/meeting-room";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getAdmitToken } from "@/lib/storage";
import type { JoinMeetingResponse, Meeting } from "@/lib/types";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export default function MeetingJoinScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = String(rawCode ?? "").toLowerCase();
  const { user } = useAuth();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [join, setJoin] = useState<JoinMeetingResponse | null>(null);
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setMeeting(await api.getMeeting(code));
    } catch {
      setError("Meeting not found.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user?.name && !displayName) setDisplayName(user.name);
  }, [user, displayName]);

  useEffect(() => {
    let cancelled = false;
    async function restore() {
      const admitToken = await getAdmitToken(code);
      if (!admitToken) return;
      try {
        const status = await api.getJoinStatus(code, admitToken);
        if (cancelled) return;
        if (status.status === "admitted" || status.status === "waiting") {
          setJoin(status);
        }
      } catch {
        // start fresh
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (join?.status !== "waiting" || !join.participant.admit_token) return;
    const token = join.participant.admit_token;
    const id = setInterval(async () => {
      try {
        const status = await api.getJoinStatus(code, token);
        if (status.status === "admitted" || status.status === "denied") {
          setJoin(status);
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(id);
  }, [code, join]);

  async function onJoin() {
    setError("");
    setBusy(true);
    try {
      setJoin(await api.joinMeeting(code, displayName.trim() || user?.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7dd3fc" />
      </View>
    );
  }

  if (error && !meeting) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (meeting?.status === "ended") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>This meeting has ended.</Text>
        <Pressable onPress={() => router.replace("/dashboard")}>
          <Text style={styles.link}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  if (join?.status === "denied") {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>The host denied your request.</Text>
        <Pressable onPress={() => router.replace("/dashboard")}>
          <Text style={styles.link}>Back to dashboard</Text>
        </Pressable>
      </View>
    );
  }

  if (join?.status === "admitted" && join.livekit) {
    return (
      <MeetingRoom
        code={code}
        url={join.livekit.url}
        token={join.livekit.token}
        isHost={join.participant.role === "host"}
        identity={join.participant.identity ?? ""}
        displayName={join.participant.display_name}
        admitToken={join.participant.admit_token}
        onLeave={() => router.replace("/dashboard")}
      />
    );
  }

  if (join?.status === "waiting") {
    return (
      <View style={styles.center}>
        <Text style={styles.eyebrow}>{meeting?.title}</Text>
        <Text style={styles.title}>Waiting for the host</Text>
        <Text style={styles.muted}>Stay on this screen. You will join when admitted.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>{meeting?.code}</Text>
      <Text style={styles.title}>{meeting?.title ?? "Join meeting"}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!user ? (
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#64748b"
          value={displayName}
          onChangeText={setDisplayName}
        />
      ) : null}
      <Pressable style={styles.primary} onPress={onJoin} disabled={busy}>
        <Text style={styles.primaryText}>{busy ? "Joining…" : "Ask to join"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#0b1220",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: { flex: 1, backgroundColor: "#0b1220", padding: 24, justifyContent: "center" },
  eyebrow: { color: "#7dd3fc", letterSpacing: 2, textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 26, fontWeight: "700", marginTop: 8, textAlign: "center" },
  muted: { color: "#94a3b8", marginTop: 12, textAlign: "center" },
  error: { color: "#fda4af", marginBottom: 12, textAlign: "center" },
  input: {
    backgroundColor: "#111827",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 12,
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 20,
  },
  primary: {
    backgroundColor: "#38bdf8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  primaryText: { color: "#082f49", fontWeight: "700", fontSize: 16 },
  link: { color: "#7dd3fc", marginTop: 16 },
});
