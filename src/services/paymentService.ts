import apiClient from "../utils/axios";
import type { ApiResponse } from "../types/domain";

export interface InitializePaystackPayload {
  orderId: string;
  checkoutType: "user" | "guest";
  paymentReference?: string;
  redirectUrl?: string;
}

export interface InitializePaystackData {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  publicKey: string | null;
  amount: number;
  amountKobo: number;
  currency: string;
  orderId: string;
  checkoutType: "user" | "guest";
  customer: {
    email: string;
    name: string;
    phone?: string;
  };
}

export interface VerifyPaystackPayload {
  reference?: string;
  trxref?: string;
}

export interface VerifiedOrderPayment {
  _id: string;
  checkoutType: "user" | "guest";
  paymentStatus: "pending" | "paid";
  orderStatus: "created" | "processing" | "completed" | "cancelled";
  paymentReference: string;
  paystackReference: string;
  bill: number;
  totalKobo: number;
  paidAt: string | null;
  alreadyPaid: boolean;
}

export const initializePaystackPayment = (payload: InitializePaystackPayload) =>
  apiClient.post<ApiResponse<InitializePaystackData>>("/payments/paystack/initialize", payload);

export const verifyPaystackPayment = (payload: VerifyPaystackPayload) =>
  apiClient.post<ApiResponse<VerifiedOrderPayment>>("/payments/paystack/verify", payload);
