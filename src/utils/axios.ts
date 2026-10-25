import axios, {
  AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { beginGlobalLoad } from "../lib/globalLoading";
import { isMelvinBridgeToken, reportBridgeResponse } from "../lib/melvinBridge";
import { notify } from "./notification";
import "react-toastify/dist/ReactToastify.css";

interface ApiErrorPayload {
  message?: string;
}

export type ApiClientRequestConfig = AxiosRequestConfig & {
  suppressGlobalLoader?: boolean;
};

type ApiClientInternalRequestConfig = InternalAxiosRequestConfig & {
  // Set when the request carried the Melvin OS token, so its answer can teach the bridge gate.
  __bridgeToken?: string;
  suppressGlobalLoader?: boolean;
  __globalLoadDone__?: (() => void) | null;
};

let resolveAuthToken: (() => string | null) | null = null;
let handleUnauthorizedResponse: (() => void) | null = null;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:2222/api/v1",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

export const setApiClientAuthTokenResolver = (resolver: (() => string | null) | null) => {
  resolveAuthToken = resolver;
};

export const setApiClientUnauthorizedHandler = (handler: (() => void) | null) => {
  handleUnauthorizedResponse = handler;
};

apiClient.interceptors.request.use(
  (config: ApiClientInternalRequestConfig) => {
    if (!config.suppressGlobalLoader) {
      config.__globalLoadDone__ = beginGlobalLoad();
    }

    const token = resolveAuthToken?.() ?? null;
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
      if (isMelvinBridgeToken(token)) config.__bridgeToken = token;
    }
    return config;
  },
  (error) => {
    (error.config as ApiClientInternalRequestConfig | undefined)?.__globalLoadDone__?.();

    const statusCode = error.response?.status;
    const authHeader = error.config?.headers?.Authorization;

    if (statusCode === 401 && authHeader && handleUnauthorizedResponse) {
      handleUnauthorizedResponse();
    }

    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const config = response.config as ApiClientInternalRequestConfig;
    config.__globalLoadDone__?.();
    if (config.__bridgeToken) reportBridgeResponse(config.__bridgeToken, response.status);
    return response;
  },
  (error) => {
    const config = error.config as ApiClientInternalRequestConfig | undefined;
    config?.__globalLoadDone__?.();
    // The OS token got an answer: expiry asks the OS for a fresh one; refused again falls back to
    // the store's own login (see bridgeGate.ts).
    const status = error.response?.status;
    if (config?.__bridgeToken && typeof status === "number") reportBridgeResponse(config.__bridgeToken, status);
    return Promise.reject(error);
  },
);

export const handleError = (error: unknown) => {
  const message = extractErrorMessage(error);
  notify("error", message);
};

export const extractErrorMessage = (error: unknown) => {
  if (error instanceof AxiosError) {
    return (error.response?.data as ApiErrorPayload | undefined)?.message ?? "Request failed";
  }

  if (error && typeof error === "object") {
    if ("data" in error) {
      const data = (error as { data?: unknown }).data;

      if (typeof data === "string" && data.trim()) {
        return data;
      }

      if (data && typeof data === "object" && "message" in data && typeof data.message === "string") {
        return data.message;
      }
    }

    if ("message" in error && typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }
  }

  return "An unexpected error occurred";
};

export const apiGet = (url: string, headers?: ApiClientRequestConfig) => apiClient.get(url, headers);
export const apiPost = (url: string, data: unknown, headers?: ApiClientRequestConfig) =>
  apiClient.post(url, data, headers);
export const apiPut = (url: string, data: unknown, config?: ApiClientRequestConfig) => apiClient.put(url, data, config);
export const apiDelete = (url: string, config?: ApiClientRequestConfig) => apiClient.delete(url, config);
export default apiClient;
