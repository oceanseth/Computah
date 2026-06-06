# PR → Agent Demo pipeline (+ Memoir hand-off)

Goal: when someone pushes a PR that adds/changes an **agent**, automatically produce
a short demo of the agent *actually running* and ship it (X / LinkedIn) so anyone can
see what the agent does — without a human filming it.

## What we built (the "capture" half) — works today

[`.github/workflows/pr-agent-demo.yml`](.github/workflows/pr-agent-demo.yml) runs on every PR:

1. Spins up a **Limrun** cloud iOS simulator (with an Xcode sandbox) — no Mac.
2. `lim xcode build` the agent's Expo app (`voice-app/mobile`) and installs it.
3. Launches it, **screen-records** it (`lim ios record`) while driving the key flow
   (Sample conversation → Distill → Memories).
4. Uploads `demo.mp4` as a workflow artifact and **comments the video + live-sim link on the PR**.

Setup: add a repo secret **`LIM_API_KEY`** (Settings → Secrets and variables → Actions).
Get it at https://console.limrun.com/settings.

The raw demo video (`demo.mp4`) is the artifact Memoir consumes/enhances.

## The Memoir hand-off (the "narrate + distribute" half)

[Memoir](https://www.trymemoir.ai/) (YC) is an "AI CMO": it watches your repo, drives your
staging app with an AI agent, generates a branded demo video narrated in your cloned voice,
and drafts/ships X · LinkedIn · HN posts in your writing voice. There's no public API yet —
it's set up during onboarding. **Contact:** maanav@trymemoir.ai · book: calendly.com/maanav-memoir/30min
(the founders are at this hackathon).

What to give them so they can target our PRs:

| They need | Ours |
| --- | --- |
| **Repo** | `github.com/oceanseth/Computah` (grant their GitHub app read access) |
| **What the agent does** | "Always Listening": records speech → Deepgram transcript → InsForge AI distills typed *memories* → InsForge Postgres. Mobile app in `voice-app/mobile`. |
| **Live/staging app to drive** | Web: https://computah.vercel.app · Mobile: the Limrun build above (or a dev tunnel) |
| **Raw demo clip** | `demo.mp4` from the PR workflow artifact (so they can re-cut + narrate) |
| **Voice/brand** | Team Stackers; brand assets in `public/team.png`; sample posts to learn writing voice |
| **Trigger** | On merged PR to `main` (or on label `demo`) |

### Two integration shapes
- **Memoir-native:** they point their repo-watcher at our PRs and produce/post the asset end-to-end (their staging-app driver replaces our Limrun capture).
- **Hybrid (recommended for now):** our workflow captures `demo.mp4` per PR; Memoir picks up the clip, narrates it in-voice, and posts to X/LinkedIn after approval.

## Known gaps / TODO
- The Release build must render before recording — verify the app isn't stuck on a black/splash frame on the target SDK (we pin Expo **SDK 54** to match Expo Go).
- Direct X posting (without Memoir) would need the X API + credentials; out of scope for the POC — that's exactly the value Memoir adds.
- `demo.mp4` is currently a workflow artifact (login to download). For public sharing, push it to a bucket via `lim ios record stop --presigned-url <url>` or hand to Memoir.
