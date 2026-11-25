import { isEmbeddedInMelvin } from "../lib/melvinBridge";
import type { InitializePaystackData } from "../services/paymentService";

interface PaystackTransactionCallback {
  reference?: string;
  trxref?: string;
  status?: string;
}

interface PaystackPopInstance {
  resumeTransaction: (
    accessCode: string,
    callbacks?: {
      onSuccess?: (transaction: PaystackTransactionCallback) => void;
      onCancel?: () => void;
      onError?: (error: { message?: string }) => void;
    },
  ) => void;
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopInstance;
  }
}

const PAYSTACK_INLINE_SCRIPT = "https://js.paystack.co/v2/inline.js";
let inlineLoaderPromise: Promise<boolean> | null = null;

const loadPaystackInlineScript = (): Promise<boolean> => {
  if (typeof window === "undefined") {
    return Promise.resolve(false);
  }
  if (typeof window.PaystackPop === "function") {
    return Promise.resolve(true);
  }
  if (inlineLoaderPromise) {
    return inlineLoaderPromise;
  }

  inlineLoaderPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = PAYSTACK_INLINE_SCRIPT;
    script.async = true;
    script.onload = () => resolve(typeof window.PaystackPop === "function");
    script.onerror = () => {
      inlineLoaderPromise = null;
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return inlineLoaderPromise;
};

export interface LaunchPaystackCallbacks {
  onInlineSuccess: (result: { reference: string }) => void;
  onInlineCancel: () => void;
}

export const launchPaystackCheckout = async (
  initData: InitializePaystackData,
  callbacks: LaunchPaystackCallbacks,
): Promise<"redirect" | "inline" | "popup"> => {
  // Outside Melvin OS, Paystack Hosted Checkout navigates straight to authorizationUrl and
  // returns to /orderconfirm?trxref=...&reference=... without third-party script dependencies.
  if (!isEmbeddedInMelvin) {
    window.location.assign(initData.authorizationUrl);
    return "redirect";
  }

  // Inside Melvin OS (iframe), resumeTransaction keeps the in-memory MelvinBridge token intact.
  const loaded = await loadPaystackInlineScript();
  if (loaded && typeof window.PaystackPop === "function" && initData.accessCode) {
    const popup = new window.PaystackPop();
    popup.resumeTransaction(initData.accessCode, {
      onSuccess: (transaction) => {
        callbacks.onInlineSuccess({
          reference: transaction.reference ?? transaction.trxref ?? initData.reference,
        });
      },
      onCancel: () => {
        callbacks.onInlineCancel();
      },
      onError: () => {
        callbacks.onInlineCancel();
      },
    });
    return "inline";
  }

  window.open(initData.authorizationUrl, "_blank", "noopener,noreferrer");
  return "popup";
};
