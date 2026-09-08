import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Meeting } from "@/lib/types";
import { Redirect, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

function formatCode(input: string) {
  const raw = input.trim().toLowerCase();
  const fromPath = raw.match(/\/m\/([a-z0-9-]+)/i);
  if (fromPath?.[1]) return fromPath[1];
  return raw.replace(/[^a-z0-9-]/g, "");
}

export default function DashboardScreen() {
  const { user, loading, logout } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setMeetings(await api.getMeetings());
    } catch {
      setMeetings([]);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7dd3fc" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  async function onCreate() {
    setError("");
    setCreating(true);
    try {
      const meeting = await api.createMeeting();
      router.push(`/m/${meeting.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create meeting.");
      setCreating(false);
    }
  }

  function onJoin() {
    const code = formatCode(joinCode);
    if (!code) {
      setError("Enter a meeting code.");
      return;
    }
    router.push(`/m/${code}`);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>Your rooms</Text>
      <Text style={styles.title}>Hi, {user.name.split(" ")[0]}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.primary} onPress={onCreate} disabled={creating}>
        <Text style={styles.primaryText}>{creating ? "Creating…" : "New meeting"}</Text>
      </Pressable>

      <Text style={styles.section}>Join with code</Text>
      <TextInput
        style={styles.input}
        placeholder="abc-defg-hij"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        value={joinCode}
        onChangeText={setJoinCode}
      />
      <Pressable style={styles.secondary} onPress={onJoin}>
        <Text style={styles.secondaryText}>Join</Text>
      </Pressable>

      <Text style={styles.section}>Recent meetings</Text>
      {meetings.length === 0 ? (
        <Text style={styles.muted}>No meetings yet.</Text>
      ) : (
        meetings.map((meeting) => (
          <Pressable
            key={meeting.id}
            style={styles.card}
            onPress={() => router.push(`/m/${meeting.code}`)}
          >
            <Text style={styles.cardTitle}>{meeting.title}</Text>
            <Text style={styles.muted}>{meeting.code}</Text>
          </Pressable>
        ))
      )}

      <Pressable style={styles.logout} onPress={() => logout()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b1220" },
  container: { flex: 1, backgroundColor: "#0b1220" },
  content: { padding: 24, paddingTop: 64 },
  eyebrow: { color: "#7dd3fc", letterSpacing: 3, fontSize: 12, textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "700", marginTop: 8, marginBottom: 20 },
  error: { color: "#fda4af", marginBottom: 12 },
  primary: {
    backgroundColor: "#38bdf8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#082f49", fontWeight: "700", fontSize: 16 },
  secondary: {
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: { color: "#e2e8f0", fontWeight: "600" },
  section: { color: "#f8fafc", fontSize: 18, fontWeight: "600", marginTop: 28, marginBottom: 12 },
  input: {
    backgroundColor: "#111827",
    borderColor: "#1e293b",
    borderWidth: 1,
    borderRadius: 12,
    color: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  muted: { color: "#94a3b8" },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardTitle: { color: "#f8fafc", fontWeight: "600", marginBottom: 4 },
  logout: { marginTop: 32, alignItems: "center", paddingBottom: 40 },
  logoutText: { color: "#94a3b8" },
});
