// Smoke test: run with `bun run scripts/smoke.ts`
// 1. Spectrum cloud connect + owner DM space  2. agent boot + tool round trip
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { ask, createCoach } from "../src/agent";
import { config } from "../src/config";
import { Scheduler } from "../src/scheduler";
import { createCoachTools } from "../src/tools";

console.log("1) Spectrum cloud connect…");
try {
  const app = await Spectrum({
    projectId: process.env.SPECTRUM_PROJECT_ID!,
    projectSecret: process.env.SPECTRUM_PROJECT_SECRET!,
    providers: [imessage.config()],
  });
  console.log("   OK — connected");
  const space = await imessage(app).space.create(config.ownerHandles[0]!);
  console.log(`   OK — owner DM space: ${space.id}`);
  await app.stop();
} catch (err) {
  console.error("   FAILED:", err);
}

console.log(`2) agent boot (AGENT_MODEL=${config.agentModel || "(pi default)"})…`);
const scheduler = new Scheduler("/tmp/smoke-timers.json", async (c) => {
  console.log(`   [scheduler] check-in fired: #${c.id} "${c.note}"`);
});
const session = await createCoach(
  createCoachTools(scheduler, {
    celebrate: async (text, fx) => console.log(`   [celebrate:${fx}] ${text}`),
    react: async (emoji) => (console.log(`   [react] ${emoji}`), true),
    sendPoll: async (q, opts) => console.log(`   [poll] ${q} [${opts.join(" / ")}]`),
  }),
);

console.log("3) round trip…");
const reply = await ask(
  session,
  "[Fri 18 Jul, 15:30] hey — quick test: reply with one short sentence and tell me which tools you have.",
);
console.log(`   reply: ${reply}`);

console.log("4) tool call — asking it to schedule a check-in in 0.25 min…");
const reply2 = await ask(
  session,
  "[Fri 18 Jul, 15:31] I need to write my hackathon demo script. schedule a check-in for 15 seconds from now (0.25 minutes) as a test.",
);
console.log(`   reply: ${reply2}`);
console.log("   waiting 20s for the timer to fire…");
await new Promise((r) => setTimeout(r, 20_000));
console.log("done.");
process.exit(0);
