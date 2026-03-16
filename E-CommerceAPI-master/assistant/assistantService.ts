import { randomUUID } from "crypto";
import { performance } from "perf_hooks";
import assistantSessionModel from "../model/assistantSessionModel";
import { createOpenAiProvider } from "./openAiProvider";
import { getAssistantInstructions } from "./promptLoader";
import {
  buildFinalAssistantResponse,
  validateFinalAssistantReply,
} from "./responsePolicy";
import { mergeAssistantUserContext, normalizeAssistantUserContext, updateAssistantUserContextFromTool } from "./sessionContext";
import { recordAssistantTiming } from "./timingTelemetry";
import { summarizeToolResult, toolRegistry } from "./toolRegistry";
import type {
  AssistantProvider,
  AssistantRequestPayload,
  AssistantResponsePayload,
  AssistantRuntimeMessage,
  AssistantSessionMessage,
  AssistantToolRegistry,
} from "./assistantTypes";

const MAX_TOOL_TURNS = 4;
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CONTENT_LENGTH = 320;
const FALLBACK_HANDOFF_REPLY = "I can't answer that confidently right now. Contact admin on +2347086758713.";

type PersistedToolCall = {
  name: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  resultSummary: string;
  error: string;
  createdAt: Date;
};

const createSessionDocument = async ({
  sessionModel,
  sessionId,
  userId,
}: {
  sessionModel: typeof assistantSessionModel;
  sessionId?: string;
  userId?: string;
}) => {
  if (sessionId) {
    const existingSession = await sessionModel.findOne(userId ? { sessionId, userId } : { sessionId });
    if (existingSession) {
      return existingSession;
    }

    if (userId) {
      const foreignSession = await sessionModel.findOne({ sessionId });
      if (foreignSession) {
        sessionId = undefined;
      }
    }
  }

  return sessionModel.create({
    sessionId: sessionId ?? randomUUID(),
    userId,
    messages: [],
    intent: "unknown",
    toolCalls: [],
  });
};

const persistToolCalls = (session: Awaited<ReturnType<typeof createSessionDocument>>, storedToolCalls: PersistedToolCall[]) => {
  storedToolCalls.forEach((toolCall) => {
    session.toolCalls.push(toolCall as never);
  });
};

const compactMessageContent = (value: string) => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= MAX_MESSAGE_CONTENT_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_MESSAGE_CONTENT_LENGTH - 1)}…`;
};

const compactHistory = (messages: AssistantSessionMessage[]) =>
  messages.slice(-MAX_HISTORY_MESSAGES).map((entry) => ({
    role: entry.role,
    content: compactMessageContent(entry.content),
  }));

const createTimingTracker = () => {
  const startedAt = performance.now();
  const marks: Array<{ stage: string; durationMs: number }> = [];
  let lastMark = startedAt;

  return {
    mark(stage: string) {
      const now = performance.now();
      marks.push({
        stage,
        durationMs: Number((now - lastMark).toFixed(2)),
      });
      lastMark = now;
    },
    flush(metadata: { sessionId: string; intent: string; usedTools: string[]; source: "model" | "fallback" }) {
      const totalMs = Number((performance.now() - startedAt).toFixed(2));
      recordAssistantTiming({
        sessionId: metadata.sessionId,
        intent: metadata.intent,
        source: metadata.source,
        usedTools: metadata.usedTools,
        totalMs,
        marks,
      });
      console.info(
        JSON.stringify({
          type: "assistant_timing",
          sessionId: metadata.sessionId,
          intent: metadata.intent,
          source: metadata.source,
          usedTools: metadata.usedTools,
          totalMs,
          marks,
        }),
      );
    },
  };
};

export const createAssistantService = ({
  provider,
  sessionModel = assistantSessionModel,
  registry = toolRegistry,
}: {
  provider?: AssistantProvider;
  sessionModel?: typeof assistantSessionModel;
  registry?: AssistantToolRegistry;
} = {}) => ({
  async handleMessage({
    sessionId,
    message,
    userContext,
  userId,
  }: AssistantRequestPayload): Promise<AssistantResponsePayload> {
    const timing = createTimingTracker();
    const session = await createSessionDocument({
      sessionModel,
      sessionId,
      userId,
    });
    timing.mark("session_lookup");
    const trimmedMessage = message.trim();
    const effectiveUserContext = mergeAssistantUserContext({
      persisted: normalizeAssistantUserContext((session.context ?? {}) as never),
      incoming: userContext,
    });
    let currentUserContext = effectiveUserContext;
    const instructions = getAssistantInstructions(effectiveUserContext);
    const usedTools: Array<{ name: string; ok: boolean }> = [];
    const storedToolCalls: PersistedToolCall[] = [];

    const history = compactHistory((session.messages ?? []) as AssistantSessionMessage[]);
    const runtimeMessages: AssistantRuntimeMessage[] = [
      ...history,
      { role: "user", content: compactMessageContent(trimmedMessage) },
    ];

    session.context = {
      productId: effectiveUserContext.productId ?? "",
      productName: effectiveUserContext.productName ?? "",
      productCapacity: effectiveUserContext.productCapacity ?? "",
      route: effectiveUserContext.route ?? "",
      tradeInModel: effectiveUserContext.tradeInModel ?? "",
      tradeInStorage: effectiveUserContext.tradeInStorage ?? "",
    };

    session.messages.push({
      role: "user",
      content: trimmedMessage,
      createdAt: new Date(),
    });

    try {
      const activeProvider = provider ?? createOpenAiProvider();
      timing.mark("provider_ready");

      for (let turn = 0; turn < MAX_TOOL_TURNS; turn += 1) {
        const providerResult = await activeProvider.run({
          instructions,
          messages: runtimeMessages,
          tools: registry.listTools(),
        });
        timing.mark(`provider_turn_${turn + 1}`);

        if (providerResult.type === "final") {
          const validation = validateFinalAssistantReply({
            message: trimmedMessage,
            providerReply: providerResult.reply,
            providerIntent: providerResult.intent,
            usedTools,
            userContext: currentUserContext,
          });

          if (!validation.ok && turn < MAX_TOOL_TURNS - 1) {
            runtimeMessages.push({
              role: "assistant",
              content: providerResult.reply,
            });
            runtimeMessages.push({
              role: "system",
              content: validation.retryInstruction ?? FALLBACK_HANDOFF_REPLY,
            });
            continue;
          }

          if (!validation.ok) {
            break;
          }

          const finalResponse = buildFinalAssistantResponse({
            sessionId: session.sessionId,
            message: trimmedMessage,
            providerReply: providerResult.reply,
            providerIntent: providerResult.intent,
            usedTools,
            userContext: currentUserContext,
          });
          session.intent = finalResponse.intent;
          session.messages.push({
            role: "assistant",
            content: finalResponse.reply,
            createdAt: new Date(),
          });
          persistToolCalls(session, storedToolCalls);
          await session.save();
          timing.mark("session_save");
          timing.flush({
            sessionId: session.sessionId,
            intent: finalResponse.intent,
            source: "model",
            usedTools: usedTools.map((tool) => tool.name),
          });

          return finalResponse;
        }

        if (providerResult.responseItems?.length) {
          runtimeMessages.push({
            role: "provider",
            items: providerResult.responseItems,
          });
        }

        for (const toolCall of providerResult.toolCalls) {
          const toolResult = await registry.executeToolCall({
            name: toolCall.name,
            arguments: toolCall.arguments,
            userContext: currentUserContext,
            userId,
          });
          timing.mark(`tool_${toolCall.name}`);

          usedTools.push({
            name: toolCall.name,
            ok: toolResult.ok,
          });
          if (toolResult.ok) {
            const updatedContext = updateAssistantUserContextFromTool({
              current: session.context as never,
              toolCall,
              toolResult,
            });
            session.context = {
              productId: updatedContext.productId ?? "",
              productName: updatedContext.productName ?? "",
              productCapacity: updatedContext.productCapacity ?? "",
              route: updatedContext.route ?? effectiveUserContext.route ?? "",
              tradeInModel: updatedContext.tradeInModel ?? "",
              tradeInStorage: updatedContext.tradeInStorage ?? "",
            };
            currentUserContext = normalizeAssistantUserContext(session.context as never);
          }
          storedToolCalls.push({
            name: toolCall.name,
            arguments: toolCall.arguments,
            ok: toolResult.ok,
            resultSummary: toolResult.ok ? summarizeToolResult(toolResult.data) : "",
            error: toolResult.ok ? "" : String(toolResult.error ?? "Tool execution failed."),
            createdAt: new Date(),
          });

          runtimeMessages.push({
            role: "tool",
            toolCallId: toolCall.id,
            name: toolCall.name,
            content: JSON.stringify(toolResult.ok ? toolResult.data : { error: toolResult.error }),
          });
        }
      }

      session.messages.push({
        role: "assistant",
        content: FALLBACK_HANDOFF_REPLY,
        createdAt: new Date(),
      });
      persistToolCalls(session, storedToolCalls);
      await session.save();
      timing.mark("session_save");
      timing.flush({
        sessionId: session.sessionId,
        intent: session.intent ?? "unknown",
        source: "fallback",
        usedTools: usedTools.map((tool) => tool.name),
      });

      return {
        sessionId: session.sessionId,
        reply: FALLBACK_HANDOFF_REPLY,
        intent: session.intent ?? "unknown",
        usedTools,
        confidence: "low",
        kind: "handoff",
        quickReplies: undefined,
        handoff: null,
      };
    } catch {
      session.messages.push({
        role: "assistant",
        content: FALLBACK_HANDOFF_REPLY,
        createdAt: new Date(),
      });
      persistToolCalls(session, storedToolCalls);
      await session.save();
      timing.mark("session_save");
      timing.flush({
        sessionId: session.sessionId,
        intent: session.intent ?? "unknown",
        source: "fallback",
        usedTools: usedTools.map((tool) => tool.name),
      });

      return {
        sessionId: session.sessionId,
        reply: FALLBACK_HANDOFF_REPLY,
        intent: session.intent ?? "unknown",
        usedTools,
        confidence: "low",
        kind: "handoff",
        quickReplies: undefined,
        handoff: null,
      };
    }
  },
});

export const assistantService = createAssistantService();
