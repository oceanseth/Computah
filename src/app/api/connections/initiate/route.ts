import { NextRequest, NextResponse } from "next/server";
import { getComposio, hasComposio } from "@/lib/composio";
import { getIntegrationById } from "@/lib/integrations";

/**
 * Starts the Composio OAuth flow for a given integration. The browser
 * redirects to the returned `redirectUrl`; Composio handles the callback
 * and marks the connected account ACTIVE.
 *
 * Hackathon auth note: userId comes from the client (same pattern as
 * /api/replicants). Replace with a verified JWT post-demo.
 */
export async function POST(req: NextRequest) {
  const { integrationId, userId } = (await req.json()) as {
    integrationId?: string;
    userId?: string;
  };
  if (!integrationId || !userId) {
    return NextResponse.json(
      { error: "integrationId and userId required" },
      { status: 400 }
    );
  }

  const meta = getIntegrationById(integrationId);
  if (!meta || !meta.composioAuthConfigEnv) {
    return NextResponse.json(
      { error: `${integrationId} is not a Composio-managed integration` },
      { status: 400 }
    );
  }
  const authConfigId = process.env[meta.composioAuthConfigEnv];
  if (!authConfigId) {
    return NextResponse.json(
      {
        error: `${meta.composioAuthConfigEnv} is not set. Add it to .env.local and restart the dev server.`,
      },
      { status: 412 }
    );
  }
  if (!hasComposio()) {
    return NextResponse.json(
      { error: "COMPOSIO_API_KEY is not set" },
      { status: 412 }
    );
  }

  try {
    const composio = getComposio();
    // Composio replaced `initiate()` with `link()` (same shape) — old method
    // is being sunset 2026-07-03.
    const connection = await composio.connectedAccounts.link(
      userId,
      authConfigId
    );
    return NextResponse.json({
      id: connection.id,
      status: connection.status,
      redirectUrl: connection.redirectUrl ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "composio link failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
