import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import userSessionModel from "../model/userSessionModel";
import {
  buildSessionSnapshot,
  createSessionMetricsSummary,
  detectBrowser,
  detectDeviceType,
  detectOperatingSystem,
  extractClientIp,
  normalizeClientContext,
} from "../utils/userSessionTelemetry";

const ensureTrackedSession = async (req: Request) => {
  const userId = req.user?._id;
  if (!userId) {
    return {
      userId: null,
      session: null,
      sessionId: "",
    };
  }

  const sessionId = String((req.body as { sessionId?: unknown }).sessionId ?? "").trim();
  if (!sessionId) {
    return {
      userId,
      session: null,
      sessionId: "",
    };
  }

  const session = await userSessionModel.findOne({ sessionId, user: userId });
  return {
    userId,
    session,
    sessionId,
  };
};

const attachUserFromBodyToken = (req: Request) => {
  if (req.user?._id) {
    return true;
  }

  const bodyToken = String((req.body as { token?: unknown }).token ?? "").trim();
  if (!bodyToken) {
    return false;
  }

  try {
    req.user = jwt.verify(bodyToken, env.jwtSecret()) as Express.UserPayload;
    return true;
  } catch {
    return false;
  }
};

export const updateUserSessionPresence = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, session, sessionId } = await ensureTrackedSession(req);
    if (!userId) {
      return res.status(401).json({
        success: 0,
        message: "authentication is required",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: 0,
        message: "sessionId is required",
      });
    }

    if (!session) {
      return res.status(404).json({
        success: 0,
        message: "session not found",
      });
    }

    const { clientContext, event, status } = req.body as {
      clientContext?: unknown;
      event?: unknown;
      status?: unknown;
    };
    const normalizedClientContext = normalizeClientContext(clientContext);
    const userAgent =
      normalizedClientContext.userAgent?.trim() || String(req.headers["user-agent"] ?? "").trim() || session.userAgent;
    const platform = normalizedClientContext.platform ?? session.platform ?? "";

    session.lastSeenAt = new Date();
    session.lastEvent = typeof event === "string" && event.trim() ? event.trim() : "heartbeat";
    session.lastPath = normalizedClientContext.path ?? session.lastPath;
    session.lastVisibilityState = normalizedClientContext.visibilityState ?? session.lastVisibilityState;
    session.lastOnlineState = normalizedClientContext.online ?? session.lastOnlineState;
    session.ipAddress = extractClientIp(req) || session.ipAddress;
    session.userAgent = userAgent;
    session.deviceType = detectDeviceType(userAgent);
    session.browser = detectBrowser(userAgent);
    session.os = detectOperatingSystem(userAgent, platform);
    session.platform = platform;
    session.language = normalizedClientContext.language ?? session.language;
    session.timezone = normalizedClientContext.timezone ?? session.timezone;
    session.referrer = normalizedClientContext.referrer ?? session.referrer;

    if (normalizedClientContext.screen) {
      session.screen = {
        width: normalizedClientContext.screen.width ?? session.screen?.width ?? 0,
        height: normalizedClientContext.screen.height ?? session.screen?.height ?? 0,
        pixelRatio: normalizedClientContext.screen.pixelRatio ?? session.screen?.pixelRatio ?? 1,
      };
    }

    if (normalizedClientContext.utm) {
      session.utm = {
        source: normalizedClientContext.utm.source ?? session.utm?.source ?? "",
        medium: normalizedClientContext.utm.medium ?? session.utm?.medium ?? "",
        campaign: normalizedClientContext.utm.campaign ?? session.utm?.campaign ?? "",
        term: normalizedClientContext.utm.term ?? session.utm?.term ?? "",
        content: normalizedClientContext.utm.content ?? session.utm?.content ?? "",
      };
    }

    if (status === "idle" || status === "offline" || status === "online") {
      session.status = status;
    } else {
      session.status = normalizedClientContext.visibilityState === "hidden" ? "idle" : "online";
    }

    await session.save();

    return res.status(200).json({
      success: 1,
      message: "session presence updated",
      data: buildSessionSnapshot(session),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to update session presence",
    });
  }
};

export const updateUserSessionPresenceFromBeacon = async (req: Request, res: Response): Promise<Response> => {
  if (!attachUserFromBodyToken(req)) {
    return res.status(401).json({
      success: 0,
      message: "authentication is required",
    });
  }

  return updateUserSessionPresence(req, res);
};

export const getAdminUserSessions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const limitValue = Number(req.query.limit ?? 50);
    const normalizedLimit = Number.isFinite(limitValue)
      ? Math.min(Math.max(Math.trunc(limitValue), 1), 200)
      : 50;
    const requestedStatus = String(req.query.status ?? "").trim();
    const query = userSessionModel.find().sort({ loginAt: -1 }).limit(normalizedLimit);
    const records = await query.populate({
      path: "user",
      select: "userName email role",
    });
    const sessions = records.map((record) => buildSessionSnapshot(record));
    const filteredSessions = requestedStatus
      ? sessions.filter((session) => session.status === requestedStatus)
      : sessions;

    return res.status(200).json({
      success: 1,
      message: "user sessions",
      data: filteredSessions,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to retrieve user sessions",
    });
  }
};

export const getAdminUserSessionSummary = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const query = userSessionModel.find().sort({ loginAt: -1 }).limit(200);
    const records = await query.populate({
      path: "user",
      select: "userName email role",
    });

    return res.status(200).json({
      success: 1,
      message: "user session summary",
      data: createSessionMetricsSummary(records),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to retrieve user session summary",
    });
  }
};
