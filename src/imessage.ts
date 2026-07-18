import type { ImageContent } from "@earendil-works/pi-ai";
import { convertToPng } from "@earendil-works/pi-coding-agent";
import { poll, Spectrum, type Content, type Message, type Space } from "spectrum-ts";
import { effect, imessage } from "spectrum-ts/providers/imessage";
import { config, isOwner } from "./config";

const MAX_CHUNK = 900;

export const EFFECTS = {
  confetti: imessage.effect.message.confetti,
  fireworks: imessage.effect.message.fireworks,
  balloons: imessage.effect.message.balloons,
  lasers: imessage.effect.message.lasers,
  sparkles: imessage.effect.message.sparkles,
  celebration: imessage.effect.message.celebration,
  slam: imessage.effect.message.slam,
  loud: imessage.effect.message.loud,
} as const;
export type EffectName = keyof typeof EFFECTS;

export interface Incoming {
  text: string;
  images: ImageContent[];
  space: Space;
}

/**
 * Spectrum cloud iMessage layer: the agent texts from its own Photon-managed
 * number. The owner's DM space is pre-opened at boot so proactive check-ins
 * work even before (or without) an inbound message.
 */
export class Messenger {
  private app: Awaited<ReturnType<typeof Spectrum>> | undefined;
  private ownerSpace: Space | undefined;
  private lastInbound: Message | undefined;

  async start(onMessage: (incoming: Incoming) => Promise<void>): Promise<void> {
    if (!process.env.SPECTRUM_PROJECT_ID || !process.env.SPECTRUM_PROJECT_SECRET) {
      throw new Error("Set SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET in .env (photon.codes dashboard → project settings).");
    }
    const app = await Spectrum({
      projectId: process.env.SPECTRUM_PROJECT_ID,
      projectSecret: process.env.SPECTRUM_PROJECT_SECRET,
      providers: [imessage.config()],
      options: { flattenGroups: true },
    });
    this.app = app;

    const primary = config.ownerHandles[0];
    if (primary) {
      try {
        this.ownerSpace = await imessage(app).space.create(primary);
        console.log(`[imessage] owner DM space ready: ${this.ownerSpace.id}`);
      } catch (err) {
        console.warn("[imessage] couldn't pre-open owner DM (will bind on first inbound):", err);
      }
    }

    void (async () => {
      for await (const [space, message] of app.messages) {
        try {
          if (message.direction !== "inbound") continue;
          const sender = message.sender?.id ?? "";
          if (!isOwner(sender) && !isOwner(space.id)) {
            console.log(`[imessage] ignoring message from ${sender || space.id}`);
            continue;
          }
          this.ownerSpace = space;
          this.lastInbound = message;
          const extracted = await extractContent(message.content);
          if (!extracted.text && extracted.images.length === 0) continue;
          await onMessage({ ...extracted, space });
        } catch (err) {
          console.error("[imessage] handler error:", err);
        }
      }
    })();
  }

  /** Show the typing indicator in the owner DM while fn runs. */
  async withTyping<T>(fn: () => Promise<T>): Promise<T> {
    if (this.ownerSpace) return this.ownerSpace.responding(fn);
    return fn();
  }

  async sendText(text: string, space: Space | undefined = this.ownerSpace): Promise<void> {
    if (!space) {
      console.error("[imessage] no space to send to — has the owner DM been opened?");
      return;
    }
    for (const chunk of splitChunks(text)) {
      await space.send(chunk);
    }
  }

  /** Send a message with a full-screen/bubble iMessage effect (confetti, fireworks, …). */
  async sendEffect(text: string, name: EffectName, space: Space | undefined = this.ownerSpace): Promise<void> {
    if (!space) {
      console.error("[imessage] no space for effect send");
      return;
    }
    await space.send(effect(text, EFFECTS[name]));
  }

  /** Send a tappable poll card (one-tap check-in responses). */
  async sendPoll(question: string, options: string[], space: Space | undefined = this.ownerSpace): Promise<void> {
    if (!space) {
      console.error("[imessage] no space for poll send");
      return;
    }
    await space.send(poll(question, options));
  }

  /** Tapback-react to the most recent inbound message. */
  async reactToLast(emoji: string): Promise<boolean> {
    if (!this.lastInbound) return false;
    await this.lastInbound.react(emoji);
    return true;
  }

  async stop(): Promise<void> {
    await this.app?.stop();
  }
}

async function extractContent(content: Content): Promise<{ text: string; images: ImageContent[] }> {
  switch (content.type) {
    case "text":
      return { text: content.text.trim(), images: [] };
    case "attachment": {
      if (!content.mimeType.toLowerCase().startsWith("image/")) {
        return { text: `(sent a non-image file: ${content.name})`, images: [] };
      }
      const bytes = await content.read();
      return { text: "", images: [await toImageContent(bytes, content.mimeType)] };
    }
    case "reply":
      return extractContent(content.content as Content);
    case "poll_option":
      return {
        text: `(tapped "${content.option.title}" on your poll "${content.poll.title}")`,
        images: [],
      };
    case "group": {
      const parts = await Promise.all(content.items.map((m) => extractContent(m.content)));
      return {
        text: parts.map((p) => p.text).filter(Boolean).join("\n"),
        images: parts.flatMap((p) => p.images),
      };
    }
    default:
      return { text: "", images: [] };
  }
}

async function toImageContent(bytes: Buffer, mimeType: string): Promise<ImageContent> {
  const base64 = bytes.toString("base64");
  const mime = mimeType.toLowerCase();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
    return { type: "image", data: base64, mimeType: mime };
  }
  const converted = await convertToPng(base64, mime);
  if (converted) return { type: "image", data: converted.data, mimeType: converted.mimeType };
  return { type: "image", data: base64, mimeType: mime };
}

function splitChunks(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHUNK) return trimmed ? [trimmed] : [];
  const chunks: string[] = [];
  let current = "";
  for (const para of trimmed.split(/\n\n+/)) {
    if (current && current.length + para.length + 2 > MAX_CHUNK) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}
