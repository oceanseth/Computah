"use client";

import { createClient } from "@insforge/sdk";

/**
 * Browser-side InsForge client (anon key + user session). RLS enforces all
 * access — safe to use from client components. Server-only code keeps using
 * the admin client in src/lib/insforge.ts.
 */
let cached: ReturnType<typeof createClient> | null = null;

export function getInsforgeBrowser() {
  if (!cached) {
    cached = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY!,
    });
  }
  return cached;
}
