/**
 * Distraction watcher sidecar — run alongside the agent: `bun run watch`
 *
 * Polls the frontmost app and Chrome's active tab via AppleScript. When a
 * blocklisted site/app surfaces, POSTs a distraction event to the agent's
 * control plane, which wakes the agent to intervene over iMessage.
 *
 * First run: macOS will ask to let your terminal control Chrome/System Events.
 */
import { $ } from "bun";

const CONTROL = `http://127.0.0.1:${process.env.CONTROL_PORT ?? "4550"}`;
const POLL_MS = 3000;
const COOLDOWN_MS = Number(process.env.DISTRACTION_COOLDOWN_SEC ?? "180") * 1000;

const SITES = (
  process.env.DISTRACTION_SITES ??
  "x.com,twitter.com,instagram.com,tiktok.com,reddit.com,facebook.com,youtube.com"
)
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const DISTRACTING_APPS = ["TikTok", "Instagram", "Twitter", "X"];

const lastFired = new Map<string, number>();

async function frontmostApp(): Promise<string> {
  return (
    await $`osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`.quiet().text()
  ).trim();
}

async function chromeActiveUrl(): Promise<string> {
  return (
    await $`osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'`.quiet().text()
  ).trim();
}

function matchSite(url: string): string | undefined {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  return SITES.find((site) => host === site || host.endsWith(`.${site}`));
}

async function fire(key: string, detail: string) {
  const last = lastFired.get(key) ?? 0;
  if (Date.now() - last < COOLDOWN_MS) return;
  lastFired.set(key, Date.now());
  console.log(`[watcher] 🚨 ${detail}`);
  try {
    await fetch(`${CONTROL}/event`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ detail }),
    });
  } catch (err) {
    console.error("[watcher] control plane unreachable — is the agent running?", err);
  }
}

console.log(`[watcher] watching for: ${SITES.join(", ")} (cooldown ${COOLDOWN_MS / 1000}s)`);

while (true) {
  try {
    const app = await frontmostApp();

    const nativeHit = DISTRACTING_APPS.find((a) => app.toLowerCase() === a.toLowerCase());
    if (nativeHit) {
      await fire(`app:${nativeHit}`, `The user just switched to the ${nativeHit} app.`);
    } else if (app.includes("Chrome")) {
      const url = await chromeActiveUrl();
      const site = matchSite(url);
      if (site) {
        await fire(`site:${site}`, `The user just opened ${site} in Chrome. They are doomscrolling instead of working.`);
      }
    }
  } catch {
    // Chrome closed / AppleScript hiccup — ignore and keep polling.
  }
  await Bun.sleep(POLL_MS);
}
