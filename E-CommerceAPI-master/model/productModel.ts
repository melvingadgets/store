import { Schema, model } from "mongoose";

const productSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    desc: {
      type: String,
      default: "",
      trim: true,
    },
    qty: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    storageOptions: [
      {
        capacity: {
          type: String,
          required: true,
          trim: true,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        qty: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    category: {
      type: Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export default model("products", productSchema);
