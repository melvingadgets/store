import axios from "axios";

export const INVOICE_API_BASE_URL =
  import.meta.env.VITE_INVOICE_API_URL ||
  "https://invoice-api-production-c633.up.railway.app/api/v1";

export interface ManualInvoiceCustomerPayload {
  personId?: string | null;
  fullName: string;
  email?: string | null;
  phone: string;
  deliveryAddress?: string;
}

export interface ManualInvoiceDevicePayload {
  brand?: string;
  model: string;
  capacity: string;
  condition: string;
  color?: string;
  imei: string;
  priceKobo: number;
}

export interface ManualRepaymentEntryPayload {
  amountKobo: number;
  paidAt: string;
  method: string;
  reference?: string;
}

export interface ManualAssignInvoicePayload {
  customer: ManualInvoiceCustomerPayload;
  device: ManualInvoiceDevicePayload;
  paymentMode: "outright" | "easybuy";
  outright?: {
    method: string;
    reference?: string;
    paidAt?: string;
  };
  easybuy?: {
    plan: string;
    downPaymentKobo: number;
    downPaymentPaidAt: string;
    downPaymentMethod: string;
    downPaymentReference?: string;
    serviceFeeKobo?: number;
    repayments?: ManualRepaymentEntryPayload[];
  };
  fulfillment?: {
    storeLocation?: string;
    adminNotes?: string;
    sendEmailNotification?: boolean;
    issuedAt?: string;
  };
}

export interface ManualAssignInvoiceResponse {
  number: string;
  invoiceId: string;
  kind: string;
  totalKobo: number;
  issuedAt: string;
  customer: {
    name: string | null;
    email: string | null;
  };
  pdfUrl: string;
}

export const assignInvoiceManually = async (
  payload: ManualAssignInvoicePayload,
  token: string,
): Promise<ManualAssignInvoiceResponse> => {
  const response = await axios.post<ManualAssignInvoiceResponse>(
    `${INVOICE_API_BASE_URL}/admin/invoices/manual-assign`,
    payload,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );
  return response.data;
};

export const fetchInvoicePdfBlob = async (
  invoiceNumber: string,
  token: string,
): Promise<Blob> => {
  const response = await axios.get(
    `${INVOICE_API_BASE_URL}/invoices/${invoiceNumber}/pdf`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "blob",
    },
  );
  return response.data as Blob;
};

export const downloadBlobAsFile = (blob: Blob, filename: string): void => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};
