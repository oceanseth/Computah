"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getInsforgeBrowser } from "./insforge-client";
import { useAuth } from "./auth-context";

/**
 * Project context for the (app) shell. Auth-gates the page, then ensures the
 * user has a project (auto-provisions "Default Workspace" + #general on first
 * visit) and returns the hub channel + its platform links. Backend failures
 * surface through `error` — `ready` always resolves, never stranding pages on
 * a loading state.
 */

export type Project = { id: string; name: string; owner_id: string };
export type Channel = { id: string; project_id: string; name: string };
export type ChannelLink = {
  id: string;
  channel_id: string;
  platform: string;
  external_channel_id: string;
};

export function useProject() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [hub, setHub] = useState<Channel | null>(null);
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    const db = getInsforgeBrowser().database;
    try {
      const { data: projects, error: projErr } = await db
        .from("projects")
        .select()
        .order("created_at", { ascending: true })
        .limit(1);
      if (projErr) throw new Error(projErr.message || "projects query failed");
      let proj = (projects as Project[] | null)?.[0] ?? null;
      if (!proj) {
        const { data: created, error: createErr } = await db
          .from("projects")
          .insert([{ name: "Default Workspace", owner_id: user.id }])
          .select();
        if (createErr) throw new Error(createErr.message || "project create failed");
        proj = (created as Project[] | null)?.[0] ?? null;
        if (!proj) throw new Error("project create returned no row");
        await db
          .from("project_members")
          .insert([{ project_id: proj.id, user_id: user.id, role: "owner" }]);
        await db.from("channels").insert([{ project_id: proj.id, name: "general" }]);
      }
      setProject(proj);
      const { data: chans } = await db
        .from("channels")
        .select()
        .eq("project_id", proj.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const channel = (chans as Channel[] | null)?.[0] ?? null;
      setHub(channel);
      if (channel) {
        const { data: linkRows } = await db
          .from("channel_links")
          .select()
          .eq("channel_id", channel.id);
        setLinks((linkRows as ChannelLink[]) ?? []);
      }
      setError(null);
    } catch (err) {
      setError(
        (err as Error)?.message ||
          "Could not reach the backend — check your connection and refresh."
      );
    } finally {
      setReady(true); // never strand the page on "loading…"
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void refresh();
  }, [loading, user, router, refresh]);

  return { user, loading, project, hub, links, ready, error, refresh };
}
