import { GoogleSignInButton } from "@/components/google-sign-in";
import { useAuth } from "@/lib/auth";
import { Link, router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.eyebrow}>Welcome back</Text>
      <Text style={styles.title}>Sign in</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <GoogleSignInButton />
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.primary} onPress={onSubmit} disabled={loading}>
        <Text style={styles.primaryText}>{loading ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      <Link href="/register" style={styles.link}>
        Need an account? Register
      </Link>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0b1220", padding: 28, justifyContent: "center" },
  eyebrow: { color: "#7dd3fc", letterSpacing: 3, fontSize: 12, textTransform: "uppercase" },
  title: { color: "#f8fafc", fontSize: 28, fontWeight: "700", marginTop: 8, marginBottom: 24 },
  error: { color: "#fda4af", marginBottom: 12 },
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
  primary: {
    backgroundColor: "#38bdf8",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  primaryText: { color: "#082f49", fontWeight: "700", fontSize: 16 },
  link: { color: "#7dd3fc", marginTop: 18, textAlign: "center" },
});
