import { Schema, model } from "mongoose";

const assistantSessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
    messages: [
      {
        role: {
          type: String,
          enum: ["user", "assistant"],
          required: true,
        },
        content: {
          type: String,
          required: true,
          trim: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    intent: {
      type: String,
      enum: ["trade_in", "product", "general", "unknown"],
      default: "unknown",
    },
    context: {
      productId: {
        type: String,
        default: "",
        trim: true,
      },
      productName: {
        type: String,
        default: "",
        trim: true,
      },
      productCapacity: {
        type: String,
        default: "",
        trim: true,
      },
      route: {
        type: String,
        default: "",
        trim: true,
      },
      tradeInModel: {
        type: String,
        default: "",
        trim: true,
      },
      tradeInStorage: {
        type: String,
        default: "",
        trim: true,
      },
    },
    toolCalls: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        arguments: {
          type: Schema.Types.Mixed,
          default: {},
        },
        ok: {
          type: Boolean,
          required: true,
        },
        resultSummary: {
          type: String,
          default: "",
        },
        error: {
          type: String,
          default: "",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

export default model("assistant_sessions", assistantSessionSchema);
