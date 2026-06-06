"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useAuth } from "@/lib/auth-context";

const OAUTH_PROVIDERS = ["google", "github"] as const;

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const insforge = getInsforgeBrowser();
    const { error } = await insforge.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.statusCode === 403
          ? "Email not verified — sign up again to get a new code."
          : error.message || "Sign in failed"
      );
      setBusy(false);
      return;
    }
    await refresh();
    router.push("/app");
  }

  async function handleOAuth(provider: (typeof OAUTH_PROVIDERS)[number]) {
    const insforge = getInsforgeBrowser();
    await insforge.auth.signInWithOAuth(provider, {
      redirectTo: `${window.location.origin}/app`,
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="mono mb-8 text-lg font-semibold">
        <span className="text-accent">computah</span>
        <span className="text-muted">://</span>
      </Link>
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-muted">
        Drive coding agents together, from any platform.
      </p>

      <form onSubmit={handleSignIn} className="mt-8 flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="you@team.dev"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-fail">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-2">
        {OAUTH_PROVIDERS.map((p) => (
          <button
            key={p}
            onClick={() => handleOAuth(p)}
            className="rounded-lg border border-border bg-panel px-4 py-2.5 text-sm font-semibold capitalize transition hover:border-accent"
          >
            Continue with {p}
          </button>
        ))}
      </div>

      <p className="mt-8 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </main>
  );
}
