import { useAuth } from "@/lib/auth";
import { Redirect } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";

export default function HomeScreen() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7dd3fc" />
      </View>
    );
  }

  if (user) {
    return <Redirect href="/dashboard" />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>MeetMe</Text>
      <Text style={styles.title}>Meet in a room you host.</Text>
      <Text style={styles.subtitle}>
        Sign in to start a meeting, or join with a code as a guest from the join screen.
      </Text>
      <Link href="/login" asChild>
        <Pressable style={styles.primary}>
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </Link>
      <Link href="/register" asChild>
        <Pressable style={styles.secondary}>
          <Text style={styles.secondaryText}>Create an account</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b1220" },
  container: { flex: 1, backgroundColor: "#0b1220", padding: 28, justifyContent: "center" },
  eyebrow: { color: "#7dd3fc", letterSpacing: 3, fontSize: 12, textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 32, fontWeight: "700", marginTop: 12 },
  subtitle: { color: "#94a3b8", fontSize: 16, marginTop: 12, marginBottom: 32, lineHeight: 22 },
  primary: {
    backgroundColor: "#38bdf8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryText: { color: "#082f49", fontWeight: "700", fontSize: 16 },
  secondary: { paddingVertical: 16, alignItems: "center", marginTop: 8 },
  secondaryText: { color: "#e2e8f0", fontSize: 16 },
});
