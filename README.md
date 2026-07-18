# Nudge 📱 — a proactive AI agent for ADHD, living in iMessage

**You don't open Nudge. Nudge texts *you*.**

Every productivity app fails people with ADHD the same way: it waits patiently to be opened, and the whole problem is that it never gets opened. Nudge inverts that. It's an accountability buddy with its own phone number that texts first — it breaks dreaded tasks into laughably small first steps, schedules its own check-ins, peeks at your screen for proof, calls you out (kindly) when you're doomscrolling, and celebrates real wins with full-screen confetti.

Built solo in one day at the 2026-07-18 hackathon. ~1,000 lines of TypeScript on Bun.

> **Demo video**: `nudge-demo-3x.mp4` (submitted alongside; check-in intervals compressed with `TIME_SCALE` and playback at 3× — the agent behavior is unscripted).

## Why iMessage

People with ADHD don't need another app to forget. iMessage is already open, already checked compulsively, and — crucially — **notifications from a real phone number don't get ignored like app badges do**. The medium is the intervention: a text from Nudge lands with the same weight as a text from a friend.

## What it does

| Feature | The ADHD problem it targets |
|---|---|
| **Tiny first steps** — "open the doc, write one bad sentence" | Task-initiation paralysis. The first step is always ≤ ~2 minutes with a zero quality bar. |
| **Self-scheduled check-ins** — the agent sets its own timers and texts you when they fire | Things silently dying in to-do lists. Nudge owns the follow-up. |
| **Silent mode** — "I *will* check on you, but I won't say when" | Deadline anxiety. Accountability without a countdown — variable-ratio reinforcement, the dopamine-friendly kind. |
| **Proof gates** — send a photo of the clean desk / packed bag; or grant Nudge a 30-second-warning **screenshot peek** at your frontmost window | "I'll do it later" self-negotiation. The model actually looks at the image and judges honestly. |
| **One-tap polls** — check-ins arrive as tappable cards ("crushed it / sort of / didn't start") | Reply friction. A poll gets an answer where a question gets ghosted. |
| **No-reply watchdog** — ignore a check-in and Nudge follows up on its own (twice, then backs off) | Ghosting your own commitments. Persistence is the product. |
| **Distraction sidecar** — a watcher polls the frontmost app/Chrome tab; opening TikTok mid-task gets you an immediate playful calling-out (with the *slam* effect) | Doomscroll spirals. A friend snatching your phone, not a disappointed parent. |
| **Session kickoff** — `bun run demo` and Nudge opens the conversation: "what are we working on right now?" | Blank-page mornings. You never have to initiate. |
| **Tapbacks, typing indicators & full-screen effects** — ❤️ on proof photos, confetti/fireworks on real completions only | Motivation. Celebration is kept rare so it stays worth earning. |
| **Time anchoring** — every message the model sees is timestamped; a countdown HUD sits above the dock | Time blindness. "Heads up — that was 40 minutes ago, not 5." |
| **Rejection-sensitive tone** — a missed check-in is data, never failure | RSD. Guilt-trippy reminders are actively harmful; Nudge never sends one. |

## How it works

```
                       ┌─ Photon Spectrum cloud (agent's own iMessage number)
  your phone ⇄ iMessage┤   send/receive · typing · tapbacks · effects · polls
                       └──────────────┬──────────────────────────────
                                      ▼
                        owner allowlist → Pi SDK agent session
                        (Codex gpt-5.6-terra + ADHD-coach persona)
                        custom tools: schedule_checkin · cancel_checkin ·
                        list_checkins · celebrate · react · send_poll
                                      ▲
        scheduler (timers.json, restart-safe, TIME_SCALE-compressible)
          ├─ 30s warning text → screencapture of frontmost window → vision proof
          └─ fired timer wakes the agent → it texts you first
        no-reply watchdog ── silence after a check-in re-wakes the agent
        distraction sidecar ─ AppleScript polls frontmost app/Chrome tab
                              → POST /event → immediate intervention
        control plane (Bun.serve :4550) ─ /kickoff · /event · /timers → HUD
```

The core insight: the only thing separating a chatbot from an *agent that has your back* is **self-scheduled wake-ups**. Everything Nudge does proactively — check-ins, watchdog nudges, distraction interventions, morning kickoffs — is one mechanism: something fires, the session is woken with a bracketed system event (`[CHECK-IN FIRED]`, `[NO REPLY]`, `[DISTRACTION DETECTED]`, `[SESSION START]`), and the agent decides what to text you. The persona, the tools, and the proof gates are all layered on that one spine.

**Stack**: [Bun](https://bun.com) · [Spectrum](https://photon.codes) (Photon's cloud iMessage provider — the agent has its own number, so it works with zero setup on the user's devices) · [Pi SDK](https://pi.dev/docs/latest/sdk) agent session running **`gpt-5.6-terra` via Codex auth** · TypeBox tool schemas · AppleScript + `screencapture` for the proof/distraction sidecars.

## Repo tour

```
src/index.ts      wiring: session, scheduler, watchdog, control plane (Bun.serve)
src/agent.ts      Pi session factory + serialized ask() → reply text
src/prompt.ts     the persona & system-event prompts (the soul of the product)
src/tools.ts      schedule_checkin · cancel_checkin · list_checkins · celebrate · react · send_poll
src/scheduler.ts  restart-safe timers, 30s warnings, TIME_SCALE compression
src/imessage.ts   Spectrum layer: spaces, effects, polls, tapbacks, image extraction (HEIC→PNG)
src/watcher.ts    distraction sidecar (frontmost app / Chrome tab poller)
src/screenshot.ts frontmost-window proof capture
src/hud.ts        + src/timer.html — dock-pinned countdown HUD
scripts/demo.ts   one-command demo: server + sidecar + kickoff
scripts/smoke*.ts component smoke tests (agent round-trip, tool call, vision)
```

## Run it

```bash
bun install
cp .env.example .env   # fill in Spectrum credentials + your phone number
pi                      # once, to auth a model provider (we use Codex)
bun run demo            # starts agent + distraction watcher, Nudge texts you first
```

Useful during development: `bun run dev` (agent only, hot reload), `bun run kickoff` (re-fire the opening text), `bun run timer` (pop the HUD), `TIME_SCALE=20` in `.env` (compress "10 minutes" to 30 s), `ECHO_MODE=1` (plumbing test without the model).

macOS permissions (asked on first use): Screen Recording for proof screenshots; Automation (System Events/Chrome) for the sidecar and HUD.

## What's next

- **Task store as source of truth** — tasks.json + add/complete/list tools, so Nudge resurfaces stale tasks days later (today's memory is per-session).
- **Recurring routines** — morning kickoff / evening review without the manual trigger.
- **Idle nudge** — a day of silence → gentle ping.
- **External triggers** — calendar pre-warnings ("meeting in 15 — wrap up"), email-verified proof gates ("actually send the email and I'll see it"), voice-call escalation for the truly unignorable check-in.