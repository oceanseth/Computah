OAuth from the Electron Connections page:

// In G-Brain
POST /api/connections/initiate { userId, app }
  → composio.connections.initiate({ userId, app })
  → returns { redirectUrl, connectionId }
  → insert pending row in Insforge.connections
  → respond { redirectUrl, connectionId }

// In Electron
shell.openExternal(redirectUrl)        // OS browser, simpler than in-app BrowserWindow
// poll GET /api/connections?userId=... every 2s until target app is 'active'
// (or wire a Composio webhook → SSE for instant update; skip for v1)

End-to-end execution on approve:

POST /api/confirm { pendingActionId, decision }
  → if approve:
      composio.tools.execute({ userId, action: tool, params: args })
      mark executed
      SSE: action_executed
  → if reject:
      mark rejected
      SSE: action_rejected

- SDK: @composio/core + Anthropic adapter (exact package name verified at install).
- Pre-demo: wire Gmail OAuth end-to-end on the clock. Linear/Notion/Slack are pre-connected by the demo user beforehand so we can show multi-tool routing without burning build time on three OAuth flows.

---

3. Data flow (the canonical trace)

Voice prompt: "File a Linear ticket to fix the login redirect bug on mobile, high priority."

1. Renderer mic → AudioWorklet → main IPC → Deepgram WS.
2. Deepgram emits partials → IPC → renderer (live transcript ribbon updates).
3. Deepgram emits is_final && speech_final → renderer POSTs to /api/signal:
{ "userId": "demo-user-001", "text": "File a Linear ticket to fix the login redirect bug on mobile, high priority.", "ts": "2026-06-06T15:04:00Z" }
4. /api/signal:
5. Append to rolling window.
6. Fetch Composio tools for this user (filtered to connected apps).
7. Call anthropic.messages.create({ model: 'claude-sonnet-4-6', tools, messages: [...] }).
8. Claude returns tool_use for LINEAR_CREATE_ISSUE with { title, description, priority: 'high', team: ... }.
9. Insforge: insert into pending_actions with tool='LINEAR_CREATE_ISSUE', args, status='pending'.
10. Emit { type: 'proposed_action', id, tool, summary, args } on SSE.
11. Desktop renderer renders a card: "Linear → Create Issue: 'Fix login redirect on mobile'" with Approve / Reject.
12. User clicks Approve → renderer POSTs /api/confirm { id, decision: 'approve' }.
13. /api/confirm:
14. Mark pending action approved.
15. composio.tools.execute({ userId, action: 'LINEAR_CREATE_ISSUE', params: args }).
16. Update status to executed, store Composio response.
17. Emit { type: 'action_executed', id, result: { issueUrl } } on SSE.
18. Desktop renderer flips card to "✅ Created — link to issue".

A second utterance later: "Email Sarah the link to that ticket." — Claude has the previous tool_use in its rolling window, knows the issue URL, and produces a GMAIL_SEND_EMAIL tool_use. Same flow, different tool. This is what the demo sells.

---

4. Repo layout

Computah/
├── desktop/                # Nextron app (Electron + Next.js renderer)
│   ├── main/               # main-process entry, IPC, Deepgram WS owner
│   ├── renderer/           # Next.js renderer (output: 'export')
│   │   └── pages/          # single index page; live transcript + cards
│   └── electron-src/       # main entry, preload (Nextron convention)
├── web/                    # Next.js backend on Vercel
│   └── app/api/
│       ├── signal/route.ts
│       ├── confirm/route.ts
│       └── desktop/stream/route.ts   # SSE endpoint
├── docs/superpowers/specs/
└── pnpm-workspace.yaml     # pnpm workspaces

---

5. Environment variables

# Desktop
DEEPGRAM_API_KEY=
GBRAIN_BASE_URL=https://computah-brain.vercel.app

# G-Brain
ANTHROPIC_API_KEY=
COMPOSIO_API_KEY=
INSFORGE_PROJECT_ID=ac067465-9789-460d-a164-d5763ce2562e
INSFORGE_API_KEY=
DEMO_USER_ID=demo-user-001

---

6. Out of scope (post-MVP)

- Slack mirror w/ interactive buttons (stretch — would be the first thing to add)
- Slack/Discord inbound triggers (Composio Triggers → webhook)
- Multi-user auth (currently DEMO_USER_ID hardcoded; schema already supports it)
- Working memory / episodic retrieval / embeddings
- macOS code signing + DMG packaging
- Global hotkey + system tray
- Local fallback transcription (WhisperKit) if Deepgram unreachable
- OAuth deep-link callback handling (using poll-on-connections page instead)

---

7. Risks & gotchas

1. Deepgram silence keep-alive — send { type: 'KeepAlive' } every 8s during silence so the always-on socket doesn't drop.
2. macOS mic permission in dev — npm run dev runs Electron under the dev binary; the OS will prompt once. If it gets denied, mic is dead — toggle in System Settings → Privacy → Microphone.
3. Composio SDK churn — package name (composio-core → @composio/core) and method shape have shifted. Verify exact import + method when wiring step 5. If the SDK call shape differs from spec, follow the SDK, not the spec.
4. CORS from Electron → Vercel — renderer fetches from https://*.vercel.app. Add Access-Control-Allow-Origin: * on /api/* for dev (Electron renderer has no fixed origin — typically file:// or app://).
5. SSE through Vercel Fluid Compute — confirmed supported via streaming responses; set runtime = 'nodejs' on the SSE route, not edge.
6. Demo failure mode — if Composio Gmail breaks during demo, the UI still shows the proposed action with full content. Pitch it as a draft preview.

---

8. Build order (3-hour wall clock)

| #   | Time | Task                                                                                                                          | Done when                                                         |
| --- | ---- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | 0:20 | Nextron scaffold + /web Next app + pnpm workspaces + npx @insforge/cli link --project-id ac067465-9789-460d-a164-d5763ce2562e | pnpm dev runs both apps; Insforge linked                          |
| 2   | 0:40 | Mic + Deepgram WS → live partials in renderer                                                                                 | Voice transcribed in real time in the desktop window              |
| 3   | 0:30 | /api/signal w/ Claude SDK + Composio toolbelt (Gmail, Linear, Notion, Slack) → write pending_actions to Insforge              | Actionable utterance creates a row; noise does not                |
| 4   | 0:30 | SSE /api/desktop/stream + proposed-action card UI + /api/confirm → Composio execute                                           | Approve in UI actually creates the Linear issue / sends the email |
| 5   | 0:30 | Connections page: list apps, [Connect Gmail] → composio.connections.initiate → shell.openExternal → poll                      | Gmail connects end-to-end and the card flips to "✓"               |
| 6   | 0:30 | Demo dry-run + buffer for the thing that breaks                                                                               | Two voice prompts back-to-back both execute                       |

Pre-build (off the clock):
- Connect Linear, Notion, and Slack in Composio for DEMO_USER_ID manually (the on-clock build only wires Gmail's OAuth flow end-to-end; pre-connecting the others means the multi-tool demo still works).
- API keys ready in .env: Deepgram, Anthropic, Composio, Insforge.

---

9. Decisions log

- Nextron over electron-vite+React — user wants Next.js explicitly; Nextron handles output: 'export' wiring.
- Deepgram over local Whisper — 3 hours doesn't leave time to wire WhisperKit; Deepgram's $200 credit covers the demo.
- Claude SDK (@anthropic-ai/sdk) over Vercel AI SDK / Mastra — user preference; tool_use loop maps 1:1 onto Composio's Anthropic adapter; less abstraction means less to learn under time pressure.
- Composio for OAuth + tools, not roll-your-own — Composio owns the tokens, the consent UX, and the action catalog. We never see the user's Gmail token; we just call composio.tools.execute.
- Pending action gate (no autonomous execution) — safer on stage; gives a clear demo moment when the card pops up and the user clicks Approve.
- Insforge over Supabase+pgvector — user choice.
- Confirm-before-execute, on both surfaces (UI + Slack) — user choice; gives a memorable demo moment and is safe on stage.
- Vercel-hosted backend — public URL for Slack webhooks; one-deploy story.
- No auth in v1 — 8-hour constraint.

