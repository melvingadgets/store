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
  },
  {
    timestamps: true,
  },
);

export default model("guestCheckouts", guestCheckoutSchema);
