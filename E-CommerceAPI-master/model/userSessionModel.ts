import { Schema, model } from "mongoose";

const userSessionSchema = new Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: true,
      index: true,
    },
    loginAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["online", "idle", "offline", "logged_out", "expired"],
      default: "online",
      index: true,
    },
    lastEvent: {
      type: String,
      default: "login",
      trim: true,
    },
    lastPath: {
      type: String,
      default: "",
      trim: true,
    },
    lastVisibilityState: {
      type: String,
      enum: ["visible", "hidden", "prerender", ""],
      default: "visible",
    },
    lastOnlineState: {
      type: Boolean,
      default: true,
    },
    ipAddress: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    deviceType: {
      type: String,
      enum: ["desktop", "mobile", "tablet", "bot", "unknown"],
      default: "unknown",
    },
    browser: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    os: {
      type: String,
      default: "Unknown",
      trim: true,
    },
    platform: {
      type: String,
      default: "",
      trim: true,
    },
    language: {
      type: String,
      default: "",
      trim: true,
    },
    timezone: {
      type: String,
      default: "",
      trim: true,
    },
    referrer: {
      type: String,
      default: "",
      trim: true,
    },
    screen: {
      width: {
        type: Number,
        default: 0,
      },
      height: {
        type: Number,
        default: 0,
      },
      pixelRatio: {
        type: Number,
        default: 1,
      },
    },
    utm: {
      source: {
        type: String,
        default: "",
        trim: true,
      },
      medium: {
        type: String,
        default: "",
        trim: true,
      },
      campaign: {
        type: String,
        default: "",
        trim: true,
      },
      term: {
        type: String,
        default: "",
        trim: true,
      },
      content: {
        type: String,
        default: "",
        trim: true,
      },
    },
  },
  {
    timestamps: true,
  },
);

export default model("user_sessions", userSessionSchema);
