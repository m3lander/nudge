// One-command demo: `bun run demo`
// Starts the agent server + distraction watcher, then fires the kickoff —
// Nudge texts you asking what you're working on. Ctrl+C stops everything.
const CONTROL = `http://127.0.0.1:${process.env.CONTROL_PORT ?? "4550"}`;

console.log("▶ starting agent server…");
const server = Bun.spawn(["bun", "src/index.ts"], { stdout: "inherit", stderr: "inherit" });

let up = false;
for (let i = 0; i < 90; i++) {
  try {
    if ((await fetch(`${CONTROL}/timers`)).ok) {
      up = true;
      break;
    }
  } catch {}
  await Bun.sleep(500);
}
if (!up) {
  console.error("▶ server never came up — check output above.");
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
