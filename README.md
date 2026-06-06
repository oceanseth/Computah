# Computah 🖥️

**Platform-agnostic collaborative coding agents.**

🌐 **Live:** [computah-mu.vercel.app](https://computah-mu.vercel.app)

Computah brings people together to drive coding agents — from whatever platform
they already talk on. Create a project in the web app, join its chat channel, then
connect **Discord** channels, **Slack** servers (and soon **Maskord**) as
source/destination platforms: every message flows into one shared conversation
that steers the agents, and the agents report back to every connected channel.

The pieces:

- **Web app** ([computah-mu.vercel.app](https://computah-mu.vercel.app)) — create a
  project, join its chat channel, connect external platforms *(in progress —
  currently the verification console)*
- **Messaging bridge** — Composio-powered ingestion: Discord/Slack messages land
  in a unified `platform_messages` inbox that drives the agents
- **Voice app** (`voice-app/`, Electron) — always-listening transcription that
  turns spoken conversation into agent-driving signal, the same way
- **Verification engine** — agents check their own work: Computah opens the
  change in a *real* browser, drives it like a QA tester toward a plain-English
  goal, watches for console errors, and returns a **PASS/FAIL verdict the agent
  can act on** — closing the build → test → fix loop without a human

Built for the **InsForge Agentic Dev Tools Hackathon**. The entire backend runs on InsForge:

| InsForge primitive | What Computah uses it for                                |
| ------------------ | -------------------------------------------------------- |
| **AI**             | Reads a text snapshot of the page → drives + judges it   |
| **Storage**        | Per-step screenshots (`computah-shots` bucket) for replay |
| **Postgres**       | Verification sessions (`verifications`), the cross-platform message inbox (`platform_messages`), and the voice app's `sessions` / `transcript_segments` / `memories` |

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

## The team

Built by **Team Stackers** at the **InsForge Agentic Dev Tools Hackathon** —
strangers on day 1, shipping by day's end.

![Team Stackers — conversation. code. collaborate.](public/team.png)

| | |
| --- | --- |
| **Abhishek Jani** | [LinkedIn](https://www.linkedin.com/in/abhishek-jani-97b8781a7/) |
| **Seth Caldwell** | [LinkedIn](https://www.linkedin.com/in/sethinsd) |
| **Abir Biswas** | [LinkedIn](https://www.linkedin.com/in/abir-biswas/) |
| **Pranav Uppiliappan** | [LinkedIn](https://www.linkedin.com/in/pranav-uppiliappan/) |
| **Ayush Jain** | [LinkedIn](https://www.linkedin.com/in/ayush-jain-uiuc) |

## How we used the sponsors

| Sponsor | What it powers |
| --- | --- |
| **InsForge** | The entire backend — Postgres (verification sessions), Storage (per-step screenshots), and the AI gateway that drives + judges the browser. |
| **Composio** | OAuth + tool execution for the messaging layer — connecting **Discord** and **Slack** (and **Maskord**, once it lands on Composio) as source/destination platforms so people can drive the agents together. |
| **Anthropic** | The Claude Agent SDK runs the agent loop behind the voice app. |
| **Deepgram** | Real-time voice transcription — the voice app turns spoken prompts into agent actions. |
| **Limrun** | Built the mobile version of the app. |
| **Memoir** | Posted about the project on X and LinkedIn. |
| **Vercel** | Hosts the live app at [computah-mu.vercel.app](https://computah-mu.vercel.app). |

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
scripts/schema.sql         InsForge table definition (verifications)
migrations/                InsForge migrations (platform_messages inbox)
scripts/composio-discord-listen.mts
                           Composio bridge: Discord channel → platform_messages
voice-app/                 Electron voice app (submodule): speech → transcript → memories
```

## Roadmap

- [ ] Projects + chat channels in the web app (create a project, invite people, talk to the agents)
- [ ] Discord/Slack channel linking from the UI (the Composio bridge already lands messages in `platform_messages`)
- [ ] Outbound fan-out: agent + human messages broadcast to every connected platform
- [ ] Maskord support when it lands on Composio
- [ ] Fold the voice app into the same project/channel model
