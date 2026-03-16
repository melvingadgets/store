export type AssistantIntent = "trade_in" | "product" | "general" | "unknown";
export type AssistantConfidence = "high" | "medium" | "low";
export type AssistantResponseKind = "product_answer" | "swap_answer" | "clarifier" | "handoff" | "general_answer";

export interface AssistantQuickReply {
  label: string;
  message: string;
}

export interface AssistantHandoffPayload {
  title: string;
  reason: string;
  contactLabel: string;
  contactValue: string;
}

export interface AssistantUserContext {
  productId?: string;
  productName?: string;
  route?: string;
}

export interface AssistantSessionMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: Date;
}

export interface AssistantStoredToolCall {
  name: string;
  arguments: Record<string, unknown>;
  ok: boolean;
  resultSummary?: string;
  error?: string;
  createdAt?: Date;
}

export interface AssistantRequestPayload {
  sessionId?: string;
  message: string;
  userContext?: AssistantUserContext;
  userId?: string;
}

export interface AssistantResponsePayload {
  sessionId: string;
  reply: string;
  intent: AssistantIntent;
  usedTools: Array<{ name: string; ok: boolean }>;
  confidence: AssistantConfidence;
  kind: AssistantResponseKind;
  quickReplies?: AssistantQuickReply[];
  handoff?: AssistantHandoffPayload | null;
}

export interface AssistantToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AssistantToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AssistantProviderItem = Record<string, unknown>;

export type AssistantRuntimeMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; toolCalls?: AssistantToolCall[] }
  | { role: "tool"; content: string; toolCallId: string; name: string }
  | { role: "provider"; items: AssistantProviderItem[] };

export type AssistantProviderResult =
  | { type: "final"; reply: string; intent: AssistantIntent }
  | { type: "tool_calls"; toolCalls: AssistantToolCall[]; responseItems?: AssistantProviderItem[] };

export interface AssistantProvider {
  run(input: {
    instructions?: string;
    messages: AssistantRuntimeMessage[];
    tools: AssistantToolDefinition[];
  }): Promise<AssistantProviderResult>;
}

export interface AssistantToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface AssistantToolRegistry {
  listTools(): AssistantToolDefinition[];
  executeToolCall(input: {
    name: string;
    arguments: Record<string, unknown>;
    userContext?: AssistantUserContext;
    userId?: string;
  }): Promise<AssistantToolResult>;
}
