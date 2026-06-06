/**
 * Composio → Discord → InsForge bridge (dev listener).
 *
 * Polls a Discord channel through Composio's DISCORD_NEW_MESSAGE_TRIGGER and
 * lands every new message in the `platform_messages` table — the unified inbox
 * the main platform reads alongside the voice-app's transcript_segments.
 *
 * Usage:
 *   npx tsx scripts/composio-discord-listen.mts <discord-channel-id>
 *
 * (Discord: Settings → Advanced → Developer Mode, then right-click the
 *  channel → Copy Channel ID.)
 *
 * First run prints a Composio OAuth URL — open it and authorize Discord.
 * This script uses the SDK subscription (dev mode); production should point a
 * Composio webhook at an InsForge edge function instead.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Composio } from "@composio/core";
import { createAdminClient } from "@insforge/sdk";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const USER_ID = process.env.COMPOSIO_USER_ID || "computah-team";

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

  // 1. Ensure a live Discord connection for our team user.
  const existing = await composio.connectedAccounts.list({
    userIds: [USER_ID],
    toolkitSlugs: ["discord"],
    statuses: ["ACTIVE"],
  });
  if (existing.items.length === 0) {
    console.log(`No active Discord connection for "${USER_ID}" — starting OAuth…`);
    const request = await composio.toolkits.authorize(USER_ID, "discord");
    console.log(`\nOpen this URL and authorize Discord:\n\n  ${request.redirectUrl}\n`);
    await request.waitForConnection();
    console.log("✅ Discord connected.");
  } else {
    console.log(`✅ Using existing Discord connection (${existing.items[0].id}).`);
  }

  // 2. Point the trigger at the channel (poll every minute, the floor).
  const { triggerId } = await composio.triggers.create(
    USER_ID,
    "DISCORD_NEW_MESSAGE_TRIGGER",
    { triggerConfig: { channel_id: channelId, interval: 1 } }
  );
  console.log(`✅ Trigger ${triggerId} watching channel ${channelId} (1-min poll).`);

  // 3. Stream events → platform_messages.
  console.log("Listening… post a message in the Discord channel. Ctrl-C to stop.\n");
  await composio.triggers.subscribe(
    async (event) => {
      const payload = (event as { payload?: Record<string, unknown> }).payload ?? event;
      const msg = (payload as { message?: Record<string, unknown> }).message;
      if (!msg?.message_id) {
        console.log("· event without message payload:", JSON.stringify(payload).slice(0, 200));
        return;
      }
      console.log(`💬 [${msg.username || msg.author_id}] ${msg.content}`);
      const { error } = await insforge.database.from("platform_messages").insert([
        {
          platform: "discord",
          channel_id: String(msg.channel_id),
          external_id: String(msg.message_id),
          author_id: msg.author_id ? String(msg.author_id) : null,
          author_name: msg.username ? String(msg.username) : null,
          content: String(msg.content ?? ""),
          sent_at: msg.timestamp ? String(msg.timestamp) : null,
          raw: payload,
        },
      ]);
      if (error) {
        const text = error.message || String(error);
        // unique(platform, external_id) makes re-delivery a no-op
        if (/duplicate|unique/i.test(text)) return;
        console.error("  ✗ insert failed:", text);
      } else {
        console.log("  ✓ stored in platform_messages");
      }
    },
    { triggerId }
  );
}

main().catch((err) => {
  console.error("Fatal:", err?.message || err);
  process.exit(1);
});
