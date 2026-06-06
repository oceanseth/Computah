import { createAdminClient } from "@insforge/sdk";

/**
 * Server-side InsForge client (admin key). Never import this from client components.
 *
 * Powers three InsForge primitives for Computah:
 *   - database : stores verification sessions (table `verifications`)
 *   - storage  : stores per-step screenshots (bucket `computah-shots`)
 *   - ai       : vision model that drives the browser + judges pass/fail
 */
const baseUrl = process.env.INSFORGE_BASE_URL;
const apiKey = process.env.INSFORGE_API_KEY;

export const SHOTS_BUCKET = process.env.INSFORGE_BUCKET || "computah-shots";
export const VERIFICATIONS_TABLE = "verifications";

let cached: ReturnType<typeof createAdminClient> | null = null;

export function getInsforge() {
  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing InsForge config. Set INSFORGE_BASE_URL and INSFORGE_API_KEY in .env.local"
    );
  }
  if (!cached) {
    cached = createAdminClient({ baseUrl, apiKey, timeout: 60_000 });
  }
  return cached;
}

export function insforgeConfigured() {
  return Boolean(baseUrl && apiKey);
}
