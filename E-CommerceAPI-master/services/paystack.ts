import crypto from "crypto";
import { env } from "../config/env";

export interface InitializePaystackInput {
  email: string;
  amountKobo: number;
  currency?: "NGN";
  reference: string;
  callbackUrl: string;
  cancelUrl?: string;
  metadata?: Record<string, string | number>;
}

export interface InitializedPaystackTransaction {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifiedPaystackTransaction {
  id: string;
  reference: string;
  status: string;
  currency: string;
  amountKobo: number;
  gatewayResponse: string;
  channel: string;
}

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;

const REQUEST_TIMEOUT_MS = 8000;

export class PaystackApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 502) {
    super(message);
    this.name = "PaystackApiError";
    this.statusCode = statusCode;
  }
}

export const buildPaystackReference = (kind: "user" | "guest", orderId: string): string =>
  `psk-${kind === "guest" ? "g" : "u"}-${orderId}-${crypto.randomUUID().slice(0, 8)}`;

export const verifyPaystackWebhookSignature = (
  rawBody: Buffer,
  incomingSignature: string | undefined,
  secretKey: string | null,
): boolean => {
  if (!incomingSignature || !secretKey || rawBody.length === 0) {
    return false;
  }

  const expectedHex = crypto.createHmac("sha512", secretKey).update(rawBody).digest("hex");
  const normalizedIncoming = incomingSignature.trim().toLowerCase();
  const incomingBuffer = Buffer.from(normalizedIncoming, "utf8");
  const expectedBuffer = Buffer.from(expectedHex, "utf8");

  if (incomingBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(incomingBuffer, expectedBuffer);
};

const parsePaystackJson = async (response: Response): Promise<JsonObject> => {
  const text = await response.text();
  if (!text) {
    return {};
  }
  try {
    return asObject(JSON.parse(text)) ?? {};
  } catch {
    return {};
  }
};

const authHeaders = (): Record<string, string> => {
  if (!env.paystack.secretKey) {
    throw new PaystackApiError("Paystack secret key is not configured", 503);
  }

  return {
    Authorization: `Bearer ${env.paystack.secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

export const paystackGateway = {
  async initializeTransaction(input: InitializePaystackInput): Promise<InitializedPaystackTransaction> {
    if (!Number.isSafeInteger(input.amountKobo) || input.amountKobo <= 0) {
      throw new PaystackApiError("invalid payment amount", 400);
    }

    const metadata: Record<string, unknown> = {
      ...(input.metadata ?? {}),
      ...(input.cancelUrl ? { cancel_action: input.cancelUrl } : {}),
    };

    const response = await fetch(`${env.paystack.baseUrl}/transaction/initialize`, {
      method: "POST",
      headers: authHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: input.currency ?? "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata,
      }),
    });

    const payload = await parsePaystackJson(response);
    const data = asObject(payload.data);
    const authorizationUrl = data?.authorization_url;
    const accessCode = data?.access_code;
    const reference = data?.reference;

    if (
      !response.ok ||
      payload.status !== true ||
      typeof authorizationUrl !== "string" ||
      !authorizationUrl ||
      typeof accessCode !== "string" ||
      !accessCode
    ) {
      const upstreamMessage = typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : "Unable to initialize Paystack transaction";
      throw new PaystackApiError(upstreamMessage, response.status >= 400 && response.status < 500 ? 400 : 502);
    }

    return {
      authorizationUrl,
      accessCode,
      reference: typeof reference === "string" && reference ? reference : input.reference,
    };
  },

  async verifyTransaction(reference: string): Promise<VerifiedPaystackTransaction> {
    const cleanReference = String(reference ?? "").trim();
    if (!cleanReference) {
      throw new PaystackApiError("reference is required", 400);
    }

    const response = await fetch(
      `${env.paystack.baseUrl}/transaction/verify/${encodeURIComponent(cleanReference)}`,
      {
        method: "GET",
        headers: authHeaders(),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    );

    const payload = await parsePaystackJson(response);
    const data = asObject(payload.data);

    if (!response.ok || payload.status !== true || !data) {
      const upstreamMessage = typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : "Unable to verify Paystack transaction";
      throw new PaystackApiError(upstreamMessage, response.status === 404 ? 404 : 502);
    }

    const amountKobo = Number(data.amount ?? -1);
    if (!Number.isSafeInteger(amountKobo) || amountKobo < 0) {
      throw new PaystackApiError("Invalid payment amount returned by Paystack", 502);
    }

    return {
      id: String(data.id ?? ""),
      reference: String(data.reference ?? cleanReference),
      status: String(data.status ?? "").toLowerCase(),
      currency: String(data.currency ?? "").toUpperCase(),
      amountKobo,
      gatewayResponse: String(data.gateway_response ?? ""),
      channel: String(data.channel ?? ""),
    };
  },
};
