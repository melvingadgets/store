import { Schema, model } from "mongoose";

export type UserRole = "user" | "admin" | "superadmin";

const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "superadmin"],
      default: "user",
    },
    // The auth-service personId this account maps to. Set by migrate-store (or
    // lazily, by email, on first unified login). Unique when set; sparse so legacy
    // rows without it coexist (Shortwork/BACKEND-UNIFICATION §12.4).
    personId: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
    },
    profile: {
      type: Schema.Types.ObjectId,
      ref: "profiles",
    },
    verify: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export default model("users", userSchema);
