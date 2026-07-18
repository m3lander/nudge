import { $ } from "bun";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resizeImage } from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";

/**
 * Screenshot the frontmost window (proof capture). Falls back to the full
 * screen if window bounds can't be resolved. Requires the Screen Recording
 * permission for the terminal running the agent.
 */
export async function captureFrontWindow(): Promise<ImageContent | undefined> {
  const path = `/tmp/nudge-proof-${Date.now()}.png`;
  try {
    try {
      const raw = (
        await $`osascript -e ${'tell application "System Events" to tell (first application process whose frontmost is true) to get {position, size} of front window'}`.quiet().text()
      ).trim();
      const [x, y, w, h] = raw.split(",").map((n) => Number.parseInt(n.trim(), 10));
      if ([x, y, w, h].some((n) => !Number.isFinite(n))) throw new Error(`bad bounds: ${raw}`);
      await $`screencapture -x -R${x},${y},${w},${h} ${path}`.quiet();
    } catch {
      await $`screencapture -x ${path}`.quiet();
    }
    if (!existsSync(path)) return undefined;
    const bytes = readFileSync(path);
    rmSync(path, { force: true });
    const resized = await resizeImage(bytes, "image/png", { maxWidth: 1600, maxBytes: 800_000 });
    if (resized) return { type: "image", data: resized.data, mimeType: resized.mimeType };
    return { type: "image", data: bytes.toString("base64"), mimeType: "image/png" };
  } catch (err) {
    console.error("[screenshot] capture failed:", err);
    return undefined;
  }
}
