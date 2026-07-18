// One-command demo: `bun run demo`
// Starts the agent server + distraction watcher, then fires the kickoff —
// Nudge texts you asking what you're working on. Ctrl+C stops everything.
import { $ } from "bun";

const PORT = process.env.CONTROL_PORT ?? "4550";
const CONTROL = `http://127.0.0.1:${PORT}`;

// A stale server from a previous run holds the port and makes the fresh one
// die with EADDRINUSE — clear it first.
const stale = (await $`lsof -ti :${PORT} -sTCP:LISTEN`.quiet().nothrow().text()).trim();
if (stale) {
  console.log(`▶ clearing stale server on :${PORT} (pid ${stale.split("\n").join(", ")})`);
  for (const pid of stale.split("\n")) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {}
  }
  await Bun.sleep(1000);
}

console.log("▶ starting agent server…");
const server = Bun.spawn(["bun", "src/index.ts"], { stdout: "inherit", stderr: "inherit" });

let up = false;
for (let i = 0; i < 90; i++) {
  if (server.exitCode !== null) break;
  try {
    if ((await fetch(`${CONTROL}/timers`)).ok) {
      up = true;
      break;
    }
  } catch {}
  await Bun.sleep(500);
}
if (!up) {
  console.error("▶ server didn't come up — check the output above.");
  server.kill();
  process.exit(1);
}

console.log("▶ starting distraction watcher…");
const watcher = Bun.spawn(["bun", "src/watcher.ts"], { stdout: "inherit", stderr: "inherit" });

await Bun.sleep(500);
console.log("▶ firing kickoff — check your phone/Messages 📱");
await fetch(`${CONTROL}/kickoff`, { method: "POST" });

const shutdown = () => {
  console.log("\n▶ stopping…");
  watcher.kill();
  server.kill();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await Promise.race([server.exited, watcher.exited]);
shutdown();
