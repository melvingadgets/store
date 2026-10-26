import { Schema, model } from "mongoose";

const orderSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: false,
      default: null,
    },
    checkoutType: {
      type: String,
      enum: ["user", "guest"],
      default: "user",
    },
    guest: {
      name: {
        type: String,
        default: "",
        trim: true,
      },
      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
      address: {
        type: String,
        default: "",
        trim: true,
      },
    },
    orderItem: [
      {
        products: { type: Schema.Types.ObjectId, ref: "products", required: true },
        capacity: { type: String, default: "", trim: true },
        quantity: { type: Number, default: 1, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    bill: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: ["created", "processing", "completed", "cancelled"],
      default: "created",
    },
    paymentReference: {
      type: String,
      default: "",
    },
    // ── Reseller programme (Shortwork/RESELLER-PLAN.md §7, §8a). All optional, so orders created
    // before these fields existed are untouched. Money in integer kobo; `bill` above stays the item
    // total in naira, as before (Shortwork/AGENTS.md §7.1).
    // The buyer's platform person (auth user _id), copied from their account at checkout. No
    // default: guests and unlinked accounts simply have no field, and the partial index skips them.
    personId: { type: String, trim: true },
    subtotalKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "subtotalKobo must be integer kobo" } },
    // The courier's quote, and our service fee: 2.5 × the quote, never refunded.
    deliveryFeeKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "deliveryFeeKobo must be integer kobo" } },
    serviceFeeKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "serviceFeeKobo must be integer kobo" } },
    totalKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "totalKobo must be integer kobo" } },
    // "courier:<name>" or "disabled" (fees off), and whether the quote was placeholder data.
    feeSource: { type: String },
    feeQuoteMock: { type: Boolean },
    paidAt: { type: Date },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelReason: { type: String, enum: ["rejected_at_delivery", "cancelled", "refunded"] },
  },
  {
    timestamps: true,
  },
);

orderSchema.index({ personId: 1, createdAt: 1 }, { partialFilterExpression: { personId: { $type: "string" } } });

export default model("orders", orderSchema);
