import { $ } from "bun";
import { config } from "./config";

const W = 380;
const H = 64;
/** Sit just above the macOS dock. */
const BOTTOM_OFFSET = 84;

/**
 * Open the timer HUD as a chromeless Chrome app window, pinned dock-style at
 * the bottom-center of the screen. Chrome ignores --window-* args when it's
 * already running, so bounds are applied via AppleScript after the fact.
 */
export async function openHud(): Promise<void> {
  const url = `http://127.0.0.1:${config.controlPort}/timer`;
  try {
    await $`open -na ${"Google Chrome"} --args --app=${url}`.quiet();
    await Bun.sleep(1000);
    const bounds = (
      await $`osascript -e ${'tell application "Finder" to get bounds of window of desktop'}`.quiet().text()
    ).trim();
    const parts = bounds.split(",").map((n) => Number.parseInt(n.trim(), 10));
    const sw = parts[2] ?? 1440;
    const sh = parts[3] ?? 900;
    const x = Math.round((sw - W) / 2);
    const y = sh - H - BOTTOM_OFFSET;
    await $`osascript -e ${`tell application "Google Chrome" to set bounds of front window to {${x}, ${y}, ${x + W}, ${y + H}}`}`.quiet();
    console.log("[hud] opened");
  } catch (err) {
    console.warn("[hud] could not open:", err);
  }
}
