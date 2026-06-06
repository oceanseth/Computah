"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useAuth } from "@/lib/auth-context";

type Project = { id: string; name: string; owner_id: string; created_at: string };

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const insforge = getInsforgeBrowser();
    const { data } = await insforge.database
      .from("projects")
      .select()
      .order("created_at", { ascending: false });
    setProjects((data as Project[]) ?? []);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void load();
  }, [loading, user, router, load]);

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    const insforge = getInsforgeBrowser();

    const { data: created, error: projErr } = await insforge.database
      .from("projects")
      .insert([{ name, owner_id: user.id }])
      .select();
    if (projErr || !created?.[0]) {
      setError(projErr?.message || "Could not create project");
      setBusy(false);
      return;
    }
    const project = created[0] as Project;

    // owner membership + default channel
    await insforge.database
      .from("project_members")
      .insert([{ project_id: project.id, user_id: user.id, role: "owner" }]);
    await insforge.database
      .from("channels")
      .insert([{ project_id: project.id, name: "general" }]);

    setName("");
    setBusy(false);
    router.push(`/app/projects/${project.id}`);
  }

  if (loading || !user) {
    return (
      <main className="flex flex-1 items-center justify-center text-muted">
        loading…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="mono text-lg font-semibold">
          <span className="text-accent">computah</span>
          <span className="text-muted">://app</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-muted">
          <Link href="/app/voice" className="hover:text-foreground">
            🎙️ Voice
          </Link>
          <span>{user.email}</span>
          <button onClick={() => void signOut().then(() => router.push("/"))} className="hover:text-foreground">
            Sign out
          </button>
        </div>
      </header>

      <h1 className="text-2xl font-semibold">Projects</h1>
      <p className="mt-1 text-sm text-muted">
        Each project gets chat channels you can connect to Discord, Slack, and voice.
      </p>

      <form onSubmit={createProject} className="mt-6 flex gap-2">
        <input
          required
          placeholder="new project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-fail">{error}</p>}

      <div className="mt-8 flex flex-col gap-3">
        {projects.length === 0 && (
          <p className="text-sm text-muted">No projects yet — create your first one above.</p>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/app/projects/${p.id}`}
            className="rounded-xl border border-border bg-panel px-5 py-4 transition hover:border-accent"
          >
            <div className="font-semibold">{p.name}</div>
            <div className="mono mt-1 text-xs text-muted">
              created {new Date(p.created_at).toLocaleDateString()}
              {p.owner_id === user.id && " · you own this"}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
