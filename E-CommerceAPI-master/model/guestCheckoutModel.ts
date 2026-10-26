import { Schema, model } from "mongoose";

const guestCheckoutSchema = new Schema(
  {
    guest: {
      fullName: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      whatsappPhoneNumber: {
        type: String,
        required: true,
        trim: true,
      },
      callPhoneNumber: {
        type: String,
        default: "",
        trim: true,
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      state: {
        type: String,
        required: true,
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
      trim: true,
    },
    // Fees, as on a signed-in order (Shortwork/RESELLER-PLAN.md §8a): integer kobo, optional.
    subtotalKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "subtotalKobo must be integer kobo" } },
    deliveryFeeKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "deliveryFeeKobo must be integer kobo" } },
    serviceFeeKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "serviceFeeKobo must be integer kobo" } },
    totalKobo: { type: Number, validate: { validator: Number.isSafeInteger, message: "totalKobo must be integer kobo" } },
    feeSource: { type: String },
    feeQuoteMock: { type: Boolean },
  },
  {
    timestamps: true,
  },
);

export default model("guestCheckouts", guestCheckoutSchema);
