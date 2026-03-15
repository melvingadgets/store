import type { Request, Response } from "express";
import { assistantService } from "../assistant/assistantService";
import { getAssistantTimingSummary } from "../assistant/timingTelemetry";

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

export const assistantTimingSummary = (_req: Request, res: Response): Response =>
  res.status(200).json({
    success: 1,
    message: "assistant timing summary fetched successfully",
    data: getAssistantTimingSummary(),
  });
