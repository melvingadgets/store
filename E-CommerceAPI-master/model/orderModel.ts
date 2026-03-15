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
  },
  {
    timestamps: true,
  },
);

export default model("orders", orderSchema);
