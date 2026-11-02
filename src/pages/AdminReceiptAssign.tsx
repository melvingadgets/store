import React, { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  MdAdd,
  MdCheckCircle,
  MdDeleteOutline,
  MdDownload,
  MdOutlineArrowBack,
  MdOutlinePhoneIphone,
  MdOutlineReceiptLong,
  MdShare,
} from "react-icons/md";
import { FaWhatsapp } from "react-icons/fa";
import BlurLoadingContainer from "../component/common/BlurLoadingContainer";
import { can } from "../lib/access";
import { useGetAllUsersQuery } from "../redux/shopApi";
import type { RootState } from "../redux/store";
import {
  assignInvoiceManually,
  downloadBlobAsFile,
  fetchInvoicePdfBlob,
  type ManualAssignInvoicePayload,
  type ManualAssignInvoiceResponse,
  type ManualRepaymentEntryPayload,
} from "../services/invoiceService";
import { notify } from "../utils/notification";

const IPHONE_MODELS = [
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 13 mini",
  "iPhone 12 Pro Max",
  "iPhone 12 Pro",
  "iPhone 12",
  "iPhone 12 mini",
  "iPhone 11 Pro Max",
  "iPhone 11 Pro",
  "iPhone 11",
  "iPhone XR",
  "iPhone XS Max",
  "iPhone XS",
  "iPhone X",
  "iPhone SE (3rd Gen)",
  "Other / Custom Device",
];

const CAPACITIES = ["64GB", "128GB", "256GB", "512GB", "1TB"];

const CONDITIONS = [
  "Brand New (Sealed)",
  "Open Box",
  "UK Used (Grade A — Flawless)",
  "UK Used (Grade B — Good)",
];

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "pos", label: "POS Terminal" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Debit Card" },
];

const formatCurrencyInput = (val: string | number): string => {
  const digits = String(val).replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("en-NG");
};

const parseCurrencyDigits = (val: string): number => {
  const digits = String(val).replace(/\D/g, "");
  return digits ? Number(digits) : 0;
};

const AdminReceiptAssign: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.auth.user);
  const token = useSelector((state: RootState) => state.auth.token);
  const isAdmin = can(user, "store.admin.access");

  // Customer state
  const [customerMode, setCustomerMode] = useState<"existing" | "walkin">("existing");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [customerFullName, setCustomerFullName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerAddress, setCustomerAddress] = useState<string>("");

  // Device state
  const [model, setModel] = useState<string>("iPhone 13 Pro");
  const [customModel, setCustomModel] = useState<string>("");
  const [capacity, setCapacity] = useState<string>("128GB");
  const [condition, setCondition] = useState<string>("UK Used (Grade A — Flawless)");
  const [color, setColor] = useState<string>("");
  const [imei, setImei] = useState<string>("");
  const [priceStr, setPriceStr] = useState<string>("650,000");

  // Payment Mode
  const [paymentMode, setPaymentMode] = useState<"outright" | "easybuy">("outright");

  // Outright state
  const [outrightMethod, setOutrightMethod] = useState<string>("bank_transfer");
  const [outrightRef, setOutrightRef] = useState<string>("");
  const [outrightDate, setOutrightDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // EasyBuy state
  const [easybuyPlan, setEasybuyPlan] = useState<"Monthly" | "Weekly">("Monthly");
  const [downPaymentStr, setDownPaymentStr] = useState<string>("200,000");
  const [downPaymentDate, setDownPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [downPaymentMethod, setDownPaymentMethod] = useState<string>("bank_transfer");
  const [downPaymentRef, setDownPaymentRef] = useState<string>("");
  const [serviceFeeStr, setServiceFeeStr] = useState<string>("0");
  const [repayments, setRepayments] = useState<
    Array<{ amountStr: string; paidAt: string; method: string; reference: string }>
  >([]);

  // Fulfillment & Options
  const [storeLocation, setStoreLocation] = useState<string>("Computer Village, Ikeja");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [sendEmailNotification, setSendEmailNotification] = useState<boolean>(true);
  const [customIssuedDate, setCustomIssuedDate] = useState<string>(new Date().toISOString().slice(0, 10));

  // Loading & Result state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [issuedInvoice, setIssuedInvoice] = useState<ManualAssignInvoiceResponse | null>(null);

  const { data: users = [], isFetching: usersLoading } = useGetAllUsersQuery(undefined, { skip: !isAdmin });

  const resolveUserDisplayName = (u: any): string => {
    if (typeof u.profile === "object" && u.profile) {
      const fn = `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim();
      if (fn) return fn;
    }
    return u.userName || "Customer";
  };

  const resolveUserPhone = (u: any): string => {
    if (typeof u.profile === "object" && u.profile) {
      return u.profile.phoneNumber || "";
    }
    return "";
  };

  // Filtered users for search
  const filteredUsers = useMemo(() => {
    if (!customerSearch.trim()) return users.slice(0, 8);
    const q = customerSearch.toLowerCase();
    return users
      .filter((u) => {
        const name = resolveUserDisplayName(u).toLowerCase();
        const email = (u.email || "").toLowerCase();
        const phone = resolveUserPhone(u).toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 10);
  }, [users, customerSearch]);

  const handleSelectUser = (u: any) => {
    setSelectedUserId(u._id);
    const resolvedName = resolveUserDisplayName(u);
    setCustomerFullName(resolvedName);
    setCustomerEmail(u.email || "");
    setCustomerPhone(resolveUserPhone(u));
    setCustomerAddress("");
  };

  // Add repayment row
  const addRepaymentRow = () => {
    setRepayments((prev) => [
      ...prev,
      {
        amountStr: "50,000",
        paidAt: new Date().toISOString().slice(0, 10),
        method: "bank_transfer",
        reference: "",
      },
    ]);
  };

  const removeRepaymentRow = (index: number) => {
    setRepayments((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRepaymentRow = (index: number, field: string, value: string) => {
    setRepayments((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  // Calculations
  const totalPriceNaira = parseCurrencyDigits(priceStr);
  const downPaymentNaira = parseCurrencyDigits(downPaymentStr);
  const totalRepaymentsNaira = repayments.reduce(
    (sum, r) => sum + parseCurrencyDigits(r.amountStr),
    0,
  );
  const totalPaidNaira = paymentMode === "outright" ? totalPriceNaira : downPaymentNaira + totalRepaymentsNaira;
  const remainingFinancedBalanceNaira = Math.max(0, totalPriceNaira - totalPaidNaira);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      notify("error", "You must be logged in as an admin to assign receipts.");
      return;
    }

    const resolvedFullName = customerFullName.trim();
    if (!resolvedFullName) {
      notify("warning", "Please provide the customer's full name.");
      return;
    }

    const resolvedModel = model === "Other / Custom Device" ? customModel.trim() : model;
    if (!resolvedModel) {
      notify("warning", "Please select or enter the device model.");
      return;
    }

    const resolvedImei = imei.trim();
    if (!resolvedImei) {
      notify("warning", "Please enter the IMEI or Serial Number.");
      return;
    }

    if (totalPriceNaira <= 0) {
      notify("warning", "Please enter a valid purchase price.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: ManualAssignInvoicePayload = {
        customer: {
          personId: customerMode === "existing" && selectedUserId ? selectedUserId : null,
          fullName: resolvedFullName,
          email: customerEmail.trim() || null,
          phone: customerPhone.trim(),
          deliveryAddress: customerAddress.trim() || undefined,
        },
        device: {
          brand: "Apple",
          model: resolvedModel,
          capacity,
          condition,
          color: color.trim() || undefined,
          imei: resolvedImei,
          priceKobo: Math.round(totalPriceNaira * 100),
        },
        paymentMode,
        outright:
          paymentMode === "outright"
            ? {
                method: outrightMethod,
                reference: outrightRef.trim() || undefined,
                paidAt: outrightDate,
              }
            : undefined,
        easybuy:
          paymentMode === "easybuy"
            ? {
                plan: easybuyPlan,
                downPaymentKobo: Math.round(downPaymentNaira * 100),
                downPaymentPaidAt: downPaymentDate,
                downPaymentMethod,
                downPaymentReference: downPaymentRef.trim() || undefined,
                serviceFeeKobo: Math.round(parseCurrencyDigits(serviceFeeStr) * 100),
                repayments: repayments.map((r) => ({
                  amountKobo: Math.round(parseCurrencyDigits(r.amountStr) * 100),
                  paidAt: r.paidAt,
                  method: r.method,
                  reference: r.reference.trim() || undefined,
                })),
              }
            : undefined,
        fulfillment: {
          storeLocation,
          adminNotes: adminNotes.trim() || undefined,
          sendEmailNotification,
          issuedAt: customIssuedDate,
        },
      };

      const res = await assignInvoiceManually(payload, token);
      setIssuedInvoice(res);
      notify("success", `Official receipt ${res.number} generated successfully!`);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to issue invoice";
      notify("error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (invoiceNumber: string) => {
    if (!token) return;
    setIsDownloadingPdf(true);
    try {
      const blob = await fetchInvoicePdfBlob(invoiceNumber, token);
      downloadBlobAsFile(blob, `${invoiceNumber}.pdf`);
      notify("success", `Downloaded ${invoiceNumber}.pdf`);
    } catch (err: any) {
      notify("error", "Could not download PDF receipt. Please check your connection.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleWhatsAppShare = (inv: ManualAssignInvoiceResponse) => {
    const custPhone = (customerPhone || "").replace(/\D/g, "");
    const deviceSummary = `Apple ${model} ${capacity} (IMEI: ${imei})`;
    const text = encodeURIComponent(
      `Hello ${customerFullName},\n\nHere is your official Melvin Gadgets purchase receipt for your ${deviceSummary}.\n\nInvoice Number: ${inv.number}\nDate: ${new Date(inv.issuedAt).toLocaleDateString()}\nTotal Amount: ₦${(inv.totalKobo / 100).toLocaleString("en-NG")}\n\nThank you for choosing Melvin Gadgets!`,
    );
    const targetUrl = custPhone
      ? `https://wa.me/${custPhone.startsWith("0") ? `234${custPhone.slice(1)}` : custPhone}?text=${text}`
      : `https://wa.me/?text=${text}`;
    window.open(targetUrl, "_blank");
  };

  if (!isAdmin) {
    return (
      <div className="ios-mobile-shell flex min-h-screen items-center justify-center px-4">
        <div className="ios-card max-w-sm text-center">
          <p className="text-lg font-bold text-primaryText">Admin access only.</p>
          <p className="ios-body-muted mt-2">You need staff administrative privileges to issue customer receipts.</p>
          <Link to="/" className="ios-primary-button mt-5">Return to Store</Link>
        </div>
      </div>
    );
  }

  return (
    <BlurLoadingContainer loading={usersLoading} minDurationMs={150}>
      <div className="ios-page pb-32">
        <header className="ios-topbar">
          <button
            type="button"
            onClick={() => navigate("/admin")}
            className="ios-icon-button shrink-0"
            aria-label="Go back"
          >
            <MdOutlineArrowBack size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="ios-overline">Customer Invoicing</p>
            <span className="ios-nav-title block">Assign Official Receipt</span>
          </div>
          <div className="ios-pill">Staff Only</div>
        </header>

        {issuedInvoice ? (
          <div className="ios-card animate-fadeIn my-4 p-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-[0_12px_24px_rgba(16,185,129,0.18)]">
              <MdCheckCircle size={48} />
            </div>
            <h2 className="ios-section-title mt-4 text-2xl font-bold">Receipt Issued & Assigned!</h2>
            <p className="ios-body-muted mt-2">
              Official document <span className="font-bold text-primary">{issuedInvoice.number}</span> has been created
              and registered for <span className="font-semibold text-textPrimary">{issuedInvoice.customer.name}</span>.
            </p>

            <div className="my-6 rounded-[22px] bg-white/60 p-4 text-left shadow-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="ios-meta">Invoice Number</span>
                <span className="font-bold text-primary">{issuedInvoice.number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="ios-meta">Device</span>
                <span className="font-medium text-textPrimary">{model} ({capacity})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="ios-meta">IMEI</span>
                <span className="font-mono text-xs font-semibold">{imei}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="ios-meta">Payment Mode</span>
                <span className="font-semibold uppercase text-textPrimary">{paymentMode}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="ios-meta">Total Amount</span>
                <span className="font-bold text-emerald-600">
                  ₦{(issuedInvoice.totalKobo / 100).toLocaleString("en-NG")}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => handleDownloadPdf(issuedInvoice.number)}
                disabled={isDownloadingPdf}
                className="ios-primary-button gap-2 py-3"
              >
                <MdDownload size={20} />
                {isDownloadingPdf ? "Generating PDF..." : "Download PDF Receipt"}
              </button>

              <button
                type="button"
                onClick={() => handleWhatsAppShare(issuedInvoice)}
                className="ios-secondary-button gap-2 py-3 bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20"
              >
                <FaWhatsapp size={18} />
                Share via WhatsApp
              </button>

              <button
                type="button"
                onClick={() => {
                  setIssuedInvoice(null);
                  setImei("");
                  setRepayments([]);
                }}
                className="ios-secondary-button gap-2 py-3"
              >
                <MdAdd size={20} />
                Assign Another Receipt
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Customer Info */}
            <section className="ios-card space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/50 pb-3">
                <div className="flex items-center gap-2">
                  <div className="ios-icon-button !h-9 !w-9 text-primary">
                    <MdOutlineReceiptLong size={18} />
                  </div>
                  <div>
                    <h2 className="ios-card-title">1. Customer Information</h2>
                    <p className="ios-meta">Select an existing account or assign to a walk-in/offline customer.</p>
                  </div>
                </div>

                <div className="flex rounded-full bg-slate-200/60 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCustomerMode("existing")}
                    className={`rounded-full px-3 py-1 transition ${
                      customerMode === "existing" ? "bg-white shadow text-primary" : "text-slate-600"
                    }`}
                  >
                    Existing User
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerMode("walkin");
                      setSelectedUserId("");
                    }}
                    className={`rounded-full px-3 py-1 transition ${
                      customerMode === "walkin" ? "bg-white shadow text-primary" : "text-slate-600"
                    }`}
                  >
                    Walk-in / Offline
                  </button>
                </div>
              </div>

              {customerMode === "existing" ? (
                <div className="space-y-3">
                  <div>
                    <label className="ios-caption uppercase">Search User</label>
                    <input
                      type="text"
                      placeholder="Search by name, email, or phone..."
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      className="ios-input mt-1"
                    />
                  </div>

                  {filteredUsers.length > 0 && (
                    <div className="max-h-40 overflow-y-auto rounded-xl border border-border bg-white/70 divide-y divide-gray-100">
                      {filteredUsers.map((u) => {
                        const name = resolveUserDisplayName(u);
                        const isSelected = selectedUserId === u._id;
                        return (
                          <div
                            key={u._id}
                            onClick={() => handleSelectUser(u)}
                            className={`flex cursor-pointer items-center justify-between p-2.5 text-sm transition hover:bg-primary/5 ${
                              isSelected ? "bg-primary/10 font-semibold" : ""
                            }`}
                          >
                            <div>
                              <p className="text-textPrimary">{name}</p>
                              <p className="text-xs text-muted-foreground">{u.email} • {resolveUserPhone(u) || "No phone"}</p>
                            </div>
                            {isSelected && <span className="text-xs text-primary font-bold">Selected ✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="ios-caption uppercase">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Adebayo Ogunlesi"
                    value={customerFullName}
                    onChange={(e) => setCustomerFullName(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
                <div>
                  <label className="ios-caption uppercase">Phone Number (WhatsApp) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +2348012345678"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
                <div>
                  <label className="ios-caption uppercase">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="e.g. adebayo@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
                <div>
                  <label className="ios-caption uppercase">Delivery / Residential Address</label>
                  <input
                    type="text"
                    placeholder="e.g. Ikeja, Lagos"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
              </div>
            </section>

            {/* Section 2: iPhone Specifications */}
            <section className="ios-card space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-200/50 pb-3">
                <div className="ios-icon-button !h-9 !w-9 text-primary">
                  <MdOutlinePhoneIphone size={18} />
                </div>
                <div>
                  <h2 className="ios-card-title">2. iPhone & Hardware Specifications</h2>
                  <p className="ios-meta">Select exact device model, storage, condition grade, and enter IMEI.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="ios-caption uppercase">iPhone Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="ios-input mt-1 cursor-pointer bg-white"
                  >
                    {IPHONE_MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {model === "Other / Custom Device" && (
                  <div>
                    <label className="ios-caption uppercase">Custom Model Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. MacBook Pro M1 14-inch"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="ios-input mt-1"
                    />
                  </div>
                )}

                <div>
                  <label className="ios-caption uppercase">Color / Finish (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Sierra Blue, Natural Titanium"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
              </div>

              {/* Capacity pills */}
              <div>
                <label className="ios-caption uppercase">Storage Capacity</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CAPACITIES.map((cap) => (
                    <button
                      key={cap}
                      type="button"
                      onClick={() => setCapacity(cap)}
                      className={`min-h-10 rounded-2xl px-4 py-2 font-semibold text-sm transition active:scale-95 ${
                        capacity === cap
                          ? "bg-primary text-white shadow-md"
                          : "bg-white/60 text-slate-700 hover:bg-white"
                      }`}
                    >
                      {cap}
                    </button>
                  ))}
                </div>
              </div>

              {/* Condition pills */}
              <div>
                <label className="ios-caption uppercase">Physical Condition</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {CONDITIONS.map((cond) => (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => setCondition(cond)}
                      className={`min-h-10 rounded-2xl px-3.5 py-2 font-medium text-xs sm:text-sm transition active:scale-95 ${
                        condition === cond
                          ? "bg-primary text-white shadow-md font-semibold"
                          : "bg-white/60 text-slate-700 hover:bg-white"
                      }`}
                    >
                      {cond}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="ios-caption uppercase">IMEI / Serial Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="15-digit IMEI or Serial Number"
                    value={imei}
                    onChange={(e) => setImei(e.target.value.toUpperCase())}
                    className="ios-input mt-1 font-mono tracking-wider font-semibold"
                  />
                  <p className="ios-meta mt-1 text-[0.78rem]">
                    Dial *#06# on the device to check the physical IMEI. Printed on official receipt.
                  </p>
                </div>

                <div>
                  <label className="ios-caption uppercase">Total Agreed Price (₦) *</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">₦</span>
                    <input
                      type="text"
                      required
                      placeholder="650,000"
                      value={priceStr}
                      onChange={(e) => setPriceStr(formatCurrencyInput(e.target.value))}
                      className="ios-input pl-8 font-bold text-primary text-lg"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3: Payment Path */}
            <section className="ios-card space-y-4">
              <div className="flex items-center justify-between border-b border-gray-200/50 pb-3">
                <div>
                  <h2 className="ios-card-title">3. Payment Mode</h2>
                  <p className="ios-meta">Select Outright full purchase or EasyBuy installment financing.</p>
                </div>

                <div className="flex rounded-full bg-slate-200/60 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("outright")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      paymentMode === "outright" ? "bg-primary text-white shadow" : "text-slate-600"
                    }`}
                  >
                    Outright Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("easybuy")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      paymentMode === "easybuy" ? "bg-primary text-white shadow" : "text-slate-600"
                    }`}
                  >
                    EasyBuy Financed
                  </button>
                </div>
              </div>

              {paymentMode === "outright" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="ios-caption uppercase">Payment Method</label>
                    <select
                      value={outrightMethod}
                      onChange={(e) => setOutrightMethod(e.target.value)}
                      className="ios-input mt-1 cursor-pointer bg-white"
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm.value} value={pm.value}>
                          {pm.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="ios-caption uppercase">Transaction Reference (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. OPAY-91024 / POS Ref"
                      value={outrightRef}
                      onChange={(e) => setOutrightRef(e.target.value)}
                      className="ios-input mt-1"
                    />
                  </div>
                  <div>
                    <label className="ios-caption uppercase">Payment Date</label>
                    <input
                      type="date"
                      value={outrightDate}
                      onChange={(e) => setOutrightDate(e.target.value)}
                      className="ios-input mt-1"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="ios-caption uppercase">EasyBuy Plan</label>
                      <select
                        value={easybuyPlan}
                        onChange={(e) => setEasybuyPlan(e.target.value as any)}
                        className="ios-input mt-1 cursor-pointer bg-white"
                      >
                        <option value="Monthly">Monthly Plan</option>
                        <option value="Weekly">Weekly Plan</option>
                      </select>
                    </div>

                    <div>
                      <label className="ios-caption uppercase">Down Payment (₦)</label>
                      <input
                        type="text"
                        value={downPaymentStr}
                        onChange={(e) => setDownPaymentStr(formatCurrencyInput(e.target.value))}
                        className="ios-input mt-1 font-semibold text-primary"
                      />
                    </div>

                    <div>
                      <label className="ios-caption uppercase">Down Payment Method</label>
                      <select
                        value={downPaymentMethod}
                        onChange={(e) => setDownPaymentMethod(e.target.value)}
                        className="ios-input mt-1 cursor-pointer bg-white"
                      >
                        {PAYMENT_METHODS.map((pm) => (
                          <option key={pm.value} value={pm.value}>
                            {pm.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="ios-caption uppercase">Deposit Paid Date</label>
                      <input
                        type="date"
                        value={downPaymentDate}
                        onChange={(e) => setDownPaymentDate(e.target.value)}
                        className="ios-input mt-1"
                      />
                    </div>
                  </div>

                  {/* Installments List */}
                  <div className="rounded-2xl bg-white/50 p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-textPrimary">Installment Repayments (Paid so far)</h3>
                        <p className="text-xs text-muted-foreground">Add records of payments made towards this device.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addRepaymentRow}
                        className="ios-secondary-button gap-1 !py-1.5 !px-3 text-xs"
                      >
                        <MdAdd size={16} /> Add Repayment
                      </button>
                    </div>

                    {repayments.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">
                        No installments recorded yet. (Only down payment entered).
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {repayments.map((r, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm">
                            <span className="text-xs font-bold text-primary w-6">#{i + 1}</span>
                            <div className="flex-1 min-w-[110px]">
                              <input
                                type="text"
                                placeholder="Amount (₦)"
                                value={r.amountStr}
                                onChange={(e) => updateRepaymentRow(i, "amountStr", formatCurrencyInput(e.target.value))}
                                className="ios-input !py-1.5 text-xs font-semibold"
                              />
                            </div>
                            <div className="w-32">
                              <input
                                type="date"
                                value={r.paidAt}
                                onChange={(e) => updateRepaymentRow(i, "paidAt", e.target.value)}
                                className="ios-input !py-1.5 text-xs"
                              />
                            </div>
                            <div className="w-28">
                              <select
                                value={r.method}
                                onChange={(e) => updateRepaymentRow(i, "method", e.target.value)}
                                className="ios-input !py-1.5 text-xs bg-white"
                              >
                                {PAYMENT_METHODS.map((pm) => (
                                  <option key={pm.value} value={pm.value}>{pm.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 min-w-[100px]">
                              <input
                                type="text"
                                placeholder="Ref / Slip"
                                value={r.reference}
                                onChange={(e) => updateRepaymentRow(i, "reference", e.target.value)}
                                className="ios-input !py-1.5 text-xs"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => removeRepaymentRow(i)}
                              className="text-rose-500 p-1 hover:bg-rose-50 rounded"
                            >
                              <MdDeleteOutline size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Settlement summary */}
                    <div className="mt-4 pt-3 border-t border-gray-200/60 flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Total Device Price: </span>
                        <span className="font-bold">₦{totalPriceNaira.toLocaleString("en-NG")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Paid: </span>
                        <span className="font-bold text-emerald-600">₦{totalPaidNaira.toLocaleString("en-NG")}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Remaining Balance: </span>
                        {remainingFinancedBalanceNaira === 0 ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                            100% Fully Settled ✓
                          </span>
                        ) : (
                          <span className="font-bold text-rose-600">
                            ₦{remainingFinancedBalanceNaira.toLocaleString("en-NG")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Section 4: Options & Submission */}
            <section className="ios-card space-y-4">
              <h2 className="ios-card-title">4. Fulfillment & Delivery Options</h2>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="ios-caption uppercase">Issue Date (Backdate for Old Customers)</label>
                  <input
                    type="date"
                    value={customIssuedDate}
                    onChange={(e) => setCustomIssuedDate(e.target.value)}
                    className="ios-input mt-1"
                  />
                  <p className="ios-meta mt-1 text-[0.75rem]">
                    Leave as today, or backdate to the original purchase date (e.g. 2024 / 2025).
                  </p>
                </div>

                <div>
                  <label className="ios-caption uppercase">Store / Pickup Location</label>
                  <input
                    type="text"
                    value={storeLocation}
                    onChange={(e) => setStoreLocation(e.target.value)}
                    className="ios-input mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="ios-caption uppercase">Admin / Internal Notes (Printed on Receipt)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Screen protector & silicon case bundled. Verified in shop."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="ios-input mt-1"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="sendEmail"
                  checked={sendEmailNotification}
                  onChange={(e) => setSendEmailNotification(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
                <label htmlFor="sendEmail" className="text-sm font-medium text-textPrimary cursor-pointer">
                  Send official receipt notification email to customer ({customerEmail || "if email provided"})
                </label>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/admin")}
                  className="ios-secondary-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="ios-primary-button gap-2 py-3 px-6 text-base"
                >
                  {isSubmitting ? "Generating Receipt..." : "Generate & Assign Official Receipt"}
                </button>
              </div>
            </section>
          </form>
        )}
      </div>
    </BlurLoadingContainer>
  );
};

export default AdminReceiptAssign;
