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
    // The auth-service personId this account maps to. Set by migrate-store (or lazily, by email,
    // on first unified login) (Shortwork/BACKEND-UNIFICATION §12.4). No default on purpose: a
    // missing field must stay missing, because a stored null would count as a value in the unique
    // index below and the second account without a personId would collide.
    personId: {
      type: String,
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

// One account per person, enforced only for accounts that have a personId. A partial index, not a
// sparse one: sparse still indexes an explicit null, partial skips everything that isn't a string.
userSchema.index({ personId: 1 }, { unique: true, partialFilterExpression: { personId: { $type: "string" } } });

export default model("users", userSchema);
