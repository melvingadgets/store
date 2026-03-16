import type { Request, Response } from "express";
import { assistantService } from "../assistant/assistantService";
import { getAssistantTimingSummary } from "../assistant/timingTelemetry";

const chunkReply = (reply: string) => reply.match(/\S+\s*/g) ?? [reply];

export const assistantMessage = async (req: Request, res: Response): Promise<Response> => {
  const { sessionId, message, userContext } = req.body as {
    sessionId?: string;
    message?: string;
    userContext?: {
      productId?: string;
      route?: string;
    };
  };

  if (!message?.trim()) {
    return res.status(400).json({
      success: 0,
      message: "message is required",
    });
  }

  const result = await assistantService.handleMessage({
    sessionId: sessionId?.trim() || undefined,
    message,
    userContext,
    userId: req.user?._id,
  });

  return res.status(200).json({
    success: 1,
    message: "assistant reply generated successfully",
    data: result,
  });
};

export const assistantMessageStream = async (req: Request, res: Response): Promise<void> => {
  const { sessionId, message, userContext } = req.body as {
    sessionId?: string;
    message?: string;
    userContext?: {
      productId?: string;
      route?: string;
    };
  };

  if (!message?.trim()) {
    res.status(400).json({
      success: 0,
      message: "message is required",
    });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const result = await assistantService.handleMessage({
      sessionId: sessionId?.trim() || undefined,
      message,
      userContext,
      userId: req.user?._id,
    });

    res.write(`${JSON.stringify({ type: "status", value: "streaming" })}\n`);
    chunkReply(result.reply).forEach((chunk) => {
      res.write(`${JSON.stringify({ type: "delta", text: chunk })}\n`);
    });
    res.write(`${JSON.stringify({ type: "final", data: result })}\n`);
  } catch (error) {
    res.write(
      `${JSON.stringify({
        type: "error",
        message: error instanceof Error ? error.message : "Assistant request failed",
      })}\n`,
    );
  } finally {
    res.end();
  }
};

export const assistantTimingSummary = (_req: Request, res: Response): Response =>
  res.status(200).json({
    success: 1,
    message: "assistant timing summary fetched successfully",
    data: getAssistantTimingSummary(),
  });
