import * as SecureStore from "expo-secure-store";

/**
 * Always Listening Mobile — runtime config.
 *
 * Keys can be baked in at build time via EXPO_PUBLIC_* env vars (handy for a
 * Limrun cloud build/demo) and/or entered in the in-app Settings screen, which
 * persists them to the device keychain via expo-secure-store.
 */
export type Settings = {
  insforgeUrl: string;
  insforgeKey: string;
  deepgramKey: string;
  understandingModel: string;
};

const KEYS: Record<keyof Settings, string> = {
  insforgeUrl: "al_insforge_url",
  insforgeKey: "al_insforge_key",
  deepgramKey: "al_deepgram_key",
  understandingModel: "al_understanding_model",
};

export const DEFAULTS: Settings = {
  insforgeUrl: process.env.EXPO_PUBLIC_INSFORGE_URL ?? "",
  insforgeKey: process.env.EXPO_PUBLIC_INSFORGE_KEY ?? "",
  deepgramKey: process.env.EXPO_PUBLIC_DEEPGRAM_KEY ?? "",
  understandingModel:
    process.env.EXPO_PUBLIC_UNDERSTANDING_MODEL ?? "openai/gpt-4o-mini",
};

export async function loadSettings(): Promise<Settings> {
  const entries = await Promise.all(
    (Object.keys(KEYS) as (keyof Settings)[]).map(async (k) => {
      // A value baked in at build time (EXPO_PUBLIC_*) is authoritative — it
      // wins over anything previously saved on the device. Keys that were not
      // baked fall back to the device keychain, then to "".
      if (DEFAULTS[k]) return [k, DEFAULTS[k]] as const;
      const stored = await SecureStore.getItemAsync(KEYS[k]);
      return [k, stored ?? ""] as const;
    })
  );
  return Object.fromEntries(entries) as Settings;
}

export async function saveSettings(s: Settings): Promise<void> {
  await Promise.all(
    (Object.keys(KEYS) as (keyof Settings)[]).map((k) =>
      SecureStore.setItemAsync(KEYS[k], s[k] ?? "")
    )
  );
}

export function isConfigured(s: Settings): { insforge: boolean; deepgram: boolean } {
  return {
    insforge: Boolean(s.insforgeUrl && s.insforgeKey),
    deepgram: Boolean(s.deepgramKey),
  };
}
