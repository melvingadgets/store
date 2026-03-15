import type { UserSessionClientContext, UserSessionRecord, UserSessionStatus } from "../types/domain";
import apiClient, { type ApiClientRequestConfig } from "./axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:2222/api/v1";

const getCurrentPath = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;

export const buildUserSessionClientContext = (): UserSessionClientContext => {
  if (typeof window === "undefined") {
    return {};
  }

  const url = new URL(window.location.href);

  return {
    userAgent: window.navigator.userAgent,
    platform: window.navigator.platform,
    language: window.navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    referrer: document.referrer,
    path: getCurrentPath(),
    visibilityState: document.visibilityState === "hidden" ? "hidden" : "visible",
    online: window.navigator.onLine,
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      pixelRatio: window.devicePixelRatio || 1,
    },
    utm: {
      source: url.searchParams.get("utm_source") ?? "",
      medium: url.searchParams.get("utm_medium") ?? "",
      campaign: url.searchParams.get("utm_campaign") ?? "",
      term: url.searchParams.get("utm_term") ?? "",
      content: url.searchParams.get("utm_content") ?? "",
    },
  };
};

interface SendUserSessionPresenceArgs {
  token: string;
  sessionId: string;
  event: string;
  status?: UserSessionStatus;
  keepalive?: boolean;
}

export const sendUserSessionPresence = async ({
  token,
  sessionId,
  event,
  status,
  keepalive = false,
}: SendUserSessionPresenceArgs) => {
  if (!token || !sessionId) {
    return null;
  }

  const payload = {
    sessionId,
    event,
    status,
    clientContext: buildUserSessionClientContext(),
  };

  if (keepalive) {
    const beaconPayload = new URLSearchParams({
      token,
      sessionId,
      event,
      ...(status ? { status } : {}),
      clientContext: JSON.stringify(payload.clientContext),
    });

    try {
      if ("sendBeacon" in navigator) {
        navigator.sendBeacon(`${API_BASE_URL}/session/presence-beacon`, beaconPayload);
      } else {
        await fetch(`${API_BASE_URL}/session/presence-beacon`, {
          method: "POST",
          keepalive: true,
          body: beaconPayload,
        });
      }
    } catch {
      // Keepalive updates are best-effort only.
    }

    return null;
  }

  try {
    const response = await apiClient.post<{ data: UserSessionRecord }>(
      "/session/presence",
      payload,
      { suppressGlobalLoader: true } as ApiClientRequestConfig,
    );

    return response.data.data;
  } catch {
    return null;
  }
};
