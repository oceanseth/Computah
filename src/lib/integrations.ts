/**
 * Shared metadata for every external integration the app speaks to.
 *
 * `commandKind` matches the `kind` column on `replicants` (and the LLM
 * detector's output) — so a "linear" detection can surface a card branded
 * with the Linear icon and the right verb.
 *
 * `channelLike` means the integration is a chat channel that we mirror into
 * a Computah channel via `channel_links` (Discord, Slack). The rest are
 * workspace OAuth connections that hang off the user via Composio.
 */

export type Integration = {
  id: string;
  label: string;
  description: string;
  commandKind: "agent" | "email" | "linear" | "slack" | "notion" | "attio" | null;
  // Composio auth_config env var (server-side only). undefined → not Composio-managed.
  composioAuthConfigEnv?: string;
  // True if connecting requires an external channel id (Discord, Slack).
  channelLike: boolean;
  // Display
  badge: string;
  brandClass: string; // tailwind text-color class for the icon swatch
};

export const INTEGRATIONS: Integration[] = [
  {
    id: "discord",
    label: "Discord",
    description: "Drive agents from a Discord channel.",
    commandKind: null,
    channelLike: true,
    badge: "🟣",
    brandClass: "text-[#5865F2]",
  },
  {
    id: "slack",
    label: "Slack",
    description: "Mirror a Slack channel and send replies from Computah.",
    commandKind: "slack",
    composioAuthConfigEnv: "COMPOSIO_AUTH_CONFIG_SLACK",
    channelLike: true,
    badge: "🟦",
    brandClass: "text-[#4A154B]",
  },
  {
    id: "gmail",
    label: "Gmail",
    description: "Compose emails from spoken commands.",
    commandKind: "email",
    composioAuthConfigEnv: "COMPOSIO_AUTH_CONFIG_GMAIL",
    channelLike: false,
    badge: "✉️",
    brandClass: "text-[#EA4335]",
  },
  {
    id: "linear",
    label: "Linear",
    description: "Open issues and assign tickets by voice.",
    commandKind: "linear",
    composioAuthConfigEnv: "COMPOSIO_AUTH_CONFIG_LINEAR",
    channelLike: false,
    badge: "📐",
    brandClass: "text-[#5E6AD2]",
  },
  {
    id: "notion",
    label: "Notion",
    description: "Drop notes and create pages from the transcript.",
    commandKind: "notion",
    composioAuthConfigEnv: "COMPOSIO_AUTH_CONFIG_NOTION",
    channelLike: false,
    badge: "📓",
    brandClass: "text-[#000000]",
  },
  {
    id: "attio",
    label: "Attio",
    description: "Log people, companies, and deals on the fly.",
    commandKind: "attio",
    composioAuthConfigEnv: "COMPOSIO_AUTH_CONFIG_ATTIO",
    channelLike: false,
    badge: "🧾",
    brandClass: "text-[#1F1F1F]",
  },
];

export function getIntegrationByKind(kind: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.commandKind === kind);
}

export function getIntegrationById(id: string): Integration | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

/** Server-only — reports which Composio auth configs are present in env. */
export function getComposioConfiguration() {
  return INTEGRATIONS.filter((i) => i.composioAuthConfigEnv).map((i) => ({
    id: i.id,
    label: i.label,
    configured: Boolean(process.env[i.composioAuthConfigEnv!]),
  }));
}
