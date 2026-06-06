"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getInsforgeBrowser } from "@/lib/insforge-client";
import { useAuth } from "@/lib/auth-context";

export default function SignupPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const insforge = getInsforgeBrowser();
    const { data, error } = await insforge.auth.signUp({ email, password, name });
    setBusy(false);
    if (error) {
      setError(error.message || "Sign up failed");
      return;
    }
    if (data?.requireEmailVerification) {
      setStep("verify"); // backend uses 6-digit code verification
    } else if (data?.accessToken) {
      await refresh();
      router.push("/app");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const insforge = getInsforgeBrowser();
    const { error } = await insforge.auth.verifyEmail({ email, otp });
    setBusy(false);
    if (error) {
      setError(
        error.statusCode === 400 ? "Invalid or expired code" : error.message
      );
      return;
    }
    // verifyEmail saves the session — user is signed in
    await refresh();
    router.push("/app");
  }

  async function resend() {
    setError(null);
    await getInsforgeBrowser().auth.resendVerificationEmail({ email });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="mono mb-8 text-lg font-semibold">
        <span className="text-accent">computah</span>
        <span className="text-muted">://</span>
      </Link>

      {step === "form" ? (
        <>
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-1 text-sm text-muted">
            Then create a project and bring your team — Discord, Slack, voice.
          </p>
          <form onSubmit={handleSignUp} className="mt-8 flex flex-col gap-3">
            <input
              required
              placeholder="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg border border-border bg-panel px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
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
              minLength={6}
              placeholder="password (6+ chars)"
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
              {busy ? "Creating…" : "Sign up"}
            </button>
          </form>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="mt-1 text-sm text-muted">
            We sent a 6-digit code to <span className="text-foreground">{email}</span>.
          </p>
          <form onSubmit={handleVerify} className="mt-8 flex flex-col gap-3">
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="mono rounded-lg border border-border bg-panel px-4 py-2.5 text-center text-lg tracking-[0.5em] outline-none focus:border-accent"
            />
            {error && <p className="text-sm text-fail">{error}</p>}
            <button
              type="submit"
              disabled={busy || otp.length !== 6}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & sign in"}
            </button>
            <button
              type="button"
              onClick={resend}
              className="text-sm text-muted hover:text-foreground"
            >
              Resend code
            </button>
          </form>
        </>
      )}

      <p className="mt-8 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
