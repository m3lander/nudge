import timerPage from "./timer.html";
import { ask, createCoach } from "./agent";
import { config, now } from "./config";
import { openHud } from "./hud";
import { Messenger, type Incoming } from "./imessage";
import { captureFrontWindow } from "./screenshot";
import { checkinPrompt, distractionPrompt, kickoffPrompt, noReplyPrompt } from "./prompt";
import { Scheduler, type Checkin } from "./scheduler";
import { createCoachTools } from "./tools";

if (config.ownerHandles.length === 0) {
  console.error("Set OWNER_HANDLE in .env (your phone number).");
  process.exit(1);
}

const messenger = new Messenger();

// HUD auto-open: the HUD polls /timers every 2s, so a recent poll means one is
// already on screen; otherwise pop one when a timer gets scheduled.
let lastHudPoll = 0;
function maybeOpenHud() {
  if (Date.now() - lastHudPoll > 6000) void openHud();
}

const scheduler = new Scheduler(config.timersPath, onCheckinFired, {
  onScheduled: () => maybeOpenHud(),
  onWarn: async (checkin) => {
    const heads = checkin.captureScreen
      ? "⏳ 30 seconds — get it on screen, I'll take a peek when time's up 👀"
      : "⏳ 30 seconds!";
    await messenger.sendText(heads);
    console.log(`[warn] #${checkin.id} 30s warning sent`);
  },
});
const session = config.echoMode
  ? null
  : await createCoach(
      createCoachTools(scheduler, {
        celebrate: (text, effectName) => messenger.sendEffect(text, effectName),
        react: (emoji) => messenger.reactToLast(emoji),
        sendPoll: (question, options) => messenger.sendPoll(question, options),
      }),
    );

/** Wake the agent with a system event and text its reply to the owner. */
async function systemWake(prompt: string, tag: string) {
  if (!session) return;
  const reply = await messenger.withTyping(() => ask(session, prompt));
  if (reply) {
    await messenger.sendText(reply);
    console.log(`[${tag}] sent: ${reply.slice(0, 120)}`);
  }
}

// ── No-reply watchdog ────────────────────────────────────────────────────────
let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
let nudges = 0;

function armWatchdog() {
  clearTimeout(watchdogTimer);
  if (nudges >= 2) return;
  const delayMs = (config.watchdogMinutes * 60_000) / config.timeScale;
  watchdogTimer = setTimeout(async () => {
    nudges++;
    console.log(`[watchdog] no reply — nudge #${nudges}`);
    await systemWake(noReplyPrompt(config.watchdogMinutes, nudges), "watchdog");
    armWatchdog();
  }, delayMs);
}

function disarmWatchdog() {
  clearTimeout(watchdogTimer);
  watchdogTimer = undefined;
  nudges = 0;
}

async function onCheckinFired(checkin: Checkin) {
  console.log(`[checkin] #${checkin.id} fired: ${checkin.note}`);
  if (!session) return;
  const shot = checkin.captureScreen ? await captureFrontWindow() : undefined;
  if (checkin.captureScreen) console.log(`[checkin] proof screenshot: ${shot ? "captured" : "FAILED"}`);
  const reply = await messenger.withTyping(() =>
    ask(session, checkinPrompt(checkin.note, checkin.silent, !!shot), shot ? [shot] : undefined),
  );
  if (reply) {
    await messenger.sendText(reply);
    console.log(`[checkin] sent: ${reply.slice(0, 120)}`);
  }
  armWatchdog();
}

// ── Inbound messages ─────────────────────────────────────────────────────────
async function onMessage({ text, images, space }: Incoming) {
  console.log(`[in] ${text || "(photo only)"}${images.length ? ` +${images.length} image(s)` : ""}`);
  disarmWatchdog();

  if (config.echoMode) {
    if (text) await messenger.sendText(`echo: ${text}`, space);
    return;
  }

  const prompt = images.length > 0
    ? `[${now()}] ${text || "(the user sent a photo with no text)"}\n(The user attached ${images.length} photo${images.length > 1 ? "s" : ""} — if a proof gate is open, judge honestly whether it shows the task done.)`
    : `[${now()}] ${text}`;

  const reply = await space.responding(() => ask(session!, prompt, images));
  if (reply) {
    await messenger.sendText(reply, space);
    console.log(`[out] ${reply.slice(0, 120)}`);
  }
}

// ── Local control plane (kickoff + sidecar events) ───────────────────────────
Bun.serve({
  hostname: "127.0.0.1",
  port: config.controlPort,
  routes: {
    "/timer": timerPage,
    "/timers": {
      GET: () => {
        lastHudPoll = Date.now();
        return Response.json({ pending: scheduler.list(), now: Date.now(), timeScale: config.timeScale });
      },
    },
    "/kickoff": {
      POST: async () => {
        console.log("[control] kickoff");
        await systemWake(kickoffPrompt(), "kickoff");
        return new Response("ok\n");
      },
    },
    "/event": {
      POST: async (req) => {
        const body = (await req.json().catch(() => ({}))) as { detail?: string };
        const detail = body.detail?.slice(0, 500) ?? "The user seems distracted.";
        console.log(`[control] event: ${detail}`);
        await systemWake(distractionPrompt(detail), "distraction");
        return new Response("ok\n");
      },
    },
  },
  fetch: () => new Response("momo control plane\n", { status: 404 }),
});

// ── Boot ─────────────────────────────────────────────────────────────────────
const restored = scheduler.restore();
if (restored > 0) console.log(`[scheduler] re-armed ${restored} pending check-in(s)`);

await messenger.start(onMessage);

console.log(`─────────────────────────────────────────
${config.agentName} is up (Spectrum cloud).
  mode:       ${config.echoMode ? "ECHO (plumbing test)" : "agent"}
  owner:      ${config.ownerHandles.join(", ")}
  time scale: ${config.timeScale}x
  watchdog:   ${config.watchdogMinutes} min, max 2 nudges
  control:    http://127.0.0.1:${config.controlPort}  (POST /kickoff, POST /event)
  timer HUD:  http://127.0.0.1:${config.controlPort}/timer  (bun run timer)
Text the agent's Photon number, or POST /kickoff to have it text you first.
─────────────────────────────────────────`);

process.on("SIGINT", async () => {
  console.log("\nshutting down…");
  await messenger.stop();
  process.exit(0);
});
