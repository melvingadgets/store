import { Schema, model } from "mongoose";

const cartSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    cartType: {
      type: String,
      enum: ["saved", "synced_session"],
      default: "saved",
    },
    sourceSessionId: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    cartItem: [
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
  },
  {
    timestamps: true,
  },
);

cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ user: 1, sourceSessionId: 1 }, { unique: true, sparse: true });

export default model("cart", cartSchema);
