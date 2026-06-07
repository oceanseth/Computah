import { Composio } from "@composio/core";

let cached: Composio | null = null;

/**
 * Server-only Composio client. Reads COMPOSIO_API_KEY from env.
 * Throws if the key is missing — callers should guard via `hasComposio()`.
 */
export function getComposio(): Composio {
  if (cached) return cached;
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is not set");
  }
  cached = new Composio({ apiKey });
  return cached;
}

export function hasComposio() {
  return Boolean(process.env.COMPOSIO_API_KEY);
}
