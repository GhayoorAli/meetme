import { useAuth } from "@/lib/auth";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

WebBrowser.maybeCompleteAuthSession();

export function GoogleSignInButton() {
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: webClientId || undefined,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  });

  useEffect(() => {
    if (response?.type === "error" || response?.type === "dismiss") {
      if (response.type === "error") setError("Google sign-in failed.");
      return;
    }
    if (response?.type !== "success") return;
    const idToken = response.params.id_token;
    if (!idToken) {
      setError("Google did not return an ID token.");
      return;
    }
    setBusy(true);
    loginWithGoogle(idToken)
      .then(() => router.replace("/dashboard"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Google sign-in failed.");
      })
      .finally(() => setBusy(false));
  }, [response, loginWithGoogle]);

  if (!webClientId) return null;

  return (
    <>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={styles.button}
        disabled={!request || busy}
        onPress={() => {
          setError("");
          promptAsync();
        }}
      >
        <Text style={styles.text}>{busy ? "Connecting…" : "Continue with Google"}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  error: { color: "#fda4af", marginBottom: 12, textAlign: "center" },
  button: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  text: { color: "#082f49", fontWeight: "700", fontSize: 16 },
});
