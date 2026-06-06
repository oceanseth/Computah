import { NextRequest, NextResponse } from "next/server";
import { getInsforge } from "@/lib/insforge";
import { createReplica, getReplica, envCredentials, ReplicaCredentials } from "@/lib/replicas";

/**
 * Spawn + track replicants. The browser writes 'proposed'/'rejected' rows
 * directly (RLS); this route handles what needs server secrets:
 *   POST { id, userId }      → spawn the proposed replicant via the Replicas API
 *   GET  ?projectId&userId   → list rows, refreshing live statuses
 *
 * Hackathon auth note: userId comes from the client and is checked against
 * project membership server-side. Move to verified InsForge JWTs post-demo.
 */

async function membership(userId: string, projectId: string) {
  const insforge = getInsforge();
  const { data } = await insforge.database
    .from("project_members")
    .select()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  return Boolean((data as unknown[])?.length);
}

async function credsForProject(projectId: string): Promise<ReplicaCredentials | null> {
  const insforge = getInsforge();
  const { data } = await insforge.database
    .from("project_settings")
    .select()
    .eq("project_id", projectId);
  const row = (data as Array<{ replicas_api_key?: string; replicas_environment_id?: string }>)?.[0];
  const env = envCredentials();
  const apiKey = row?.replicas_api_key || env.apiKey;
  const environmentId = row?.replicas_environment_id || env.environmentId;
  if (!apiKey || !environmentId) return null;
  return { apiKey, environmentId };
}

export async function POST(req: NextRequest) {
  const { id, userId } = (await req.json()) as { id?: string; userId?: string };
  if (!id || !userId) return NextResponse.json({ error: "id and userId required" }, { status: 400 });

  const insforge = getInsforge();
  const { data: rows } = await insforge.database.from("replicants").select().eq("id", id);
  const replicant = (rows as Array<{
    id: string;
    project_id: string;
    name: string;
    message: string;
    coding_agent: string;
    status: string;
  }>)?.[0];
  if (!replicant) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await membership(userId, replicant.project_id))) {
    return NextResponse.json({ error: "not a project member" }, { status: 403 });
  }
  if (replicant.status !== "proposed") {
    return NextResponse.json({ error: `already ${replicant.status}` }, { status: 409 });
  }

  const creds = await credsForProject(replicant.project_id);
  if (!creds) {
    return NextResponse.json(
      {
        error:
          "Replicas not configured — set the Replicas API key + environment id in project settings (or REPLICAS_API_KEY / REPLICAS_ENVIRONMENT_ID env).",
      },
      { status: 501 }
    );
  }

  try {
    const replica = await createReplica(creds, {
      message: replicant.message,
      name: replicant.name,
      codingAgent: replicant.coding_agent,
    });
    await insforge.database
      .from("replicants")
      .update({
        status: replica.status || "spawning",
        replica_id: replica.id,
        url: replica.url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ ok: true, replica });
  } catch (err) {
    await insforge.database
      .from("replicants")
      .update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

const LIVE_STATUSES = new Set(["spawning", "running", "pending", "starting", "active"]);

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const userId = req.nextUrl.searchParams.get("userId");
  if (!projectId || !userId) {
    return NextResponse.json({ error: "projectId and userId required" }, { status: 400 });
  }
  if (!(await membership(userId, projectId))) {
    return NextResponse.json({ error: "not a project member" }, { status: 403 });
  }

  const insforge = getInsforge();
  const { data } = await insforge.database
    .from("replicants")
    .select()
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = (data as Array<{
    id: string;
    status: string;
    replica_id: string | null;
    updated_at: string;
  }>) ?? [];

  // refresh live statuses from the Replicas API (at most every 10s per row)
  const creds = await credsForProject(projectId);
  if (creds) {
    const stale = Date.now() - 10_000;
    for (const row of rows) {
      if (!row.replica_id || !LIVE_STATUSES.has(row.status)) continue;
      if (new Date(row.updated_at).getTime() > stale) continue;
      try {
        const live = await getReplica(creds, row.replica_id);
        if (live.status && live.status !== row.status) {
          row.status = live.status;
          await insforge.database
            .from("replicants")
            .update({ status: live.status, updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } catch {
        /* leave stale */
      }
    }
  }

  return NextResponse.json({ replicants: rows });
}
