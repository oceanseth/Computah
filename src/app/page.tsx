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
          <a href="#mcp" className="hidden hover:text-foreground sm:block">
            For agents
          </a>
          <Link href="/login" className="hidden hover:text-foreground sm:block">
            Sign in
          </Link>
          <Link
            href="/app"
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
          conversation drives the agents, and the agents verify their own work in a{" "}
          <em>real</em> browser before reporting back to every connected platform.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/app"
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-background transition hover:opacity-90"
          >
            Create a project ▸
          </Link>
          <Link
            href="/console"
            className="rounded-xl border border-border bg-panel px-6 py-3 text-sm font-semibold transition hover:border-accent"
          >
            Verification console
          </Link>
          <a
            href="#how"
            className="rounded-xl border border-border bg-panel px-6 py-3 text-sm font-semibold transition hover:border-accent"
          >
            See how it works
          </a>
        </div>
        <div className="mono mt-6 text-xs text-muted">
          no setup · real Chromium · powered end-to-end by InsForge
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

      {/* the loop / demo narrative */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-20">
        <div className="overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl">
          <div className="mono flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
            <span className="flex gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-fail" />
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-[#f5c451]" />
              <i className="inline-block h-2.5 w-2.5 rounded-full bg-pass" />
            </span>
            computah — verification session
          </div>
          <div className="mono space-y-3 p-5 text-sm leading-relaxed">
            <p className="text-muted">
              <span className="text-accent">agent ▸</span> &quot;I built a login page.&quot;
            </p>
            <p>→ Computah opens it, types credentials, clicks <b>Sign in</b>, screenshots each step.</p>
            <p className="text-fail">
              ✗ FAIL — the button does nothing, no navigation, console error{" "}
              <code>handleSubmit is not defined</code>.
            </p>
            <p className="text-muted">
              <span className="text-accent">agent ▸</span> fixes it, re-runs Computah…
            </p>
            <p className="text-pass">✓ PASS — user reaches the secure area in 4 steps.</p>
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted">
          One call in, a trustworthy verdict out. Computah handles the browser, the reasoning, and
          the record.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Drive a real browser",
              d: "Playwright launches Chromium, navigates your URL, and tags every interactive element so the agent can click and type like a person.",
            },
            {
              n: "02",
              t: "Reason step by step",
              d: "An InsForge AI model reads a text snapshot of each page — title, visible text, elements, console errors — and picks one action at a time until it can judge the goal.",
            },
            {
              n: "03",
              t: "Return a verdict + replay",
              d: "PASS or FAIL with a reason and the console errors that mattered. Every step's screenshot is saved so you can replay exactly what happened.",
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
            The backend for agentic development — no servers, no setup. Computah uses three
            primitives.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              {
                t: "AI",
                d: "Reads each page and drives the browser, then judges whether the goal is actually met.",
              },
              {
                t: "Storage",
                d: "Stores a screenshot of every step in a public bucket, powering the session replay.",
              },
              {
                t: "Postgres",
                d: "Persists every verification — goal, verdict, steps, timing — queryable from the dashboard.",
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

      {/* for agents / MCP */}
      <section id="mcp" className="mx-auto w-full max-w-6xl px-6 pb-20">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">One tool call for any agent</h2>
            <p className="mt-3 text-muted">
              Computah ships as an MCP server, so Claude Code, Cursor, Devin and friends can verify
              their own work. Wire it once and let the agent confirm a change works before it
              reports done.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted">
              <li>✓ Returns a structured PASS / FAIL verdict</li>
              <li>✓ Surfaces the console errors that broke the goal</li>
              <li>✓ Links a full visual replay of the run</li>
            </ul>
            <Link
              href="/console"
              className="mono mt-6 inline-block text-sm text-accent hover:underline"
            >
              ▸ open the live console
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-panel">
            <div className="mono border-b border-border px-4 py-2 text-xs text-muted">
              agent → computah_verify
            </div>
            <pre className="mono overflow-x-auto p-5 text-xs leading-relaxed text-foreground">
{`computah_verify({
  url: "https://app.vercel.app/login",
  goal: "Log in with test@test.com / pw " +
        "and land on /dashboard"
})

// →
{
  "passed": false,
  "reason": "Login button does nothing; " +
            "console: handleSubmit is not defined",
  "replayUrl": "/sessions/abc123"
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-24 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">
          Stop shipping agent work you haven&apos;t seen run.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Give your agent eyes and hands. Let Computah prove it works.
        </p>
        <Link
          href="/console"
          className="mt-7 inline-block rounded-xl bg-accent px-7 py-3 text-sm font-semibold text-background transition hover:opacity-90"
        >
          Launch the console ▸
        </Link>
      </section>

      <footer className="border-t border-border">
        <div className="mono mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted sm:flex-row">
          <span>
            <span className="text-accent">computah</span>:// self-verifying computer for agents
          </span>
          <span>Built for the InsForge Agentic Dev Tools Hackathon · SF</span>
        </div>
      </footer>
    </div>
  );
}
