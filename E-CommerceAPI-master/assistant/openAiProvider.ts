import { env } from "../config/env";
import type {
  AssistantIntent,
  AssistantProvider,
  AssistantProviderItem,
  AssistantProviderResult,
  AssistantRuntimeMessage,
} from "./assistantTypes";

const OPENAI_DEFAULT_BASE_URL = "https://api.openai.com/v1";

const isAssistantIntent = (value: string): value is AssistantIntent =>
  value === "trade_in" || value === "product" || value === "general" || value === "unknown";

const parseFinalAssistantReply = (content: string | null | undefined): AssistantProviderResult => {
  const rawContent = String(content ?? "").trim();

  if (!rawContent) {
    return {
      type: "final",
      reply: "I could not generate a reply right now.",
      intent: "unknown",
    };
  }

  try {
    const parsed = JSON.parse(rawContent) as { reply?: string; intent?: string };
    const parsedIntent = typeof parsed.intent === "string" ? parsed.intent : "";

    return {
      type: "final",
      reply: typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim() : rawContent,
      intent: isAssistantIntent(parsedIntent) ? parsedIntent : "unknown",
    };
  } catch {
    return {
      type: "final",
      reply: rawContent,
      intent: "unknown",
    };
  }
};

const extractResponseText = (output: Array<Record<string, unknown>> | undefined) => {
  const messageItem = (output ?? []).find((item) => item.type === "message");
  if (!messageItem || !Array.isArray(messageItem.content)) {
    return "";
  }

  return messageItem.content
    .map((contentItem) => {
      if (
        contentItem
        && typeof contentItem === "object"
        && "text" in contentItem
        && typeof contentItem.text === "string"
      ) {
        return contentItem.text;
      }

      return "";
    })
    .join("")
    .trim();
};

const mapRuntimeMessagesToResponsesInput = (messages: AssistantRuntimeMessage[]): AssistantProviderItem[] =>
  messages.flatMap((message) => {
    if (message.role === "provider") {
      return message.items;
    }

    if (message.role === "tool") {
      return [
        {
          type: "function_call_output",
          call_id: message.toolCallId,
          output: message.content,
        },
      ];
    }

    if (message.role === "assistant") {
      if (message.toolCalls?.length) {
        return message.toolCalls.map((toolCall) => ({
          type: "function_call",
          call_id: toolCall.id,
          name: toolCall.name,
          arguments: JSON.stringify(toolCall.arguments),
        }));
      }

      return message.content
        ? [
            {
              role: "assistant",
              content: message.content,
            },
          ]
        : [];
    }

    return [
      {
        role: message.role,
        content: message.content,
      },
    ];
  });

export const createOpenAiProvider = (): AssistantProvider => {
  const provider = env.ai.provider ?? "openai";

  if (provider !== "openai") {
    throw new Error(`Unsupported AI provider: ${provider}`);
  }

  if (!env.ai.apiKey) {
    throw new Error("AI_API_KEY is not configured");
  }

  if (!env.ai.model) {
    throw new Error("AI_MODEL is not configured");
  }

  return {
    async run({ instructions, messages, tools }) {
      const response = await fetch(`${env.ai.baseUrl ?? OPENAI_DEFAULT_BASE_URL}/responses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.ai.apiKey}`,
        },
        body: JSON.stringify({
          model: env.ai.model,
          ...(instructions ? { instructions } : {}),
          reasoning: {
            effort: "medium",
          },
          input: mapRuntimeMessagesToResponsesInput(messages),
          tools: tools.map((tool) => ({
            type: "function",
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          })),
          text: {
            format: {
              type: "json_schema",
              name: "assistant_response",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  reply: {
                    type: "string",
                  },
                  intent: {
                    type: "string",
                    enum: ["trade_in", "product", "general", "unknown"],
                  },
                },
                required: ["reply", "intent"],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`AI provider request failed: ${response.status} ${errorBody}`);
      }

      const payload = (await response.json()) as {
        output?: Array<{
          type?: string;
          call_id?: string;
          name?: string;
          arguments?: string;
          content?: Array<{ type?: string; text?: string }>;
        }>;
        output_text?: string;
      };

      const output = (payload.output ?? []) as Array<Record<string, unknown>>;
      const functionCalls = payload.output?.filter((item) => item.type === "function_call") ?? [];

      if (functionCalls.length) {
        return {
          type: "tool_calls",
          responseItems: output,
          toolCalls: functionCalls.map((toolCall, index) => ({
            id: toolCall.call_id ?? `tool-${Date.now()}-${index}`,
            name: toolCall.name ?? "unknown",
            arguments: (() => {
              try {
                return JSON.parse(toolCall.arguments ?? "{}") as Record<string, unknown>;
              } catch {
                return {};
              }
            })(),
          })),
        };
      }

      return parseFinalAssistantReply(payload.output_text ?? extractResponseText(output));
    },
  };
};
