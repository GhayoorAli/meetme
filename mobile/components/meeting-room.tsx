import { api } from "@/lib/api";
import {
  decodeHandRaiseMessage,
  encodeHandRaiseMessage,
  HAND_RAISE_TOPIC,
} from "@/lib/hand-raise";
import type { MeetingParticipant } from "@/lib/types";
import {
  AudioSession,
  LiveKitRoom,
  useLocalParticipant,
  useRoomContext,
  useTracks,
  VideoTrack,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type Props = {
  code: string;
  url: string;
  token: string;
  isHost: boolean;
  identity: string;
  displayName: string;
  admitToken?: string;
  onLeave: () => void;
};

export function MeetingRoom(props: Props) {
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  return (
    <LiveKitRoom
      serverUrl={props.url}
      token={props.token}
      connect
      audio
      video
      onDisconnected={props.onLeave}
      style={styles.flex}
    >
      <RoomBody {...props} />
    </LiveKitRoom>
  );
}

function RoomBody(props: Props) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], {
    onlySubscribed: false,
  });
  const [raised, setRaised] = useState(false);
  const [hands, setHands] = useState<Record<string, string>>({});
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [waiting, setWaiting] = useState<MeetingParticipant[]>([]);

  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== HAND_RAISE_TOPIC) return;
      try {
        const message = decodeHandRaiseMessage(payload);
        setHands((current) => {
          const next = { ...current };
          if (message.type === "hand_raised") next[message.identity] = message.name;
          else delete next[message.identity];
          return next;
        });
      } catch {
        // ignore
      }
    };
    room.on("dataReceived", onData);
    return () => {
      room.off("dataReceived", onData);
    };
  }, [room]);

  useEffect(() => {
    if (!props.isHost) return;
    let cancelled = false;
    async function poll() {
      try {
        const rows = await api.getWaiting(props.code);
        if (!cancelled) setWaiting(rows);
      } catch {
        // host token may be missing on a guest device
      }
    }
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [props.code, props.isHost]);

  const visibleTracks = useMemo(
    () => tracks.filter((track) => track.participant.identity),
    [tracks],
  );

  async function toggleHand() {
    const next = !raised;
    setRaised(next);
    await room.localParticipant.publishData(
      encodeHandRaiseMessage({
        type: next ? "hand_raised" : "hand_lowered",
        identity: props.identity,
        name: props.displayName,
      }),
      { reliable: true, topic: HAND_RAISE_TOPIC },
    );
  }

  async function leave() {
    try {
      await api.leave(props.code, {
        admit_token: props.admitToken,
        identity: props.identity,
      });
    } finally {
      room.disconnect();
      props.onLeave();
    }
  }

  async function endAll() {
    await api.end(props.code);
    room.disconnect();
    props.onLeave();
  }

  return (
    <View style={styles.flex}>
      <View style={styles.grid}>
        {visibleTracks.length === 0 ? (
          <View style={styles.placeholder}>
            <Text style={styles.muted}>Connecting…</Text>
          </View>
        ) : (
          visibleTracks.map((trackRef) => (
            <View key={trackRef.participant.sid + String(trackRef.source)} style={styles.tile}>
              <VideoTrack trackRef={trackRef} style={styles.video} />
              <Text style={styles.name}>
                {trackRef.participant.name || trackRef.participant.identity}
                {hands[trackRef.participant.identity] ? " ✋" : ""}
              </Text>
            </View>
          ))
        )}
      </View>

      {peopleOpen ? (
        <ScrollView style={styles.people}>
          <Text style={styles.peopleTitle}>People</Text>
          {waiting.map((person) => (
            <View key={person.id} style={styles.waitingRow}>
              <Text style={styles.waitingName}>{person.display_name}</Text>
              {props.isHost ? (
                <View style={styles.row}>
                  <Pressable
                    style={styles.admit}
                    onPress={() => api.admit(props.code, person.id)}
                  >
                    <Text style={styles.admitText}>Admit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.deny}
                    onPress={() => api.deny(props.code, person.id)}
                  >
                    <Text style={styles.denyText}>Deny</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
          {waiting.length === 0 ? <Text style={styles.muted}>No one waiting.</Text> : null}
        </ScrollView>
      ) : null}

      <View style={styles.dock}>
        <DockButton
          label={isMicrophoneEnabled ? "Mute" : "Unmute"}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        />
        <DockButton
          label={isCameraEnabled ? "Camera off" : "Camera"}
          onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        />
        <DockButton label={raised ? "Lower" : "Hand"} onPress={toggleHand} />
        <DockButton label="People" onPress={() => setPeopleOpen((open) => !open)} />
        {props.isHost ? <DockButton label="End all" danger onPress={endAll} /> : null}
        <DockButton label="Leave" danger onPress={leave} />
      </View>
    </View>
  );
}

function DockButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={[styles.dockBtn, danger && styles.danger]} onPress={onPress}>
      <Text style={styles.dockText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#020617" },
  grid: { flex: 1, padding: 8, gap: 8 },
  tile: { flex: 1, borderRadius: 12, overflow: "hidden", backgroundColor: "#111827", minHeight: 160 },
  video: { flex: 1 },
  name: {
    position: "absolute",
    left: 8,
    bottom: 8,
    color: "#f8fafc",
    backgroundColor: "#00000088",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  muted: { color: "#94a3b8" },
  dock: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    paddingBottom: 24,
    justifyContent: "center",
  },
  dockBtn: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  danger: { backgroundColor: "#7f1d1d" },
  dockText: { color: "#f8fafc", fontWeight: "600" },
  people: { maxHeight: 220, backgroundColor: "#0f172a", padding: 12 },
  peopleTitle: { color: "#f8fafc", fontWeight: "700", marginBottom: 8 },
  waitingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  waitingName: { color: "#e2e8f0" },
  row: { flexDirection: "row", gap: 8 },
  admit: { backgroundColor: "#155e75", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  admitText: { color: "#e0f2fe", fontWeight: "600" },
  deny: { backgroundColor: "#7f1d1d", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  denyText: { color: "#fee2e2", fontWeight: "600" },
});
