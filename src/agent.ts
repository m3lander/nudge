import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  ModelRuntime,
  resolveCliModel,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type { ImageContent } from "@earendil-works/pi-ai";
import { config } from "./config";
import { PERSONA } from "./prompt";

export async function createCoach(customTools: ToolDefinition<any, any, any>[]): Promise<AgentSession> {
  const cwd = process.cwd();
  const agentDir = getAgentDir();
  const modelRuntime = await ModelRuntime.create();

  let model;
  if (config.agentModel) {
    const slash = config.agentModel.indexOf("/");
    const resolved = resolveCliModel({
      cliProvider: slash > 0 ? config.agentModel.slice(0, slash) : undefined,
      cliModel: slash > 0 ? config.agentModel.slice(slash + 1) : config.agentModel,
      modelRuntime,
    });
    if (resolved.model) {
      model = resolved.model;
    } else {
      console.warn(`[agent] could not resolve AGENT_MODEL "${config.agentModel}": ${resolved.error ?? "unknown"} — falling back to pi default`);
    }
  }

  const settingsManager = SettingsManager.create(cwd, agentDir);
  const resourceLoader = new DefaultResourceLoader({
    cwd,
    agentDir,
    settingsManager,
    systemPrompt: PERSONA,
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  });
  await resourceLoader.reload();

  const { session } = await createAgentSession({
    cwd,
    agentDir,
    modelRuntime,
    model,
    sessionManager: SessionManager.inMemory(),
    settingsManager,
    resourceLoader,
    noTools: "builtin",
    customTools,
  });

  console.log(`[agent] model: ${session.model?.id ?? "unknown"}`);
  return session;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Send one prompt through the session and return the assistant's reply text.
 * Prompts are serialized — the session can only run one turn at a time.
 */
export function ask(session: AgentSession, text: string, images?: ImageContent[]): Promise<string> {
  const run = async (): Promise<string> => {
    const before = session.messages.length;
    await session.prompt(text, images?.length ? { images } : undefined);
    const parts: string[] = [];
    for (const message of session.messages.slice(before)) {
      const m = message as { role?: string; content?: unknown };
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
      for (const c of m.content) {
        if (c?.type === "text" && typeof c.text === "string") parts.push(c.text);
      }
    }
    return parts.join("\n\n").trim();
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}
