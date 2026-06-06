import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";

import { DEFAULTS, isConfigured, loadSettings, saveSettings, type Settings } from "./src/lib/config";
import {
  createSession,
  insertMemories,
  insertSegment,
  listRecentMemories,
  type Memory,
} from "./src/lib/insforge";
import { transcribe } from "./src/lib/deepgram";
import { extractMemories, SAMPLE_TRANSCRIPT } from "./src/lib/understanding";

type Tab = "listen" | "memories" | "settings";

const KIND_COLOR: Record<Memory["kind"], string> = {
  note: "#5eead4",
  action_item: "#fbbf24",
  question: "#a78bfa",
  decision: "#34d399",
  entity: "#60a5fa",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("listen");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [draft, setDraft] = useState<Settings>(DEFAULTS);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const cfg = useMemo(() => isConfigured(settings), [settings]);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setDraft(s);
    });
  }, []);

  const flash = useCallback((msg: string, ms = 2500) => {
    setStatus(msg);
    if (ms) setTimeout(() => setStatus((cur) => (cur === msg ? "" : cur)), ms);
  }, []);

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!cfg.insforge) return null;
    try {
      const id = await createSession(settings, `Mobile session ${new Date().toLocaleString()}`);
      setSessionId(id);
      return id;
    } catch (e) {
      flash(`InsForge error: ${String(e).slice(0, 80)}`);
      return null;
    }
  }, [sessionId, cfg.insforge, settings, flash]);

  // Distill a chunk of transcript into memories, persist them, and show them.
  const distill = useCallback(
    async (text: string, sid: string | null) => {
      if (!cfg.insforge) {
        flash("Set InsForge keys in Settings to distill memories.");
        return;
      }
      setBusy(true);
      setStatus("Distilling memories…");
      try {
        const { memories: found, error } = await extractMemories(settings, text);
        if (error) flash(`Understanding error: ${error.slice(0, 90)}`);
        if (found.length) {
          await insertMemories(settings, sid, found).catch(() => {});
          setMemories((prev) => [...found, ...prev]);
          flash(`+${found.length} ${found.length > 1 ? "memories" : "memory"}`);
        } else {
          flash("No new memories worth keeping.");
        }
      } finally {
        setBusy(false);
        setStatus("");
      }
    },
    [cfg.insforge, settings, flash]
  );

  const startRecording = useCallback(async () => {
    if (!cfg.deepgram) {
      flash("Add your Deepgram key in Settings first.");
      setTab("settings");
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      flash("Microphone permission denied.");
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await ensureSession();
    await recorder.prepareToRecordAsync();
    recorder.record();
    setIsRecording(true);
    setStatus("● Listening…");
  }, [cfg.deepgram, ensureSession, recorder, flash]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setStatus("Transcribing…");
    setBusy(true);
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        flash("No audio captured.");
        return;
      }
      const text = await transcribe(uri, settings.deepgramKey);
      if (!text) {
        flash("Nothing transcribed (silence?).");
        return;
      }
      const sid = await ensureSession();
      setTranscript((prev) => (prev ? `${prev}\n${text}` : text));
      if (sid) await insertSegment(settings, sid, text).catch(() => {});
      setBusy(false);
      await distill(text, sid);
    } catch (e) {
      flash(`Error: ${String(e).slice(0, 90)}`);
    } finally {
      setBusy(false);
      setStatus("");
    }
  }, [recorder, settings, ensureSession, distill, flash]);

  const addSample = useCallback(async () => {
    setTranscript((prev) => (prev ? `${prev}\n${SAMPLE_TRANSCRIPT}` : SAMPLE_TRANSCRIPT));
    const sid = await ensureSession();
    if (sid) await insertSegment(settings, sid, SAMPLE_TRANSCRIPT).catch(() => {});
    flash("Sample conversation added.");
  }, [ensureSession, settings, flash]);

  const refreshMemories = useCallback(async () => {
    if (!cfg.insforge) return;
    try {
      const rows = await listRecentMemories(settings, 50);
      setMemories(rows);
    } catch (e) {
      flash(`InsForge error: ${String(e).slice(0, 80)}`);
    }
  }, [cfg.insforge, settings, flash]);

  useEffect(() => {
    if (tab === "memories") refreshMemories();
  }, [tab, refreshMemories]);

  async function persistSettings() {
    await saveSettings(draft);
    setSettings(draft);
    flash("Settings saved.");
    setTab("listen");
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>
          ● <Text style={styles.brandName}>Always Listening</Text>
        </Text>
        <Text style={styles.sub}>mobile · Deepgram → InsForge memories</Text>
      </View>

      {status ? (
        <View style={styles.statusBar}>
          {busy ? <ActivityIndicator color="#0a0b0f" size="small" /> : null}
          <Text style={styles.statusText}>{status}</Text>
        </View>
      ) : null}

      <View style={styles.body}>
        {tab === "listen" && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Pressable
              onPress={isRecording ? stopRecording : startRecording}
              disabled={busy && !isRecording}
              style={[styles.mic, isRecording && styles.micActive]}
            >
              <Text style={styles.micIcon}>{isRecording ? "■" : "🎙"}</Text>
              <Text style={styles.micLabel}>
                {isRecording ? "Stop & transcribe" : "Tap to listen"}
              </Text>
            </Pressable>

            <View style={styles.row}>
              <Pressable style={styles.secondary} onPress={addSample}>
                <Text style={styles.secondaryText}>+ Sample conversation</Text>
              </Pressable>
              <Pressable
                style={styles.secondary}
                onPress={() => distill(transcript, sessionId)}
                disabled={!transcript || busy}
              >
                <Text style={styles.secondaryText}>✦ Distill now</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>TRANSCRIPT</Text>
            <View style={styles.panel}>
              <Text style={styles.transcript}>
                {transcript || "Your transcript will appear here as you listen."}
              </Text>
            </View>

            {memories.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>LATEST MEMORIES</Text>
                {memories.slice(0, 4).map((m, i) => (
                  <MemoryCard key={i} m={m} />
                ))}
              </>
            )}
          </ScrollView>
        )}

        {tab === "memories" && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionLabel}>MEMORIES</Text>
              <Pressable onPress={refreshMemories}>
                <Text style={styles.link}>↻ refresh</Text>
              </Pressable>
            </View>
            {!cfg.insforge && (
              <Text style={styles.hint}>Add InsForge keys in Settings to load memories.</Text>
            )}
            {memories.length === 0 && cfg.insforge && (
              <Text style={styles.hint}>
                No memories yet. Listen or add a sample on the Listen tab.
              </Text>
            )}
            {memories.map((m, i) => (
              <MemoryCard key={i} m={m} />
            ))}
          </ScrollView>
        )}

        {tab === "settings" && (
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={styles.sectionLabel}>DEEPGRAM</Text>
            <Field
              label="API key"
              value={draft.deepgramKey}
              onChange={(t) => setDraft({ ...draft, deepgramKey: t })}
              placeholder="Token from console.deepgram.com"
              secure
            />
            <Text style={styles.sectionLabel}>INSFORGE</Text>
            <Field
              label="Base URL"
              value={draft.insforgeUrl}
              onChange={(t) => setDraft({ ...draft, insforgeUrl: t })}
              placeholder="https://xxxx.us-west.insforge.app"
            />
            <Field
              label="API key"
              value={draft.insforgeKey}
              onChange={(t) => setDraft({ ...draft, insforgeKey: t })}
              placeholder="ik_..."
              secure
            />
            <Field
              label="Understanding model"
              value={draft.understandingModel}
              onChange={(t) => setDraft({ ...draft, understandingModel: t })}
              placeholder="openai/gpt-4o-mini"
            />
            <Pressable style={styles.save} onPress={persistSettings}>
              <Text style={styles.saveText}>Save settings</Text>
            </Pressable>
            <Text style={styles.hint}>
              Keys are stored in the device keychain (expo-secure-store), never committed.
            </Text>
          </ScrollView>
        )}
      </View>

      <View style={styles.tabs}>
        {(["listen", "memories", "settings"] as Tab[]).map((t) => (
          <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabActive]}>
              {t === "listen" ? "Listen" : t === "memories" ? "Memories" : "Settings"}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function MemoryCard({ m }: { m: Memory }) {
  return (
    <View style={styles.memCard}>
      <View style={styles.memHead}>
        <View style={[styles.kindDot, { backgroundColor: KIND_COLOR[m.kind] ?? "#5eead4" }]} />
        <Text style={[styles.kind, { color: KIND_COLOR[m.kind] ?? "#5eead4" }]}>
          {m.kind.replace("_", " ")}
        </Text>
      </View>
      <Text style={styles.memContent}>{m.content}</Text>
      {m.tags?.length ? (
        <Text style={styles.tags}>{m.tags.map((t) => `#${t}`).join("  ")}</Text>
      ) : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#5b616e"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0a0b0f" },
  header: { paddingTop: 64, paddingHorizontal: 20, paddingBottom: 12 },
  brand: { color: "#f87171", fontSize: 22, fontWeight: "700" },
  brandName: { color: "#e7e9ee" },
  sub: { color: "#8a90a0", fontSize: 13, marginTop: 2 },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#5eead4",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statusText: { color: "#0a0b0f", fontWeight: "600" },
  body: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  mic: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#14161d",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#242833",
    paddingVertical: 36,
    marginBottom: 16,
  },
  micActive: { borderColor: "#f87171", backgroundColor: "#1c1416" },
  micIcon: { fontSize: 44 },
  micLabel: { color: "#e7e9ee", marginTop: 10, fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, marginBottom: 20 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  secondary: {
    flex: 1,
    backgroundColor: "#14161d",
    borderColor: "#242833",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: { color: "#8a90a0", fontWeight: "600", fontSize: 13 },
  sectionLabel: {
    color: "#5b616e",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  panel: {
    backgroundColor: "#14161d",
    borderColor: "#242833",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    minHeight: 90,
  },
  transcript: { color: "#c8ccd4", lineHeight: 21, fontSize: 14 },
  memCard: {
    backgroundColor: "#14161d",
    borderColor: "#242833",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  memHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  kindDot: { width: 8, height: 8, borderRadius: 4 },
  kind: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  memContent: { color: "#e7e9ee", fontSize: 15, lineHeight: 21 },
  tags: { color: "#5b616e", fontSize: 12, marginTop: 6 },
  link: { color: "#5eead4", fontSize: 13, fontWeight: "600" },
  hint: { color: "#5b616e", fontSize: 13, marginTop: 8, lineHeight: 19 },
  fieldLabel: { color: "#8a90a0", fontSize: 12, marginBottom: 5 },
  input: {
    backgroundColor: "#14161d",
    borderColor: "#242833",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: "#e7e9ee",
    fontSize: 14,
  },
  save: {
    backgroundColor: "#5eead4",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  saveText: { color: "#0a0b0f", fontWeight: "700", fontSize: 15 },
  tabs: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#242833",
    backgroundColor: "#0c0d12",
    paddingBottom: 24,
    paddingTop: 10,
  },
  tab: { flex: 1, alignItems: "center" },
  tabText: { color: "#5b616e", fontSize: 13, fontWeight: "600" },
  tabActive: { color: "#5eead4" },
});
