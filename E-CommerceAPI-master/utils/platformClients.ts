import {
  createPlatformHttpClient,
  createServiceTokenProvider,
  type PlatformHttpClient,
  type ServiceTokenProvider,
} from "@melvingadgets/platform-kit";
import { env } from "../config/env";

// Clients for calling other platform services with service tokens (Shortwork/AGENTS.md §2).
// Null while unconfigured, so callers keep their old paths during the rollout (§7.1).

const { authIssuer, clientId, clientSecret, easyBuyApiUrl } = env.platform;

const tokens: ServiceTokenProvider | null =
  authIssuer && clientId && clientSecret
    ? createServiceTokenProvider({ tokenUrl: `${authIssuer}/oauth/token`, clientId, clientSecret })
    : null;

export const easyBuyClient: PlatformHttpClient | null =
  tokens && easyBuyApiUrl ? createPlatformHttpClient({ target: "easybuy", baseUrl: easyBuyApiUrl, tokens }) : null;
