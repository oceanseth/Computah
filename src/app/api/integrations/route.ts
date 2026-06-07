import { NextResponse } from "next/server";
import { INTEGRATIONS, getComposioConfiguration } from "@/lib/integrations";

/**
 * Reports each integration's metadata plus whether the Composio auth config
 * env var has a value. Used by the /connections page to render correct
 * "configured / needs key" badges without exposing the configs themselves.
 */
export async function GET() {
  const composio = Object.fromEntries(
    getComposioConfiguration().map((c) => [c.id, c.configured])
  );
  return NextResponse.json({
    composioApiKeyConfigured: Boolean(process.env.COMPOSIO_API_KEY),
    integrations: INTEGRATIONS.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
      channelLike: i.channelLike,
      commandKind: i.commandKind,
      composioConfigured: i.composioAuthConfigEnv ? Boolean(composio[i.id]) : null,
    })),
  });
}
