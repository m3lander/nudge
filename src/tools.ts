import { defineTool, type ToolDefinition } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { config } from "./config";
import { EFFECTS, type EffectName } from "./imessage";
import type { Scheduler } from "./scheduler";

const ok = (text: string, details: unknown = {}) => ({
  content: [{ type: "text" as const, text }],
  details,
});

export interface CoachActions {
  celebrate(text: string, effectName: EffectName): Promise<void>;
  react(emoji: string): Promise<boolean>;
  sendPoll(question: string, options: string[]): Promise<void>;
}

export function createCoachTools(scheduler: Scheduler, actions: CoachActions): ToolDefinition<any, any, any>[] {
  const scheduleCheckin = defineTool({
    name: "schedule_checkin",
    label: "Schedule check-in",
    description:
      "Schedule a future check-in. When it fires you will be woken up to text the user. Use after agreeing on a task step. Set silent=true when the user shouldn't know the exact timing (anxiety-friendly accountability).",
    parameters: Type.Object({
      delay_minutes: Type.Number({
        minimum: 0.2,
        description: "How many minutes from now the check-in should fire.",
      }),
      note: Type.String({
        description:
          "Note to your future self: the task, the agreed step, and what to ask about.",
      }),
      silent: Type.Optional(
        Type.Boolean({
          description: "If true, the user was not told when this will fire. Default false.",
        }),
      ),
      capture_screen: Type.Optional(
        Type.Boolean({
          description:
            "If true, when the timer fires the user's frontmost window is auto-screenshotted and shown to you as proof. Only set this when you TOLD the user you'll peek at their screen. Default false.",
        }),
      ),
    }),
    execute: async (_id, params) => {
      const c = scheduler.schedule(
        params.delay_minutes * 60,
        params.note,
        params.silent ?? false,
        params.capture_screen ?? false,
      );
      const scaled = config.timeScale !== 1 ? ` (demo TIME_SCALE=${config.timeScale} applied)` : "";
      return ok(
        `Check-in #${c.id} scheduled for ${params.delay_minutes} min from now${scaled}. Fires at ${new Date(c.fireAtMs).toLocaleTimeString()}.`,
        c,
      );
    },
  });

  const cancelCheckin = defineTool({
    name: "cancel_checkin",
    label: "Cancel check-in",
    description: "Cancel a pending check-in by id (e.g. task done early or user rescheduled).",
    parameters: Type.Object({
      id: Type.Number({ description: "The check-in id to cancel." }),
    }),
    execute: async (_id, params) => {
      const removed = scheduler.cancel(params.id);
      return ok(removed ? `Check-in #${params.id} cancelled.` : `No pending check-in #${params.id}.`);
    },
  });

  const listCheckins = defineTool({
    name: "list_checkins",
    label: "List check-ins",
    description: "List all pending check-ins with their ids, notes and fire times.",
    parameters: Type.Object({}),
    execute: async () => {
      const pending = scheduler.list();
      if (pending.length === 0) return ok("No pending check-ins.");
      const lines = pending.map(
        (c) =>
          `#${c.id} at ${new Date(c.fireAtMs).toLocaleTimeString()}${c.silent ? " (silent)" : ""}: ${c.note}`,
      );
      return ok(lines.join("\n"), { pending });
    },
  });

  const effectNames = Object.keys(EFFECTS) as EffectName[];
  const celebrate = defineTool({
    name: "celebrate",
    label: "Celebrate",
    description:
      "Send a message with a full-screen iMessage effect. Use confetti/fireworks/balloons/lasers/sparkles/celebration for REAL completions (especially passed proof gates) — sparingly, so it stays special. Use slam or loud for dramatic playful interventions when the user is doomscrolling.",
    parameters: Type.Object({
      text: Type.String({ description: "The message to send with the effect. Short and punchy." }),
      effect: Type.Union(
        effectNames.map((n) => Type.Literal(n)),
        { description: `One of: ${effectNames.join(", ")}` },
      ),
    }),
    execute: async (_id, params) => {
      await actions.celebrate(params.text, params.effect as EffectName);
      return ok(`Sent with ${params.effect} effect.`);
    },
  });

  const react = defineTool({
    name: "react",
    label: "React",
    description:
      "Tapback-react to the user's last message with an emoji (❤️ 👍 😂 ‼️ etc). Great for lightweight acknowledgment — e.g. ❤️ a proof photo before (or instead of) replying in words.",
    parameters: Type.Object({
      emoji: Type.String({ description: "A single emoji to react with." }),
    }),
    execute: async (_id, params) => {
      const done = await actions.react(params.emoji);
      return ok(done ? `Reacted ${params.emoji}.` : "No recent message to react to.");
    },
  });

  const sendPoll = defineTool({
    name: "send_poll",
    label: "Send poll",
    description:
      "Send a tappable poll card — the user answers with ONE TAP instead of typing. Prefer this for check-ins ('how'd it go?' → 'crushed it / sort of / didn't start') and quick decisions. Removing reply friction is the point: a poll gets an answer where a question gets ghosted. 2-4 short options. You'll be told which option they tapped.",
    parameters: Type.Object({
      question: Type.String({ description: "The poll question. Short." }),
      options: Type.Array(Type.String(), {
        minItems: 2,
        maxItems: 4,
        description: "2-4 short tappable options.",
      }),
    }),
    execute: async (_id, params) => {
      await actions.sendPoll(params.question, params.options);
      return ok(`Poll sent: "${params.question}" [${params.options.join(" / ")}]`);
    },
  });

  return [scheduleCheckin, cancelCheckin, listCheckins, celebrate, react, sendPoll];
}
