// Vision smoke test: does the model accept images through session.prompt?
// Uses a screenshot if permitted, else a generated red-pixel PNG.
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { ask, createCoach } from "../src/agent";

const shot = "/tmp/momo-vision-test.png";
let data: string;
try {
  execSync(`screencapture -x -t png ${shot}`, { stdio: "ignore" });
  if (!existsSync(shot)) throw new Error("no screenshot");
  data = readFileSync(shot).toString("base64");
  console.log("using a real screenshot");
} catch {
  data =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  console.log("using 1x1 red pixel fallback");
}

const session = await createCoach([]);
const reply = await ask(
  session,
  "[Fri 18 Jul, 15:40] (proof gate test) here's a photo — describe in one sentence what you can see.",
  [{ type: "image", data, mimeType: "image/png" }],
);
console.log("reply:", reply);
process.exit(0);
