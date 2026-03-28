import type { RuntimeConfig } from "../config.js";
import type { AgentProfile } from "./agent-registry.js";

type AgentExecutionInput = {
  agent: AgentProfile;
  campaignId: string;
  installedSkill: {
    slug: string;
    description: string;
    command: string;
  };
  context: Record<string, unknown>;
  nextAgentId?: string;
  apiKey?: string;
};

export type AgentExecutionOutput = {
  summary: string;
  context_delta: Record<string, unknown>;
  handoff_payload: Record<string, unknown>;
  db_actions: {
    keywords?: Array<{
      keyword: string;
      intent?: string;
      difficulty?: number;
      rankPosition?: number;
    }>;
    content?: {
      title: string;
      slug: string;
      html: string;
      cmsTarget?: string;
      featuredImageUrl?: string;
      publishStatus?: "draft" | "scheduled" | "published" | "failed";
      publishedUrl?: string;
      metadata?: Record<string, unknown>;
    };
    outreach?: Array<{
      prospectDomain: string;
      contactName?: string;
      contactEmail?: string;
      pitchSubject?: string;
      pitchBody?: string;
      outreachStatus?: "queued" | "sent" | "replied" | "won" | "lost";
      responseStatus?: string;
      metadata?: Record<string, unknown>;
    }>;
  };
  next_requirements?: string[];
};

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) {
    return trimmed.slice(first, last + 1);
  }

  throw new Error("No JSON object found in model response.");
}

function ensureOutputShape(payload: unknown): AgentExecutionOutput {
  if (!payload || typeof payload !== "object") {
    throw new Error("Agent execution output is not an object.");
  }

  const obj = payload as Record<string, unknown>;
  return {
    summary: typeof obj.summary === "string" ? obj.summary : "Completed execution.",
    context_delta:
      obj.context_delta && typeof obj.context_delta === "object"
        ? (obj.context_delta as Record<string, unknown>)
        : {},
    handoff_payload:
      obj.handoff_payload && typeof obj.handoff_payload === "object"
        ? (obj.handoff_payload as Record<string, unknown>)
        : {},
    db_actions:
      obj.db_actions && typeof obj.db_actions === "object"
        ? (obj.db_actions as AgentExecutionOutput["db_actions"])
        : {},
    next_requirements: Array.isArray(obj.next_requirements)
      ? obj.next_requirements.filter((entry): entry is string => typeof entry === "string")
      : []
  };
}

export class AnthropicClient {
  constructor(private readonly config: RuntimeConfig) {}

  async runAgent(input: AgentExecutionInput): Promise<AgentExecutionOutput> {
    const resolvedKey = input.apiKey ?? this.config.ANTHROPIC_API_KEY;
    if (!resolvedKey) {
      throw new Error("No Anthropic API key is available for this campaign.");
    }

    const prompt = [
      `Campaign ID: ${input.campaignId}`,
      `Agent: ${input.agent.name} (${input.agent.title})`,
      `Directive: ${input.agent.directive}`,
      `Installed skill slug: ${input.installedSkill.slug}`,
      `Installed skill description: ${input.installedSkill.description}`,
      `Installed skill command: ${input.installedSkill.command}`,
      `Next agent: ${input.nextAgentId ?? "none"}`,
      "Current shared context JSON:",
      JSON.stringify(input.context, null, 2),
      "",
      "Return only valid JSON with this exact shape:",
      JSON.stringify(
        {
          summary: "string",
          context_delta: {},
          handoff_payload: {},
          db_actions: {
            keywords: [
              {
                keyword: "string",
                intent: "string",
                difficulty: 40.5,
                rankPosition: 12
              }
            ],
            content: {
              title: "string",
              slug: "string",
              html: "<article>...</article>",
              cmsTarget: "string",
              featuredImageUrl: "https://...",
              publishStatus: "draft",
              publishedUrl: "https://...",
              metadata: {}
            },
            outreach: [
              {
                prospectDomain: "example.com",
                contactName: "string",
                contactEmail: "string",
                pitchSubject: "string",
                pitchBody: "string",
                outreachStatus: "sent",
                responseStatus: "string",
                metadata: {}
              }
            ]
          },
          next_requirements: ["string"]
        },
        null,
        2
      ),
      "Do not use markdown. Do not include explanations outside JSON."
    ].join("\n");

    const response = await fetch(`${this.config.ANTHROPIC_API_BASE_URL}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": resolvedKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: this.config.ANTHROPIC_MODEL,
        max_tokens: this.config.ANTHROPIC_MAX_TOKENS,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API request failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((part) => part.type === "text")?.text;
    if (!text) {
      throw new Error("Anthropic response did not contain text content.");
    }

    const jsonString = extractJsonObject(text);
    return ensureOutputShape(JSON.parse(jsonString));
  }
}
