/** Normalize a phone/email handle for comparison: lowercase, strip spaces/dashes/parens. */
export function normalizeHandle(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s\-().]/g, "");
}

const timeScale = Number(process.env.TIME_SCALE ?? "1");

export const config = {
  /** Comma-separated phone numbers / emails allowed to talk to the agent. */
  ownerHandles: (process.env.OWNER_HANDLE ?? "")
    .split(",")
    .map(normalizeHandle)
    .filter(Boolean),
  /** Divide all check-in delays by this factor (demo mode: TIME_SCALE=20 → 10min fires in 30s). */
  timeScale: Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1,
  /** Plumbing test: reply "echo: <text>" without invoking the agent. */
  echoMode: process.env.ECHO_MODE === "1",
  /** "provider/model", e.g. "openai-codex/gpt-5.6-terra". Empty → pi settings default. */
  agentModel: process.env.AGENT_MODEL ?? "",
  agentName: process.env.AGENT_NAME ?? "Momo",
  timersPath: new URL("../timers.json", import.meta.url).pathname,
  /** Local control-plane port (kickoff + sidecar events). */
  controlPort: Number(process.env.CONTROL_PORT ?? "4550"),
  /** Minutes of silence after a check-in before the no-reply watchdog re-wakes the agent (TIME_SCALE applies). */
  watchdogMinutes: Number(process.env.WATCHDOG_MINUTES ?? "5"),
};

export function isOwner(handle: string | null): boolean {
  if (!handle) return false;
  return config.ownerHandles.includes(normalizeHandle(handle));
}

export function now(): string {
  return new Date().toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
