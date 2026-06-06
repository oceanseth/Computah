/**
 * Composio → Discord → InsForge bridge (dev listener).
 *
 * Reads a Discord channel through Composio's `discordbot` toolkit
 * (DISCORDBOT_LIST_MESSAGES) and lands every new message in the
 * `platform_messages` table — the unified inbox the main platform reads
 * alongside the voice-app's transcript_segments.
 *
 * Why discordbot and not the `discord` toolkit's poll trigger: Discord's REST
 * API only allows reading channel history with a BOT token. A user OAuth token
 * (the `discord` toolkit) gets 401 on /channels/{id}/messages, which kills
 * DISCORD_NEW_MESSAGE_TRIGGER. So we connect Composio's managed bot to the
 * server and poll the list-messages tool ourselves.
 *
 * Usage:
 *   npx tsx scripts/composio-discord-listen.mts <discord-channel-id>
 *
 * First run prints a Composio OAuth URL — open it and ADD THE BOT TO THE
 * SERVER that owns the channel (requires Manage Server permission there).
 * Production should move this loop into an InsForge schedule + edge function.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Composio } from "@composio/core";
import { createAdminClient } from "@insforge/sdk";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_ID = process.env.COMPOSIO_USER_ID || "computah-team";
const POLL_MS = 45_000;

// --- config: COMPOSIO_API_KEY from .env.local, InsForge from the linked project ---
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
  // Same trusted-local pattern as the voice-app: admin key from the project
  // file written by `npx @insforge/cli link`, never from source.
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

function extractMessages(data: unknown): DiscordMessage[] {
  if (Array.isArray(data)) return data as DiscordMessage[];
  if (data && typeof data === "object") {
    for (const v of Object.values(data)) {
      if (Array.isArray(v) && v.every((m) => m && typeof m === "object" && "id" in m)) {
        return v as DiscordMessage[];
      }
    }
  }
  return [];
}

async function main() {
  const channelId = process.argv[2];
  if (!channelId) {
    console.error("Usage: npx tsx scripts/composio-discord-listen.mts <discord-channel-id>");
    process.exit(1);
  }

  const env = loadEnvLocal();
  const apiKey = process.env.COMPOSIO_API_KEY || env.COMPOSIO_API_KEY;
  if (!apiKey) {
    console.error("COMPOSIO_API_KEY missing from .env.local");
    process.exit(1);
  }

  const composio = new Composio({ apiKey });
  const insforge = loadInsforge();

  // 1. Ensure a live discordbot connection (bot installed in the server).
  let accountId: string;
  const existing = await composio.connectedAccounts.list({
    userIds: [USER_ID],
    toolkitSlugs: ["discordbot"],
    statuses: ["ACTIVE"],
  });
  if (existing.items.length > 0) {
    accountId = existing.items[0].id;
    console.log(`✅ Using existing discordbot connection (${accountId}).`);
  } else {
    console.log(`No active discordbot connection for "${USER_ID}" — starting OAuth…`);
    const configs = await composio.authConfigs.list({ toolkit: "discordbot" });
    let authConfig = configs.items.find((c) => c.status === "ENABLED") ?? configs.items[0];
    if (!authConfig) {
      authConfig = await composio.authConfigs.create("discordbot", {
        type: "use_composio_managed_auth",
        name: "Discord Bot Auth Config",
      });
    }
    const request = await composio.connectedAccounts.link(USER_ID, authConfig.id);
    console.log(
      `\nOpen this URL and ADD THE BOT to the server that owns the channel` +
        ` (needs Manage Server there):\n\n  ${request.redirectUrl}\n`
    );
    const account = await request.waitForConnection(9 * 60 * 1000); // link expires at 10 min
    accountId = account.id;
    console.log("✅ Discord bot connected.");
  }

  // 2. Poll loop: list messages, keep a snowflake watermark, insert new rows.
  //    First poll backfills the latest batch (dedup makes re-runs no-ops).
  console.log(`Listening on channel ${channelId} (${POLL_MS / 1000}s poll). Ctrl-C to stop.\n`);
  let watermark = 0n;
  let firstPoll = true;
  for (;;) {
    try {
      const result = await composio.tools.execute("DISCORDBOT_LIST_MESSAGES", {
        userId: USER_ID,
        connectedAccountId: accountId,
        // manual (non-agent) execution requires a version; track latest
        dangerouslySkipVersionCheck: true,
        arguments: { channel_id: channelId, limit: 50 },
      });
      if (!result.successful) {
        console.error("✗ list messages failed:", JSON.stringify(result.error).slice(0, 300));
      } else {
        const messages = extractMessages(result.data)
          .filter((m) => BigInt(m.id) > watermark)
          .sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
        for (const msg of messages) {
          watermark = BigInt(msg.id);
          console.log(`💬 [${msg.author?.username || msg.author?.id || "?"}] ${msg.content}`);
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
        if (firstPoll) {
          console.log(`(backfilled ${messages.length} message(s) on first poll)`);
          firstPoll = false;
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
