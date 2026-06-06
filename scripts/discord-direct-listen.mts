/**
 * Discord → InsForge bridge (direct bot-token polling).
 *
 * Polls Discord's REST API with the Computah bot's token and lands every new
 * message in `platform_messages` — the unified inbox the web app's chat reads.
 *
 * Which channels: every `channel_links` row with platform='discord' (i.e.
 * whatever the team connects through the web UI), plus any channel ids passed
 * as CLI args. Links are re-read every poll, so connecting a channel in the
 * UI starts ingestion within one cycle — no restart.
 *
 * Why not the Composio trigger: Discord only allows reading channel history
 * with a bot token, and Composio's discordbot OAuth handshake kept failing;
 * this goes straight to Discord. Composio remains the layer for Slack and
 * outbound actions.
 *
 * Usage:
 *   npx tsx scripts/discord-direct-listen.mts [extra-channel-id ...]
 *
 * Needs DISCORD_BOT_TOKEN in .env.local and the bot installed in the server
 * with View Channels + Read Message History (+ Message Content Intent enabled
 * in the dev portal).
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createAdminClient } from "@insforge/sdk";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const POLL_MS = 30_000;

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

async function main() {
  const extraChannels = process.argv.slice(2);
  const env = loadEnvLocal();
  const botToken = process.env.DISCORD_BOT_TOKEN || env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error("DISCORD_BOT_TOKEN missing from .env.local");
    process.exit(1);
  }

  const insforge = loadInsforge();
  const watermarks = new Map<string, bigint>(); // channel id → last seen snowflake
  console.log(
    `Polling Discord every ${POLL_MS / 1000}s — channels from channel_links` +
      (extraChannels.length ? ` + [${extraChannels.join(", ")}]` : "") +
      ". Ctrl-C to stop.\n"
  );

  for (;;) {
    try {
      // channels to watch: UI-linked + CLI extras
      const { data: links } = await insforge.database
        .from("channel_links")
        .select()
        .eq("platform", "discord");
      const channelIds = new Set<string>([
        ...((links as { external_channel_id: string }[]) ?? []).map(
          (l) => l.external_channel_id
        ),
        ...extraChannels,
      ]);

      for (const channelId of channelIds) {
        const res = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
          { headers: { Authorization: `Bot ${botToken}` } }
        );
        if (!res.ok) {
          console.error(`✗ ${channelId}: HTTP ${res.status} ${await res.text().then((t) => t.slice(0, 120))}`);
          continue;
        }
        const watermark = watermarks.get(channelId) ?? 0n;
        const messages = ((await res.json()) as DiscordMessage[])
          .filter((m) => BigInt(m.id) > watermark)
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));

        for (const msg of messages) {
          watermarks.set(channelId, BigInt(msg.id));
          console.log(`💬 #${channelId} [${msg.author?.username ?? "?"}] ${msg.content}`);
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
          if (error) {
            const text = error.message || String(error);
            // unique(platform, external_id) makes re-delivery a no-op
            if (!/duplicate|unique/i.test(text)) console.error("  ✗ insert failed:", text);
          } else {
            console.log("  ✓ stored in platform_messages");
          }
        }
      }
    } catch (err) {
      console.error("✗ poll error:", (err as Error)?.message || err);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
