"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useAuth } from "@/lib/auth-context";

type Project = { id: string; name: string; owner_id: string };
type Channel = { id: string; project_id: string; name: string };
type ChannelLink = {
  id: string;
  channel_id: string;
  platform: string;
  external_channel_id: string;
};
type Message = {
  id: string;
  platform: string;
  channel_id: string;
  author_name: string | null;
  content: string;
  sent_at: string | null;
  created_at: string;
};

// Minimal Web Speech API typings (Chrome's webkitSpeechRecognition)
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onend: (() => void) | null;
};
type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

const PLATFORM_BADGE: Record<string, string> = {
  web: "💬",
  voice: "🎙️",
  discord: "🟣",
  slack: "🟦",
  maskord: "🎭",
};

export default function ProjectPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [newChannel, setNewChannel] = useState("");
  const [linkPlatform, setLinkPlatform] = useState("discord");
  const [linkExternalId, setLinkExternalId] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);

  // ---- data loading -------------------------------------------------------
  const loadProject = useCallback(async () => {
    const db = getInsforgeBrowser().database;
    const { data: proj } = await db.from("projects").select().eq("id", projectId);
    setProject(((proj as Project[]) ?? [])[0] ?? null);
    const { data: chans } = await db
      .from("channels")
      .select()
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    const list = (chans as Channel[]) ?? [];
    setChannels(list);
    setActiveChannel((cur) => cur ?? list[0] ?? null);
  }, [projectId]);

  const loadLinks = useCallback(async (channelId: string) => {
    const db = getInsforgeBrowser().database;
    const { data } = await db
      .from("channel_links")
      .select()
      .eq("channel_id", channelId);
    setLinks((data as ChannelLink[]) ?? []);
  }, []);

  const loadMessages = useCallback(
    async (channel: Channel, channelLinks: ChannelLink[]) => {
      const db = getInsforgeBrowser().database;
      const { data: webRows } = await db
        .from("platform_messages")
        .select()
        .in("platform", ["web", "voice"])
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true })
        .limit(200);
      let all: Message[] = (webRows as Message[]) ?? [];
      for (const link of channelLinks) {
        const { data: bridged } = await db
          .from("platform_messages")
          .select()
          .eq("platform", link.platform)
          .eq("channel_id", link.external_channel_id)
          .order("created_at", { ascending: true })
          .limit(200);
        all = all.concat((bridged as Message[]) ?? []);
      }
      all.sort((a, b) =>
        (a.sent_at ?? a.created_at).localeCompare(b.sent_at ?? b.created_at)
      );
      setMessages(all);
    },
    []
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void loadProject();
  }, [loading, user, router, loadProject]);

  useEffect(() => {
    if (!activeChannel) return;
    void loadLinks(activeChannel.id);
  }, [activeChannel, loadLinks]);

  // poll the feed
  useEffect(() => {
    if (!activeChannel) return;
    void loadMessages(activeChannel, links);
    const t = setInterval(() => void loadMessages(activeChannel, links), 3000);
    return () => clearInterval(t);
  }, [activeChannel, links, loadMessages]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [messages.length]);

  // ---- actions ------------------------------------------------------------
  async function postMessage(content: string, platform: "web" | "voice") {
    if (!user || !activeChannel || !content.trim()) return;
    const db = getInsforgeBrowser().database;
    await db.from("platform_messages").insert([
      {
        platform,
        channel_id: activeChannel.id,
        external_id: crypto.randomUUID(),
        author_id: user.id,
        author_name: user.name || user.email,
        content: content.trim(),
        sent_at: new Date().toISOString(),
      },
    ]);
    void loadMessages(activeChannel, links);
  }

  async function sendDraft(e: React.FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    await postMessage(text, "web");
  }

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!newChannel.trim()) return;
    const db = getInsforgeBrowser().database;
    await db
      .from("channels")
      .insert([{ project_id: projectId, name: newChannel.trim() }]);
    setNewChannel("");
    void loadProject();
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!activeChannel || !linkExternalId.trim() || !user) return;
    const db = getInsforgeBrowser().database;
    await db.from("channel_links").insert([
      {
        channel_id: activeChannel.id,
        platform: linkPlatform,
        external_channel_id: linkExternalId.trim(),
        created_by: user.id,
      },
    ]);
    setLinkExternalId("");
    void loadLinks(activeChannel.id);
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const Ctor = (
      window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    ).webkitSpeechRecognition;
    if (!Ctor) {
      alert("Voice capture needs Chrome (Web Speech API).");
      return;
    }
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) void postMessage(result[0].transcript, "voice");
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  }

  // ---- render -------------------------------------------------------------
  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">
        loading…
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/app" className="mono text-sm text-muted hover:text-foreground">
            ← projects
          </Link>
          <span className="font-semibold">{project?.name ?? "…"}</span>
        </div>
        <span className="mono text-xs text-muted">{user.email}</span>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* channel sidebar */}
        <aside className="flex w-56 flex-col border-r border-border bg-panel/40 p-3">
          <div className="mono mb-2 text-xs uppercase tracking-wide text-muted">
            channels
          </div>
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveChannel(c)}
              className={`rounded-lg px-3 py-1.5 text-left text-sm transition ${
                activeChannel?.id === c.id
                  ? "bg-panel text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              # {c.name}
            </button>
          ))}
          <form onSubmit={addChannel} className="mt-3">
            <input
              placeholder="+ new channel"
              value={newChannel}
              onChange={(e) => setNewChannel(e.target.value)}
              className="w-full rounded-lg border border-border bg-panel px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </form>

          {activeChannel && (
            <div className="mt-6">
              <div className="mono mb-2 text-xs uppercase tracking-wide text-muted">
                connected platforms
              </div>
              {links.length === 0 && (
                <p className="text-xs text-muted">none yet</p>
              )}
              {links.map((l) => (
                <div key={l.id} className="mono truncate text-xs text-muted">
                  {PLATFORM_BADGE[l.platform] ?? "🔗"} {l.platform}:{l.external_channel_id}
                </div>
              ))}
              <form onSubmit={addLink} className="mt-2 flex flex-col gap-1.5">
                <select
                  value={linkPlatform}
                  onChange={(e) => setLinkPlatform(e.target.value)}
                  className="rounded-lg border border-border bg-panel px-2 py-1.5 text-xs outline-none"
                >
                  <option value="discord">Discord channel</option>
                  <option value="slack">Slack channel</option>
                  <option value="maskord">Maskord room</option>
                </select>
                <input
                  placeholder="external channel id"
                  value={linkExternalId}
                  onChange={(e) => setLinkExternalId(e.target.value)}
                  className="rounded-lg border border-border bg-panel px-2 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-border px-2 py-1.5 text-xs font-semibold transition hover:border-accent"
                >
                  Connect
                </button>
              </form>
            </div>
          )}
        </aside>

        {/* chat */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div ref={feedRef} className="flex-1 overflow-y-auto px-6 py-4">
            {messages.length === 0 && (
              <p className="mt-10 text-center text-sm text-muted">
                No messages yet — say something, toggle the mic, or post in a
                connected Discord channel.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="mb-3">
                <div className="mono text-xs text-muted">
                  {PLATFORM_BADGE[m.platform] ?? "💬"}{" "}
                  <span className="text-foreground">{m.author_name ?? "unknown"}</span>{" "}
                  · {new Date(m.sent_at ?? m.created_at).toLocaleTimeString()}
                </div>
                <div className="text-sm">{m.content}</div>
              </div>
            ))}
          </div>

          <form
            onSubmit={sendDraft}
            className="flex items-center gap-2 border-t border-border px-4 py-3"
          >
            <button
              type="button"
              onClick={toggleVoice}
              title="Toggle voice capture"
              className={`rounded-lg border px-3 py-2.5 text-sm transition ${
                listening
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel text-muted hover:border-accent"
              }`}
            >
              {listening ? "🎙️ listening…" : "🎙️"}
            </button>
            <input
              placeholder={
                activeChannel ? `Message #${activeChannel.name}` : "Pick a channel"
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="flex-1 rounded-lg border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!draft.trim() || !activeChannel}
              className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
