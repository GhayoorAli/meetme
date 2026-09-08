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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError("");
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password, confirm);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.eyebrow}>Get started</Text>
      <Text style={styles.title}>Create an account</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <GoogleSignInButton />
      <TextInput
        style={styles.input}
        placeholder="Name"
        placeholderTextColor="#64748b"
        value={name}
        onChangeText={setName}
      />
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
        placeholder="Password (8+ characters)"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm password"
        placeholderTextColor="#64748b"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <Pressable style={styles.primary} onPress={onSubmit} disabled={loading}>
        <Text style={styles.primaryText}>{loading ? "Creating…" : "Register"}</Text>
      </Pressable>
      <Link href="/login" style={styles.link}>
        Already have an account? Sign in
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
