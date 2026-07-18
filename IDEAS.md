# ADHD Proactive Agent — working notes

Hackathon: 2026-07-18. Status: **brainstorming — no building until go-ahead.**

## One-liner
A proactive AI agent you text over iMessage that acts as your external executive function — it follows up on you, not the other way around.

## Tech stack
- **iMessage layer**: Photon `imessage-kit` (https://photon.codes/docs/spectrum-ts/providers/imessage)
- **Agent**: Pi SDK (pi.dev) or Codex app server — leaning Codex app server since it's a Codex hackathon
- Key architectural insight: the thing that makes this different from a chatbot is **self-scheduled wake-ups**. The agent must be able to say "wake me in 10 min and text Max." Everything else (breakdown, proof gates, tone) is prompting layered on top of: message in → agent → message out + schedule future sends.

## Core principle: proactivity
- Replaces the to-do list. It's the **source of truth / inbox** — you tell it things, it owns the follow-up.
- You never have to remember to open it. It comes to you.

## Features (from brain dump 1)
1. **Task breakdown** — give it a dreaded task ("I've been meaning to write this post"), it breaks it down conversationally and gives you a tiny first step. "Don't worry about quality, just have *something* down. I'll check in in 10 minutes."
2. **Timers + check-ins** — it sets its own timers and actually texts you when they fire.
3. **Unpredictable check-ins** — for deadline-anxiety cases: "I *will* check on you, but I won't say when." Accountability without a scary countdown. (This is basically variable-ratio reinforcement — the dopamine-friendly kind.)
4. **Proof gate**
   - Self-verifiable tasks (e.g. "send that email"): agent checks directly (email API access) — no arguing with it.
   - Non-verifiable tasks: you must send a **photo as proof** (iMessage makes this natural — snap a pic of the clean desk / packed bag).

## Demo script v1 (proposed 2026-07-18, ~2 min, TIME_SCALE=20, caption "check-ins compressed")
Story: "I've been avoiding writing this post for two weeks."
1. **0:00 Cold open** — text Momo the dreaded task → typing indicator → tiny first step + "I'll check in soon" (silent mode namedrop).
2. **0:25 The money shot** — phone idle / you doomscrolling; unprompted notification drops in. Reply "didn't start, got distracted" → Momo shrinks the step, zero guilt, re-arms.
3. **0:55 Proof gate** — next check-in: you did it. Send photo → ❤️ tapback + full-screen confetti "YOU DID THE THING".
4. **1:25 It doesn't let go** — check-in ignored entirely → Momo follows up on its own (no-reply watchdog). Optional: "next morning" cut → 9am kickoff text.
5. **1:50 End card** — one-liner + feature flash.
Film: iPhone screen-recording (or QuickTime via cable) — lock-screen notifications are the emotional payload; Mac Messages as fallback.

## Proactivity roadmap (state as of 2026-07-18 evening)
Have: agent-scheduled check-ins (+ silent mode), restart-safe timers, DM pre-opened at boot.
Gap: everything proactive is downstream of a conversation the USER started, and depends on the model remembering to schedule. System-level guarantees to add, in order:
1. **No-reply watchdog** — check-in sent + no inbound in N min → auto re-wake agent ("they haven't replied"). Makes "it doesn't let go" true by construction.
2. **Task store** (tasks.json + add/complete/list tools) — real source of truth; survives restarts (session memory is in-memory today!); enables resurfacing stale tasks.
3. **Recurring routines** — morning kickoff / evening review (cron-style in scheduler).
4. **Idle nudge** — no contact for a day → gentle ping.
5. **External triggers** (post-hackathon) — calendar pre-warnings, email-verified proof gates, voice-call escalation.

## Demo (open question — 2–5 min video)
Problem: the product's magic is *elapsed time* (check-ins arriving later), which is hard to show live.
Ideas so far:
- Time-lapse: screen-record a real ~20-min work session in Messages, speed it up.
- Alternative: shorten timer intervals for the demo (caption it honestly), so a "10-min check-in" fires in 30s — keeps the video tight and scripted-safe.
- Demo beats to hit: (1) dump a dreaded task → breakdown + tiny first step, (2) phone buzzes with an *unprompted* check-in, (3) proof gate: send a photo, agent verifies/celebrates, (4) stretch: agent verifies email sent by itself.

## Build order (iterate, don't build everything)
1. Pipe: iMessage in → agent → iMessage out (echo bot).
2. Self-scheduling: agent can schedule a future outbound text.
3. Task breakdown + check-in loop (prompting).
4. Proof gate (photo handling; then email verification if time).

## Idea backlog (unvetted, to build on)
- **Time blindness**: agent anchors time for you — "you said this'd take 5 min; it's been 25" / pre-warnings before calendar events.
- **Task initiation**: always shrink step 1 until it's laughably small.
- **Capture inbox**: text it any stray thought; it triages so nothing gets lost.
- **Hyperfocus guardrail**: check-ins that pull you *out* ("you've been at this 2h — water? food?").
- **Tone**: RSD-aware — never guilt-trips, celebrates small wins, treats a missed check-in as data not failure.
- **Morning kickoff / evening review** loops.
