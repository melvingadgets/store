import type { Request } from "express";

export const USER_SESSION_ACTIVE_WINDOW_MS = 90 * 1000;

type SessionStatus = "online" | "idle" | "offline" | "logged_out" | "expired";

type SessionLikeRecord = {
  sessionId?: unknown;
  loginAt?: unknown;
  lastSeenAt?: unknown;
  logoutAt?: unknown;
  tokenExpiresAt?: unknown;
  status?: unknown;
  lastEvent?: unknown;
  lastPath?: unknown;
  lastVisibilityState?: unknown;
  lastOnlineState?: unknown;
  ipAddress?: unknown;
  userAgent?: unknown;
  deviceType?: unknown;
  browser?: unknown;
  os?: unknown;
  platform?: unknown;
  language?: unknown;
  timezone?: unknown;
  referrer?: unknown;
  screen?: {
    width?: unknown;
    height?: unknown;
    pixelRatio?: unknown;
  } | null;
  utm?: {
    source?: unknown;
    medium?: unknown;
    campaign?: unknown;
    term?: unknown;
    content?: unknown;
  } | null;
  user?: {
    _id?: unknown;
    userName?: unknown;
    email?: unknown;
    role?: unknown;
  } | string | null;
  toObject?: () => Record<string, unknown>;
};

export interface SessionClientContext {
  userAgent?: string;
  platform?: string;
  language?: string;
  timezone?: string;
  referrer?: string;
  path?: string;
  visibilityState?: "visible" | "hidden" | "prerender";
  online?: boolean;
  screen?: {
    width?: number;
    height?: number;
    pixelRatio?: number;
  };
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
}

const asPlainObject = (record: SessionLikeRecord) =>
  typeof record?.toObject === "function"
    ? (record.toObject() as SessionLikeRecord)
    : record;

const asTrimmedString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const asOptionalTrimmedString = (value: unknown) => {
  const normalized = asTrimmedString(value);
  return normalized || undefined;
};

const asDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

export const extractClientIp = (req: Request) => {
  const forwardedHeader = req.headers["x-forwarded-for"];
  const forwarded = Array.isArray(forwardedHeader)
    ? forwardedHeader[0]
    : typeof forwardedHeader === "string"
      ? forwardedHeader
      : "";

  const candidate = forwarded.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "";
  return candidate.trim();
};

export const normalizeClientContext = (input: unknown): SessionClientContext => {
  if (typeof input === "string" && input.trim()) {
    try {
      return normalizeClientContext(JSON.parse(input));
    } catch {
      return {};
    }
  }

  if (!input || typeof input !== "object") {
    return {};
  }

  const context = input as Record<string, unknown>;
  const screen = context.screen && typeof context.screen === "object"
    ? (context.screen as Record<string, unknown>)
    : {};
  const utm = context.utm && typeof context.utm === "object"
    ? (context.utm as Record<string, unknown>)
    : {};

  return {
    userAgent: asOptionalTrimmedString(context.userAgent),
    platform: asOptionalTrimmedString(context.platform),
    language: asOptionalTrimmedString(context.language),
    timezone: asOptionalTrimmedString(context.timezone),
    referrer: asOptionalTrimmedString(context.referrer),
    path: asOptionalTrimmedString(context.path),
    visibilityState:
      context.visibilityState === "hidden" || context.visibilityState === "prerender"
        ? context.visibilityState
        : "visible",
    online: typeof context.online === "boolean" ? context.online : true,
    screen: {
      width: normalizeNumber(screen.width),
      height: normalizeNumber(screen.height),
      pixelRatio: normalizeNumber(screen.pixelRatio, 1),
    },
    utm: {
      source: asTrimmedString(utm.source),
      medium: asTrimmedString(utm.medium),
      campaign: asTrimmedString(utm.campaign),
      term: asTrimmedString(utm.term),
      content: asTrimmedString(utm.content),
    },
  };
};

export const detectDeviceType = (userAgent: string) => {
  const lower = userAgent.toLowerCase();

  if (!lower) {
    return "unknown";
  }

  if (/(bot|crawler|spider|crawl)/.test(lower)) {
    return "bot";
  }

  if (/(ipad|tablet|playbook|silk)|(android(?!.*mobile))/.test(lower)) {
    return "tablet";
  }

  if (/(mobi|iphone|ipod|android|phone)/.test(lower)) {
    return "mobile";
  }

  return "desktop";
};

export const detectBrowser = (userAgent: string) => {
  const lower = userAgent.toLowerCase();

  if (!lower) {
    return "Unknown";
  }

  if (lower.includes("edg/")) {
    return "Edge";
  }
  if (lower.includes("opr/") || lower.includes("opera")) {
    return "Opera";
  }
  if (lower.includes("chrome/") && !lower.includes("edg/")) {
    return "Chrome";
  }
  if (lower.includes("safari/") && !lower.includes("chrome/")) {
    return "Safari";
  }
  if (lower.includes("firefox/")) {
    return "Firefox";
  }

  return "Unknown";
};

export const detectOperatingSystem = (userAgent: string, platform = "") => {
  const lowerUserAgent = userAgent.toLowerCase();
  const lowerPlatform = platform.toLowerCase();
  const combined = `${lowerUserAgent} ${lowerPlatform}`;

  if (combined.includes("windows")) {
    return "Windows";
  }
  if (combined.includes("iphone") || combined.includes("ipad") || combined.includes("ios")) {
    return "iOS";
  }
  if (combined.includes("android")) {
    return "Android";
  }
  if (combined.includes("mac")) {
    return "macOS";
  }
  if (combined.includes("linux")) {
    return "Linux";
  }

  return "Unknown";
};

export const resolveTrackedSessionStatus = (record: SessionLikeRecord, now = new Date()): SessionStatus => {
  const plainRecord = asPlainObject(record);
  const logoutAt = asDate(plainRecord.logoutAt);
  if (logoutAt) {
    return "logged_out";
  }

  const tokenExpiresAt = asDate(plainRecord.tokenExpiresAt);
  if (tokenExpiresAt && tokenExpiresAt.getTime() <= now.getTime()) {
    return "expired";
  }

  const lastSeenAt = asDate(plainRecord.lastSeenAt);
  if (!lastSeenAt || now.getTime() - lastSeenAt.getTime() > USER_SESSION_ACTIVE_WINDOW_MS) {
    return "offline";
  }

  if (plainRecord.lastVisibilityState === "hidden" || plainRecord.status === "idle") {
    return "idle";
  }

  return "online";
};

export const buildSessionSnapshot = (record: SessionLikeRecord, now = new Date()) => {
  const plainRecord = asPlainObject(record);
  const user =
    plainRecord.user && typeof plainRecord.user === "object"
      ? {
          _id: asTrimmedString((plainRecord.user as Record<string, unknown>)._id),
          userName: asTrimmedString((plainRecord.user as Record<string, unknown>).userName),
          email: asTrimmedString((plainRecord.user as Record<string, unknown>).email),
          role: asTrimmedString((plainRecord.user as Record<string, unknown>).role),
        }
      : undefined;

  return {
    sessionId: asTrimmedString(plainRecord.sessionId),
    loginAt: asDate(plainRecord.loginAt)?.toISOString() ?? null,
    lastSeenAt: asDate(plainRecord.lastSeenAt)?.toISOString() ?? null,
    logoutAt: asDate(plainRecord.logoutAt)?.toISOString() ?? null,
    tokenExpiresAt: asDate(plainRecord.tokenExpiresAt)?.toISOString() ?? null,
    status: resolveTrackedSessionStatus(plainRecord, now),
    lastEvent: asTrimmedString(plainRecord.lastEvent),
    lastPath: asTrimmedString(plainRecord.lastPath),
    lastVisibilityState: asTrimmedString(plainRecord.lastVisibilityState) || "visible",
    lastOnlineState: typeof plainRecord.lastOnlineState === "boolean" ? plainRecord.lastOnlineState : true,
    ipAddress: asTrimmedString(plainRecord.ipAddress),
    userAgent: asTrimmedString(plainRecord.userAgent),
    deviceType: asTrimmedString(plainRecord.deviceType) || "unknown",
    browser: asTrimmedString(plainRecord.browser) || "Unknown",
    os: asTrimmedString(plainRecord.os) || "Unknown",
    platform: asTrimmedString(plainRecord.platform),
    language: asTrimmedString(plainRecord.language),
    timezone: asTrimmedString(plainRecord.timezone),
    referrer: asTrimmedString(plainRecord.referrer),
    screen: {
      width: normalizeNumber(plainRecord.screen?.width),
      height: normalizeNumber(plainRecord.screen?.height),
      pixelRatio: normalizeNumber(plainRecord.screen?.pixelRatio, 1),
    },
    utm: {
      source: asTrimmedString(plainRecord.utm?.source),
      medium: asTrimmedString(plainRecord.utm?.medium),
      campaign: asTrimmedString(plainRecord.utm?.campaign),
      term: asTrimmedString(plainRecord.utm?.term),
      content: asTrimmedString(plainRecord.utm?.content),
    },
    user,
  };
};

export const createSessionMetricsSummary = (records: SessionLikeRecord[], now = new Date()) => {
  const sessions = records.map((record) => buildSessionSnapshot(record, now));
  const counts = {
    online: 0,
    idle: 0,
    offline: 0,
    logged_out: 0,
    expired: 0,
  };
  const activeUsers = new Set<string>();
  const browserCounts = new Map<string, number>();
  const deviceTypeCounts = new Map<string, number>();
  const operatingSystemCounts = new Map<string, number>();

  for (const session of sessions) {
    counts[session.status] += 1;

    if ((session.status === "online" || session.status === "idle") && session.user?._id) {
      activeUsers.add(session.user._id);
    }

    browserCounts.set(session.browser, (browserCounts.get(session.browser) ?? 0) + 1);
    deviceTypeCounts.set(session.deviceType, (deviceTypeCounts.get(session.deviceType) ?? 0) + 1);
    operatingSystemCounts.set(session.os, (operatingSystemCounts.get(session.os) ?? 0) + 1);
  }

  const toSortedEntries = (input: Map<string, number>) =>
    [...input.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

  return {
    overview: {
      totalSessions: sessions.length,
      onlineCount: counts.online,
      idleCount: counts.idle,
      offlineCount: counts.offline,
      loggedOutCount: counts.logged_out,
      expiredCount: counts.expired,
      activeUsers: activeUsers.size,
    },
    breakdowns: {
      browsers: toSortedEntries(browserCounts),
      deviceTypes: toSortedEntries(deviceTypeCounts),
      operatingSystems: toSortedEntries(operatingSystemCounts),
    },
    recentSessions: sessions.slice(0, 10),
  };
};
