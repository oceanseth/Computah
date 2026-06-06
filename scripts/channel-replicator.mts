/**
 * Computah channel replicator — realtime, bidirectional Discord ↔ platform.
 *
 * Each project channel is a hub ('hub:<uuid>'). `channel_links` rows declare
 * its connected destinations (Discord today; Slack/Maskord later).
 *
 *   INBOUND   Discord Gateway (websocket) MESSAGE_CREATE → platform_messages
 *             (a DB trigger then pushes it to the web chat instantly)
 *   OUTBOUND  InsForge realtime 'hub:%' events for web/voice messages →
 *             every linked Discord channel, instantly
 *   CROSS     Discord messages replicate to the hub's other linked channels
 *
 * No polling on the message path. Config (links, per-project bot tokens from
 * project_settings) refreshes every 30s, so connecting a channel in the web
 * UI starts replication within one refresh.
 *
 * Loop prevention: messages authored by any of our bot identities are ignored.
 *
 * Usage:
 *   npx tsx scripts/channel-replicator.mts [extra-discord-channel-id ...]
 *
 * Needs DISCORD_BOT_TOKEN in .env.local (default bot); projects may override
 * with their own token in settings. Bots need View Channels, Send Messages,
 * Read Message History + the Message Content gateway intent.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";
import { Client, Events, GatewayIntentBits } from "discord.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_REFRESH_MS = 30_000;
const DISCORD_API = "https://discord.com/api/v10";

function loadEnvLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2];
    }
  } catch {}
  return out;
}

function loadInsforge() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, ".insforge", "project.json"), "utf8")
  );
  return createAdminClient({ baseUrl: raw.oss_host, apiKey: raw.api_key });
}

type Link = { channel_id: string; platform: string; external_channel_id: string };

async function main() {
  const extraChannels = process.argv.slice(2);
  const env = loadEnvLocal();
  const defaultToken = process.env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN;
  if (!defaultToken) {
    console.error("DISCORD_BOT_TOKEN missing from .env.local");
    process.exit(1);
  }

  const insforge = loadInsforge();

  // ---- live config (refreshed every CONFIG_REFRESH_MS) ----
  let links: Link[] = [];
  let tokenByHub = new Map<string, string>(); // hub uuid → bot token
  const clients = new Map<string, Client>(); // token → gateway client
  const ourBotIds = new Set<string>();
  const backfilled = new Set<string>(); // discord channel ids already backfilled

  const tokenForHub = (hubId: string | undefined | null) =>
    (hubId && tokenByHub.get(hubId)) || defaultToken;
  const linksForHub = (hubId: string) =>
    links.filter((l) => l.channel_id === hubId);
  const hubForExternal = (externalId: string) =>
    links.find((l) => l.external_channel_id === externalId)?.channel_id ?? null;

  async function sendToDiscord(channelId: string, content: string, token: string) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    if (!res.ok) console.error(`  ✗ send → #${channelId}: HTTP ${res.status}`);
    else console.log(`  → relayed to discord #${channelId}`);
  }

  async function storeDiscordMessage(msg: {
    id: string;
    channelId: string;
    authorId?: string;
    authorName?: string;
    content: string;
    timestamp?: string;
    raw?: unknown;
  }) {
    const { error } = await insforge.database.from("platform_messages").insert([
      {
        platform: "discord",
        channel_id: msg.channelId,
        external_id: msg.id,
        author_id: msg.authorId ?? null,
        author_name: msg.authorName ?? null,
        content: msg.content,
        sent_at: msg.timestamp ?? null,
        raw: msg.raw ?? null,
      },
    ]);
    if (error && !/duplicate|unique/i.test(error.message || "")) {
      console.error("  ✗ insert failed:", error.message);
    }
    return !error;
  }

  async function handleInboundDiscord(msg: {
    id: string;
    channelId: string;
    authorId?: string;
    authorName?: string;
    content: string;
    timestamp?: string;
    raw?: unknown;
  }) {
    console.log(`💬 discord #${msg.channelId} [${msg.authorName ?? "?"}] ${msg.content}`);
    const fresh = await storeDiscordMessage(msg); // trigger → web UI instantly
    if (!fresh) return; // duplicate — already replicated
    // CROSS: replicate to the hub's other discord channels
    const hubId = hubForExternal(msg.channelId);
    if (!hubId) return;
    const siblings = linksForHub(hubId).filter(
      (l) => l.platform === "discord" && l.external_channel_id !== msg.channelId
    );
    if (siblings.length === 0) return;
    const relay = `🔁 **${msg.authorName ?? "someone"}**: ${msg.content}`;
    const token = tokenForHub(hubId);
    for (const s of siblings) await sendToDiscord(s.external_channel_id, relay, token);
  }

  function watchedChannelsFor(token: string): Set<string> {
    const set = new Set<string>();
    for (const l of links) {
      if (l.platform !== "discord") continue;
      if (tokenForHub(l.channel_id) === token) set.add(l.external_channel_id);
    }
    if (token === defaultToken) for (const c of extraChannels) set.add(c);
    return set;
  }

  async function ensureClient(token: string) {
    if (clients.has(token)) return;
    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });
    client.on(Events.ClientReady, (c) => {
      ourBotIds.add(c.user.id);
      console.log(`🤖 gateway up as ${c.user.tag} (${c.user.id})`);
    });
    client.on(Events.MessageCreate, (message) => {
      if (!watchedChannelsFor(token).has(message.channelId)) return;
      if (message.author?.id && ourBotIds.has(message.author.id)) return;
      void handleInboundDiscord({
        id: message.id,
        channelId: message.channelId,
        authorId: message.author?.id,
        authorName: message.author?.username,
        content: message.content ?? "",
        timestamp: message.createdAt?.toISOString(),
        raw: { id: message.id, channel_id: message.channelId },
      });
    });
    client.on(Events.Error, (err) => console.error("gateway error:", err.message));
    clients.set(token, client);
    try {
      await client.login(token);
    } catch (err) {
      console.error("✗ gateway login failed for a token:", (err as Error).message);
      clients.delete(token);
    }
  }

  async function backfillChannel(channelId: string, token: string) {
    if (backfilled.has(channelId)) return;
    backfilled.add(channelId);
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages?limit=50`, {
      headers: { Authorization: `Bot ${token}` },
    });
    if (!res.ok) return;
    const messages = (await res.json()) as Array<{
      id: string;
      channel_id: string;
      content?: string;
      timestamp?: string;
      author?: { id?: string; username?: string };
    }>;
    let n = 0;
    for (const m of messages.reverse()) {
      if (m.author?.id && ourBotIds.has(m.author.id)) continue;
      if (
        await storeDiscordMessage({
          id: m.id,
          channelId: m.channel_id || channelId,
          authorId: m.author?.id,
          authorName: m.author?.username,
          content: m.content ?? "",
          timestamp: m.timestamp,
          raw: m,
        })
      )
        n++;
    }
    if (n) console.log(`⤓ backfilled ${n} message(s) from #${channelId}`);
  }

  // ---- OUTBOUND: new web/voice rows → discord (3s poll; the InsForge
  // realtime socket only accepts user JWTs, not the admin key) ----
  let outboundWatermark = new Date().toISOString();
  const OUTBOUND_POLL_MS = 3_000;
  async function pumpOutbound() {
    try {
      const { data: rows } = await insforge.database
        .from("platform_messages")
        .select()
        .in("platform", ["web", "voice"])
        .gt("created_at", outboundWatermark)
        .order("created_at", { ascending: true })
        .limit(100);
      for (const row of (rows as Array<{
        created_at: string;
        platform: string;
        channel_id: string;
        author_name: string | null;
        content: string;
      }>) ?? []) {
        outboundWatermark = row.created_at;
        const targets = linksForHub(row.channel_id).filter((l) => l.platform === "discord");
        if (targets.length === 0) continue;
        const badge = row.platform === "voice" ? "🎙️" : "💬";
        const relay = `${badge} **${row.author_name ?? "someone"}**: ${row.content}`;
        console.log(`↪ fan-out (${row.platform}) → ${targets.length} channel(s)`);
        const token = tokenForHub(row.channel_id);
        for (const t of targets) await sendToDiscord(t.external_channel_id, relay, token);
      }
    } catch (err) {
      console.error("✗ outbound error:", (err as Error)?.message || err);
    }
  }
  setInterval(() => void pumpOutbound(), OUTBOUND_POLL_MS);

  async function refreshConfig() {
    try {
      const { data: linkRows } = await insforge.database.from("channel_links").select();
      links = (linkRows as Link[]) ?? [];

      const { data: chanRows } = await insforge.database.from("channels").select();
      const projectByHub = new Map(
        ((chanRows as { id: string; project_id: string }[]) ?? []).map((c) => [
          c.id,
          c.project_id,
        ])
      );
      const { data: settingRows } = await insforge.database.from("project_settings").select();
      const tokenByProject = new Map(
        ((settingRows as { project_id: string; discord_bot_token: string | null }[]) ?? [])
          .filter((s) => s.discord_bot_token)
          .map((s) => [s.project_id, s.discord_bot_token as string])
      );
      tokenByHub = new Map(
        [...projectByHub.entries()]
          .filter(([, projectId]) => tokenByProject.has(projectId))
          .map(([hub, projectId]) => [hub, tokenByProject.get(projectId)!])
      );

      // gateway clients for every token in play
      const tokens = new Set<string>([defaultToken, ...tokenByHub.values()]);
      for (const t of tokens) await ensureClient(t);

      // backfill newly-watched channels
      for (const t of tokens) {
        for (const channelId of watchedChannelsFor(t)) void backfillChannel(channelId, t);
      }

    } catch (err) {
      console.error("✗ config refresh error:", (err as Error)?.message || err);
    }
  }

  console.log(
    `Realtime replicator: Discord gateway inbound, 3s outbound pump; config refresh ${
      CONFIG_REFRESH_MS / 1000
    }s. Ctrl-C to stop.\n`
  );
  await refreshConfig();
  setInterval(() => void refreshConfig(), CONFIG_REFRESH_MS);
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
