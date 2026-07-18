# nudge 🍑 — hackathon submission copy

## Short blurb (~60 words)

**nudge is a proactive AI accountability buddy for ADHD that lives in iMessage — with its own phone number, so it texts *you* first.** It breaks dreaded tasks into laughably small steps, sets its own timers, calls you out mid-doomscroll, and verifies your work by peeking at your screen. Built solo in a day: Bun + Photon Spectrum + Pi SDK, with Codex `gpt-5.6-terra` as the brain.

## Full description (~300 words)

Every productivity tool fails people with ADHD the same way: it waits to be opened, and the whole problem is that it never gets opened. **nudge inverts that.** It's an AI accountability buddy with its own iMessage number that initiates, follows up, and doesn't let go — an external executive function that texts with the weight of a real friend, not an app badge.

Under the hood, everything proactive is one mechanism: self-scheduled wake-ups. Timers, a no-reply watchdog, and a distraction sidecar (which polls the frontmost app and Chrome tab) all wake the same agent session with a system event — `[SESSION START]`, `[CHECK-IN FIRED]`, `[NO REPLY]`, `[DISTRACTION DETECTED]` — and the agent decides what to text. Layered on top: an RSD-aware coach persona (a missed check-in is data, never failure), screenshot proof gates it judges with vision, one-tap poll check-ins, tapbacks, and full-screen confetti reserved for real wins.

**What the demo shows** (~4 min compressed to 83s; all agent behavior unscripted): nudge opens the conversation itself — *"fresh start — what are you tackling right now?"* I give it something vague: write a reflection on this hackathon in Obsidian. It shrinks that to a first step with a zero-quality bar (open the note, type the title), proposes 10 minutes, and when I push back with "10 too long," negotiates down to two. When I wander to x.com it ambushes me instantly — *"X ambush! Close it."* — TikTok gets *"close the gremlin portal."* A countdown HUD sits above my dock; at 30 seconds it warns me to get my work on screen. When time's up it screenshots my frontmost window, sees I blew past the title into real writing — *"39 words and a real opening"* (it read the word count off my screen) — celebrates, and offers to ride the momentum. I ask for 30 more seconds; it re-arms the timer.

**Stack**: Bun/TypeScript (~1,000 LOC, built solo in one day) · Photon Spectrum cloud iMessage (own number, typing indicators, effects, polls) · Pi SDK agent loop running **Codex `gpt-5.6-terra`** · AppleScript + `screencapture` sidecars for distraction detection and proof.
