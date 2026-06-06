# Computah 🖥️

**The self-verifying computer for coding agents.**

Your agent ships a change. Computah opens it in a *real* browser, drives it like a QA
tester toward a plain-English goal, watches for console errors, and returns a **PASS/FAIL
verdict the agent can act on** — closing the build → test → fix loop without a human.

Built for the **InsForge Agentic Dev Tools Hackathon**. The entire backend runs on InsForge:

| InsForge primitive | What Computah uses it for                                |
| ------------------ | -------------------------------------------------------- |
| **AI**             | Reads a text snapshot of the page → drives + judges it   |
| **Storage**        | Per-step screenshots (`computah-shots` bucket) for replay |
| **Postgres**       | Verification sessions (`verifications` table)            |

```
Coding agent (Claude Code / Cursor / Devin)
      │  MCP tool: computah_verify({ url, goal })
      ▼
Computah MCP server ──HTTP──► Next.js /api/verify
                                   │
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                      ▼
     Playwright (Chromium)   InsForge AI          InsForge Storage + DB
   open · click · type ·   look at screenshot,   screenshots + full
   screenshot each step    pick next action,     session for replay
                           judge the goal
                                   │
                                   ▼
                      Dashboard: live session replay + verdict
```

## The demo

> Agent: *"I built a login page."*
> → Computah opens it, types credentials, clicks **Sign in**, screenshots the result.
> → InsForge AI: *"FAIL — the button does nothing, no navigation, console error `handleSubmit is not defined`."*
> → Agent fixes it, re-runs Computah → **PASS**.

## Setup

1. **InsForge project.** Create one at [insforge.dev](https://insforge.dev) (or self-host).
   Grab the **Base URL** and **Admin API key**.

2. **Schema + bucket.** In the InsForge SQL editor run [`scripts/schema.sql`](scripts/schema.sql),
   then create a **public** storage bucket named `computah-shots`.

3. **Env.** Copy `.env.example` → `.env.local` and fill it in:
   ```bash
   cp .env.example .env.local
   ```

4. **Install + run.**
   ```bash
   npm install
   npx playwright install chromium   # local browser
   npm run dev                       # http://localhost:3000
   ```

Open http://localhost:3000, pick an example, and hit **Verify**.

## Use it from a coding agent (MCP)

Run the MCP server (it calls the Computah app over HTTP):

```bash
npm run mcp
```

Register it with your agent. For **Claude Code** (`.mcp.json`):

```jsonc
{
  "mcpServers": {
    "computah": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"],
      "env": { "COMPUTAH_URL": "http://localhost:3000" }
    }
  }
}
```

Then your agent can call:

```
computah_verify({
  url: "http://localhost:3000/login",
  goal: "Log in with test@test.com / password and land on /dashboard"
})
```

It returns a verdict, the console errors, and a replay link.

## Deploy (Vercel)

The dashboard + API deploy to Vercel. Playwright on serverless uses
`@sparticuz/chromium` (auto-selected when `VERCEL=1`). Set the same env vars in the
Vercel project.

```bash
vercel --prod
```

For heavier browser workloads, point `/api/verify` at a dedicated browser worker — the
engine in `src/lib/verify.ts` is transport-agnostic.

## Layout

```
src/lib/insforge.ts        InsForge admin client (DB · Storage · AI)
src/lib/verify.ts          The verification engine (Playwright agent loop)
src/app/api/verify         POST → run a verification
src/app/api/sessions       GET  → list / fetch sessions
src/app/page.tsx           Run console + recent sessions
src/app/sessions/[id]      Session replay player
mcp/server.ts              MCP tool: computah_verify
scripts/schema.sql         InsForge table definition
```
