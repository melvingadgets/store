import type { Request, Response } from "express";
import { env, hasPaystackPaymentConfig } from "../config/env";
import guestCheckoutModel from "../model/guestCheckoutModel";
import orderModel from "../model/orderModel";
import profileModel from "../model/profileModel";
import userModel from "../model/userModel";
import {
  buildPaystackReference,
  PaystackApiError,
  paystackGateway,
  verifyPaystackWebhookSignature,
} from "../services/paystack";
import {
  markOrderPaidByGateway,
  orderMoney,
  type StoreOrderKind,
  type StoreOrderRecord,
} from "../services/orderPayments";
import { isAllowedOrigin } from "../utils/corsHelper";
import { traceIdOf } from "../utils/platformMessaging";

const OBJECT_ID_PATTERN = /^[a-f0-9]{24}$/i;

const sanitizeText = (value: unknown) => String(value ?? "").trim();

const resolveRedirectUrl = (candidate: unknown): { ok: true; url: string } | { ok: false; message: string } => {
  const defaultOrigin = env.corsOrigins[0] || "http://localhost:5173";
  const raw = sanitizeText(candidate);
  if (!raw) {
    return { ok: true, url: `${defaultOrigin.replace(/\/+$/, "")}/orderconfirm` };
  }

  try {
    const parsed = new URL(raw);
    if (!/^https?:$/i.test(parsed.protocol) || !isAllowedOrigin(parsed.origin, env.corsOrigins)) {
      return { ok: false, message: "redirectUrl origin is not allowed" };
    }
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, message: "redirectUrl is invalid" };
  }
};

type LocatedOrder = {
  kind: StoreOrderKind;
  order: StoreOrderRecord;
};

const findOrderForInitialization = async ({
  orderId,
  checkoutType,
  paymentReference,
  userId,
}: {
  orderId: string;
  checkoutType?: string;
  paymentReference?: string;
  userId?: string;
}): Promise<
  | { status: "found"; located: LocatedOrder }
  | { status: "unauthorized" }
  | { status: "not_found" }
> => {
  if (checkoutType !== "guest" && userId) {
    const userOrder = await orderModel.findById(orderId).lean<StoreOrderRecord>();
    if (userOrder) {
      if (String(userOrder.user) !== String(userId)) {
        return { status: "unauthorized" };
      }
      return { status: "found", located: { kind: "user", order: userOrder } };
    }
  }

  if (checkoutType !== "user") {
    const guestOrder = await guestCheckoutModel.findById(orderId).lean<StoreOrderRecord>();
    if (guestOrder) {
      const providedRef = sanitizeText(paymentReference);
      const storedRef = sanitizeText(guestOrder.paymentReference);
      const storedPaystackRef = sanitizeText(guestOrder.paystackReference);
      if (!providedRef || (providedRef !== storedRef && providedRef !== storedPaystackRef)) {
        return { status: "unauthorized" };
      }
      return { status: "found", located: { kind: "guest", order: guestOrder } };
    }
  }

  if (!userId && checkoutType === "user") {
    return { status: "unauthorized" };
  }

  return { status: "not_found" };
};

const findOrderByReference = async (reference: string): Promise<LocatedOrder | null> => {
  const cleanRef = sanitizeText(reference);
  if (!cleanRef) {
    return null;
  }

  const refFilter = { $or: [{ paystackReference: cleanRef }, { paymentReference: cleanRef }] };
  const userOrder = await orderModel.findOne(refFilter).lean<StoreOrderRecord>();
  if (userOrder) {
    return { kind: "user", order: userOrder };
  }

  const guestOrder = await guestCheckoutModel.findOne(refFilter).lean<StoreOrderRecord>();
  if (guestOrder) {
    return { kind: "guest", order: guestOrder };
  }

  return null;
};

const resolveCustomerForOrder = async (located: LocatedOrder) => {
  if (located.kind === "guest") {
    const guest = located.order.guest ?? {};
    return {
      email: sanitizeText(guest.email),
      name: sanitizeText(guest.fullName) || "Guest Customer",
      phone: sanitizeText(guest.whatsappPhoneNumber) || sanitizeText(guest.callPhoneNumber) || undefined,
    };
  }

  const userId = located.order.user;
  const user = await userModel.findById(userId).select("email userName").lean();
  const profile = await profileModel.findOne({ user: userId }).select("firstName lastName phoneNumber").lean();
  const fullName = [sanitizeText(profile?.firstName), sanitizeText(profile?.lastName)].filter(Boolean).join(" ");

  return {
    email: sanitizeText(user?.email),
    name: fullName || sanitizeText(user?.userName) || "Melvin Store Customer",
    phone: sanitizeText(profile?.phoneNumber) || undefined,
  };
};

const formatOrderConfirmation = (
  kind: StoreOrderKind,
  order: StoreOrderRecord,
  alreadyPaid: boolean,
) => ({
  _id: String(order._id),
  checkoutType: kind,
  paymentStatus: order.paymentStatus,
  orderStatus: order.orderStatus,
  paymentReference: order.paymentReference ?? "",
  paystackReference: order.paystackReference ?? order.paymentReference ?? "",
  bill: Number(order.bill ?? 0),
  totalKobo: orderMoney(order).totalKobo,
  paidAt: order.paidAt ?? null,
  alreadyPaid,
});

const validateGatewayTransactionForOrder = (
  verified: { status: string; currency: string; amountKobo: number; reference: string },
  order: StoreOrderRecord,
) => {
  if (verified.status !== "success") {
    return {
      ok: false as const,
      statusCode: 402,
      code: "PAYMENT_NOT_SUCCESSFUL",
      message: "Payment was not completed",
    };
  }

  if (verified.currency !== "NGN") {
    return {
      ok: false as const,
      statusCode: 400,
      code: "CURRENCY_MISMATCH",
      message: "Payment currency does not match NGN",
    };
  }

  const expectedKobo = orderMoney(order).totalKobo;
  if (verified.amountKobo < expectedKobo) {
    return {
      ok: false as const,
      statusCode: 400,
      code: "AMOUNT_MISMATCH",
      message: "Paid amount is less than the order total",
    };
  }

  const knownRefs = [sanitizeText(order.paystackReference), sanitizeText(order.paymentReference)].filter(Boolean);
  if (knownRefs.length > 0 && !knownRefs.includes(sanitizeText(verified.reference))) {
    return {
      ok: false as const,
      statusCode: 400,
      code: "REFERENCE_MISMATCH",
      message: "Transaction reference does not match this order",
    };
  }

  return { ok: true as const };
};

export const initializePaystackPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!hasPaystackPaymentConfig()) {
      return res.status(503).json({
        success: 0,
        code: "PAYMENT_NOT_CONFIGURED",
        message: "Paystack payment is not configured",
      });
    }

    const { orderId, checkoutType, paymentReference, redirectUrl } = req.body as {
      orderId?: unknown;
      checkoutType?: unknown;
      paymentReference?: unknown;
      redirectUrl?: unknown;
    };

    const cleanOrderId = sanitizeText(orderId);
    if (!OBJECT_ID_PATTERN.test(cleanOrderId)) {
      return res.status(400).json({ success: 0, message: "valid orderId is required" });
    }

    const normalizedType = checkoutType === "guest" || checkoutType === "user" ? checkoutType : undefined;
    const resolvedRedirect = resolveRedirectUrl(redirectUrl);
    if (!resolvedRedirect.ok) {
      return res.status(400).json({ success: 0, message: resolvedRedirect.message });
    }

    const lookup = await findOrderForInitialization({
      orderId: cleanOrderId,
      checkoutType: normalizedType,
      paymentReference: sanitizeText(paymentReference),
      userId: req.user?._id,
    });

    if (lookup.status === "not_found") {
      return res.status(404).json({ success: 0, message: "order not found" });
    }

    if (lookup.status === "unauthorized") {
      return res.status(403).json({ success: 0, message: "not authorized to pay for this order" });
    }

    const { located } = lookup;
    if (located.order.orderStatus === "cancelled") {
      return res.status(409).json({ success: 0, message: "cannot pay for a cancelled order" });
    }

    if (located.order.paymentStatus === "paid") {
      return res.status(409).json({ success: 0, message: "order is already paid" });
    }

    const money = orderMoney(located.order);
    if (money.totalKobo <= 0) {
      return res.status(400).json({ success: 0, message: "order total must be greater than zero" });
    }

    const customer = await resolveCustomerForOrder(located);
    if (!customer.email) {
      return res.status(400).json({ success: 0, message: "customer email is required for payment" });
    }

    const reference = buildPaystackReference(located.kind, cleanOrderId);
    const targetModel = (located.kind === "guest" ? guestCheckoutModel : orderModel) as typeof orderModel;
    await targetModel.updateOne(
      { _id: cleanOrderId, paymentStatus: "pending" },
      { $set: { paystackReference: reference, paymentProvider: "paystack" } },
    );

    const cancelUrlObj = new URL(resolvedRedirect.url);
    cancelUrlObj.searchParams.set("reference", reference);
    cancelUrlObj.searchParams.set("status", "cancelled");

    const initialized = await paystackGateway.initializeTransaction({
      email: customer.email,
      amountKobo: money.totalKobo,
      currency: "NGN",
      reference,
      callbackUrl: resolvedRedirect.url,
      cancelUrl: cancelUrlObj.toString(),
      metadata: {
        orderId: cleanOrderId,
        checkoutType: located.kind,
      },
    });

    return res.status(200).json({
      success: 1,
      message: "payment initialized",
      data: {
        authorizationUrl: initialized.authorizationUrl,
        accessCode: initialized.accessCode,
        reference: initialized.reference,
        publicKey: env.paystack.publicKey,
        amount: money.totalKobo / 100,
        amountKobo: money.totalKobo,
        currency: "NGN",
        orderId: cleanOrderId,
        checkoutType: located.kind,
        customer,
      },
    });
  } catch (error) {
    if (error instanceof PaystackApiError) {
      return res.status(error.statusCode).json({ success: 0, message: error.message });
    }
    return res.status(500).json({ success: 0, message: "failed to initialize payment" });
  }
};

export const verifyPaystackPayment = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!hasPaystackPaymentConfig()) {
      return res.status(503).json({
        success: 0,
        code: "PAYMENT_NOT_CONFIGURED",
        message: "Paystack payment is not configured",
      });
    }

    const { reference, trxref } = req.body as {
      reference?: unknown;
      trxref?: unknown;
    };

    const cleanReference = sanitizeText(reference) || sanitizeText(trxref);
    if (!cleanReference) {
      return res.status(400).json({ success: 0, message: "reference is required" });
    }

    const verified = await paystackGateway.verifyTransaction(cleanReference);

    const located = await findOrderByReference(verified.reference || cleanReference);
    if (!located) {
      return res.status(404).json({ success: 0, message: "order not found for payment reference" });
    }

    const validation = validateGatewayTransactionForOrder(verified, located.order);
    if (!validation.ok) {
      return res.status(validation.statusCode).json({
        success: 0,
        code: validation.code,
        message: validation.message,
        data: formatOrderConfirmation(located.kind, located.order, located.order.paymentStatus === "paid"),
      });
    }

    const transition = await markOrderPaidByGateway({
      kind: located.kind,
      orderId: String(located.order._id),
      reference: verified.reference || cleanReference,
      paystackTransactionId: verified.id,
      traceId: traceIdOf(req as { traceId?: string }),
    });

    if (transition.outcome === "not_found") {
      return res.status(404).json({ success: 0, message: "order not found" });
    }

    if (transition.outcome === "conflict") {
      return res.status(409).json({ success: 0, message: transition.message });
    }

    return res.status(200).json({
      success: 1,
      message: transition.outcome === "already_paid" ? "payment already verified" : "payment verified",
      data: formatOrderConfirmation(
        located.kind,
        transition.order,
        transition.outcome === "already_paid",
      ),
    });
  } catch (error) {
    if (error instanceof PaystackApiError) {
      return res.status(error.statusCode).json({ success: 0, message: error.message });
    }
    return res.status(500).json({ success: 0, message: "failed to verify payment" });
  }
};

export const handlePaystackWebhook = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!hasPaystackPaymentConfig()) {
      return res.status(503).json({
        success: 0,
        code: "WEBHOOK_NOT_CONFIGURED",
        message: "Paystack webhook is not configured",
      });
    }

    const signatureHeader = req.headers["x-paystack-signature"];
    const incomingSignature = typeof signatureHeader === "string"
      ? signatureHeader
      : Array.isArray(signatureHeader)
        ? signatureHeader[0]
        : undefined;

    const rawBodyCandidate = (req as Request & { rawBody?: Buffer }).rawBody;
    const rawBody = Buffer.isBuffer(rawBodyCandidate)
      ? rawBodyCandidate
      : Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(JSON.stringify(req.body ?? {}));

    if (!verifyPaystackWebhookSignature(rawBody, incomingSignature, env.paystack.secretKey)) {
      return res.status(401).json({ success: 0, message: "invalid webhook signature" });
    }

    const bodyObj = Buffer.isBuffer(req.body)
      ? (JSON.parse(req.body.toString("utf8")) as Record<string, unknown>)
      : ((req.body ?? {}) as Record<string, unknown>);

    const eventType = sanitizeText(bodyObj.event);
    const data = ((bodyObj.data ?? {}) as Record<string, unknown>);
    const status = sanitizeText(data.status).toLowerCase();
    const reference = sanitizeText(data.reference);

    if (eventType !== "charge.success" || status !== "success" || !reference) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const verified = await paystackGateway.verifyTransaction(reference);
    const located = await findOrderByReference(verified.reference || reference);
    if (!located) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const validation = validateGatewayTransactionForOrder(verified, located.order);
    if (!validation.ok) {
      console.warn(JSON.stringify({
        event: "paystack_webhook_rejected",
        orderId: String(located.order._id),
        code: validation.code,
      }));
      return res.status(400).json({ received: false, code: validation.code });
    }

    const transition = await markOrderPaidByGateway({
      kind: located.kind,
      orderId: String(located.order._id),
      reference: verified.reference || reference,
      paystackTransactionId: verified.id,
      traceId: traceIdOf(req as { traceId?: string }),
    });

    if (transition.outcome === "conflict") {
      console.warn(JSON.stringify({
        event: "paystack_webhook_conflict",
        orderId: String(located.order._id),
        message: transition.message,
      }));
      return res.status(409).json({ received: false, message: transition.message });
    }

    return res.status(200).json({
      received: true,
      orderId: String(located.order._id),
      alreadyPaid: transition.outcome === "already_paid",
    });
  } catch (error) {
    if (error instanceof PaystackApiError) {
      return res.status(error.statusCode).json({ received: false, message: error.message });
    }
    return res.status(500).json({ received: false, message: "failed to process webhook" });
  }
};
