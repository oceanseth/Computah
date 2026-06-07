import Link from "next/link";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono rounded-full border border-border bg-panel px-3 py-1 text-xs text-muted">
      {children}
    </span>
  );
}

export default function Landing() {
  return (
    <div className="relative">
      {/* glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] opacity-60"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 0%, rgba(94,234,212,0.18) 0%, rgba(94,234,212,0) 70%)",
        }}
      />

      {/* nav */}
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="mono text-lg font-semibold">
          <span className="text-accent">computah</span>
          <span className="text-muted">://</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted">
          <a href="#how" className="hidden hover:text-foreground sm:block">
            How it works
          </a>
          <a href="#stack" className="hidden hover:text-foreground sm:block">
            Stack
          </a>
          <Link href="/login" className="hidden hover:text-foreground sm:block">
            Sign in
          </Link>
          <Link
            href="/listen"
            className="rounded-lg bg-accent px-4 py-1.5 font-semibold text-background transition hover:opacity-90"
          >
            Open app ▸
          </Link>
        </div>
      </nav>

      {/* hero */}
      <header className="mx-auto w-full max-w-6xl px-6 pb-16 pt-12 text-center sm:pt-20">
        <div className="mb-5 flex justify-center gap-2">
          <Pill>InsForge Agentic Dev Tools Hackathon</Pill>
        </div>
        <h1 className="mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Platform-agnostic collaborative{" "}
          <span className="text-accent">coding agents</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted">
          Create a project, join its chat channel, and connect{" "}
          <span className="text-foreground">Discord, Slack, and voice</span> — every
          conversation replicates across every connected platform and drives the agents,
          and the agents report back everywhere your team already talks.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/listen"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Create a project ▸
          </Link>
          <a
            href="#how"
            className="rounded-xl border border-border bg-panel px-6 py-3 text-sm font-semibold transition hover:border-accent"
          >
            See how it works
          </a>
        </div>
        <div className="mono mt-6 text-xs text-muted">
          sign in with Google · voice in the browser · powered end-to-end by InsForge
        </div>
      </header>

      {/* product slideshow (HyperFrames render) */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
          <video
            src="/promo.mp4"
            autoPlay
            muted
            loop
            playsInline
            poster="/team.png"
            className="block w-full"
          />
        </div>
        <div className="mono mt-3 text-center text-xs text-muted">
          made with HeyGen HyperFrames
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          One project, one conversation — replicated everywhere your team already is.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Create a project",
              d: "Sign in with Google, create a project, and get a chat channel. Talk by typing or just speak — the browser transcribes your voice in real time.",
            },
            {
              n: "02",
              t: "Connect your platforms",
              d: "Link Discord channels and Slack servers as sources and destinations. Messages replicate between all of them, so the full context lives everywhere.",
            },
            {
              n: "03",
              t: "Drive the agents together",
              d: "The shared conversation steers coding agents. They do the work, verify it in a real browser, and report back to every connected channel.",
            },
          ].map((s) => (
            <div key={s.n} className="rounded-2xl border border-border bg-panel p-6">
              <div className="mono text-sm text-accent">{s.n}</div>
              <h3 className="mt-2 text-lg font-semibold">{s.t}</h3>
              <p className="mt-2 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* built on InsForge */}
      <section id="stack" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="rounded-3xl border border-border bg-panel/50 p-8 sm:p-10">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Built end-to-end on <span className="text-accent">InsForge</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted">
            The backend for agentic development — no servers, no setup.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "Auth",
                d: "Google and GitHub sign-in, with row-level security scoping every project, channel, and message to its members.",
              },
              {
                t: "Postgres",
                d: "Projects, channels, the unified cross-platform message inbox, and voice transcripts — one queryable store.",
              },
              {
                t: "AI",
                d: "Drives and judges the agents' browser verification, and distills conversations into memories.",
              },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-background p-6">
                <div className="mono text-accent">{c.t}</div>
                <p className="mt-2 text-sm text-muted">{c.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Strangers today. Building together tomorrow.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Bring your team — and your channels — and drive the agents together.
        </p>
        <Link
          href="/listen"
          className="mt-7 inline-block rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Create a project ▸
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mono mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted sm:flex-row">
          <span>
            <span className="text-accent">computah</span>:// platform-agnostic collaborative coding agents
          </span>
          <span>Built for the InsForge Agentic Dev Tools Hackathon · SF · Team Stackers 🚀</span>
        </div>
      </footer>
    </div>
  );
}
