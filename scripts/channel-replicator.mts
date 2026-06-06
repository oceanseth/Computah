/**
 * Computah channel replicator — bidirectional Discord ↔ platform_messages.
 *
 * Each project channel is a hub. `channel_links` rows declare its connected
 * destinations (Discord today; Slack/Maskord later). The replicator:
 *
 *   INBOUND   Discord messages from every linked channel → platform_messages
 *   OUTBOUND  web/voice messages posted in the hub → every linked Discord channel
 *   CROSS     Discord messages replicate to the hub's *other* linked channels
 *
 * Loop prevention: messages authored by the Computah bot itself are never
 * ingested, so relayed copies don't re-enter the pipeline.
 *
 * Usage:
 *   npx tsx scripts/channel-replicator.mts [extra-discord-channel-id ...]
 *
 * Needs DISCORD_BOT_TOKEN in .env.local; the bot must be in the server with
 * View Channels + Send Messages + Read Message History, and Message Content
 * Intent enabled. Links are re-read every cycle — connecting a channel in the
 * web UI starts replication within one poll, no restart.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLL_MS = 30_000;
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

type DiscordMessage = {
  id: string;
  channel_id: string;
  content?: string;
  timestamp?: string;
  author?: { id?: string; username?: string; bot?: boolean };
};
type Link = { channel_id: string; platform: string; external_channel_id: string };
type StoredMessage = {
  id: string;
  platform: string;
  channel_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
};

async function main() {
  const extraChannels = process.argv.slice(2);
  const env = loadEnvLocal();
  const botToken = process.env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN missing from .env.local");
    process.exit(1);
  }
  const discordHeaders = {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };

  // who am I — so relayed copies are never re-ingested
  const meRes = await fetch(`${DISCORD_API}/users/@me`, { headers: discordHeaders });
  if (!meRes.ok) {
    console.error(`Bot token rejected: HTTP ${meRes.status}`);
    process.exit(1);
  }
  const me = (await meRes.json()) as { id: string; username: string };
  console.log(`🤖 Replicating as ${me.username} (${me.id}); ${POLL_MS / 1000}s poll. Ctrl-C to stop.\n`);

  const insforge = loadInsforge();
  const inboundWatermarks = new Map<string, bigint>(); // discord channel → last snowflake
  let outboundWatermark = new Date().toISOString(); // only fan out rows newer than startup

  async function sendToDiscord(channelId: string, content: string) {
    const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: discordHeaders,
      body: JSON.stringify({ content: content.slice(0, 1900) }),
    });
    if (!res.ok) {
      console.error(`  ✗ send → #${channelId}: HTTP ${res.status}`);
    } else {
      console.log(`  → relayed to discord #${channelId}`);
    }
  }

  for (;;) {
    try {
      const { data: linkRows } = await insforge.database
        .from("channel_links")
        .select()
        .eq("platform", "discord");
      const links = (linkRows as Link[]) ?? [];
      const linkByExternal = new Map(links.map((l) => [l.external_channel_id, l]));

      // ---------------- INBOUND: linked discord channels → platform_messages
      const watchIds = new Set([
        ...links.map((l) => l.external_channel_id),
        ...extraChannels,
      ]);
      for (const channelId of watchIds) {
        const res = await fetch(
          `${DISCORD_API}/channels/${channelId}/messages?limit=50`,
          { headers: discordHeaders }
        );
        if (!res.ok) {
          console.error(`✗ read #${channelId}: HTTP ${res.status}`);
          continue;
        }
        const watermark = inboundWatermarks.get(channelId) ?? 0n;
        const all = (await res.json()) as DiscordMessage[];
        // advance the watermark over everything seen (incl. our own relays)
        const maxId = all.reduce((mx, m) => (BigInt(m.id) > mx ? BigInt(m.id) : mx), watermark);
        const fresh = all
          .filter((m) => BigInt(m.id) > watermark && m.author?.id !== me.id)
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        inboundWatermarks.set(channelId, maxId);
        for (const msg of fresh) {
          console.log(`💬 discord #${channelId} [${msg.author?.username ?? "?"}] ${msg.content}`);
          const { error } = await insforge.database.from("platform_messages").insert([
            {
              platform: "discord",
              channel_id: String(msg.channel_id || channelId),
              external_id: String(msg.id),
              author_id: msg.author?.id ? String(msg.author.id) : null,
              author_name: msg.author?.username ? String(msg.author.username) : null,
              content: String(msg.content ?? ""),
              sent_at: msg.timestamp ? String(msg.timestamp) : null,
              raw: msg,
            },
          ]);
          if (error && !/duplicate|unique/i.test(error.message || "")) {
            console.error("  ✗ insert failed:", error.message);
          }
        }
      }

      // -------- OUTBOUND + CROSS: new platform_messages → linked destinations
      const { data: newRows } = await insforge.database
        .from("platform_messages")
        .select()
        .gt("created_at", outboundWatermark)
        .order("created_at", { ascending: true })
        .limit(200);
      for (const row of (newRows as StoredMessage[]) ?? []) {
        outboundWatermark = row.created_at;
        let hubId: string | null = null;
        let sourceExternal: string | null = null;

        if (row.platform === "web" || row.platform === "voice") {
          hubId = row.channel_id; // hub uuid
        } else {
          const link = linkByExternal.get(row.channel_id);
          if (link) {
            hubId = link.channel_id;
            sourceExternal = row.channel_id;
          }
        }
        if (!hubId) continue;

        const targets = links.filter(
          (l) => l.channel_id === hubId && l.external_channel_id !== sourceExternal
        );
        if (targets.length === 0) continue;

        const badge = row.platform === "voice" ? "🎙️" : row.platform === "web" ? "💬" : "🔁";
        const relay = `${badge} **${row.author_name ?? "someone"}**: ${row.content}`;
        console.log(`↪ fan-out (${row.platform}) "${row.content.slice(0, 60)}" → ${targets.length} channel(s)`);
        for (const t of targets) await sendToDiscord(t.external_channel_id, relay);
      }
    } catch (err) {
      console.error("✗ cycle error:", (err as Error)?.message || err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
