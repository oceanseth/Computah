# Always Listening — Mobile

A React Native (Expo) port of the **Always Listening** voice app, built to run on
a cloud iOS simulator via **[Limrun](https://lim.run)**.

It listens, transcribes your voice with **Deepgram**, distills the transcript into
durable **memories** with an LLM through the **InsForge** AI gateway, and persists
everything to the same InsForge Postgres schema as the desktop app
(`sessions` · `transcript_segments` · `memories`).

```
mic ──▶ record clip ──▶ Deepgram (REST) ──▶ transcript
                                              │
                          InsForge AI (understanding) ──▶ memories
                                              │
                          InsForge Postgres (sessions/segments/memories)
```

## Screens

- **Listen** — tap to record a clip; it transcribes, appends to the running
  transcript, and auto-distills memories. `+ Sample conversation` injects a demo
  transcript (handy on a simulator with no real mic); `✦ Distill now` re-runs the
  understanding pass on the whole transcript.
- **Memories** — the distilled notes / action items / questions / decisions /
  entities, loaded from InsForge.
- **Settings** — paste your Deepgram key, InsForge base URL + admin key, and the
  understanding model. Stored in the device keychain (`expo-secure-store`).

## Configuration

Keys can be entered in **Settings** at runtime, or baked in for a build via
`EXPO_PUBLIC_*` env vars:

```bash
EXPO_PUBLIC_DEEPGRAM_KEY=...
EXPO_PUBLIC_INSFORGE_URL=https://xxxx.us-west.insforge.app
EXPO_PUBLIC_INSFORGE_KEY=ik_...
EXPO_PUBLIC_UNDERSTANDING_MODEL=openai/gpt-4o-mini
```

The InsForge schema is the desktop app's `migrations/` (already applied to the
shared project).

## Run locally (needs a Mac with Xcode)

```bash
npm install
npx expo run:ios          # or: npm run ios  (Expo Go / dev client)
```

## Build & preview in the cloud with Limrun (no local Mac/Xcode needed)

```bash
npm install --global lim
lim login                                  # or export LIM_API_KEY=lim_...

# From this directory: sync, install JS deps + Pods, xcodebuild, install on a
# cloud iOS simulator, all server-side. Returns a browser stream URL.
lim xcode build . --ios --configuration Release
```

Limrun detects the Expo app, runs `npm install` + `expo prebuild` + `pod install`
on the sandbox (so `node_modules` and `Pods/` never ship), compiles with
`xcodebuild`, and installs the app on a simulator-backed instance.

Then drive / preview it:

```bash
lim ios list                          # find the instance id + stream URL
lim ios screenshot ./screen.png       # capture a frame
lim ios launch-app run.lim.alwayslistening
# Share preview: https://console.limrun.com/preview?asset=<ASSET>&platform=ios
```
