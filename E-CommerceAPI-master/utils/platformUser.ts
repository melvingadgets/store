import { randomBytes } from "crypto";
import {
  createTokenVerifier,
  isPlatformRole,
  type TokenVerifier,
  type UserCaller,
} from "@melvingadgets/platform-kit";
import { env } from "../config/env";
import userModel, { type UserRole } from "../model/userModel";

// Verifies unified user tokens against auth's JWKS (Shortwork/AGENTS.md §2.2).
// Null until AUTH_ISSUER is set, so the store runs unchanged before the rollout.
let verifier: TokenVerifier | null = null;
export const getPlatformUserVerifier = (): TokenVerifier | null => {
  if (verifier) return verifier;
  if (env.platform.authIssuer && env.platform.authJwksUrl) {
    verifier = createTokenVerifier({
      issuer: env.platform.authIssuer,
      jwks: env.platform.authJwksUrl,
    });
  }
  return verifier;
};

// A unified token is RS256; the store's own token is HS256. The header is enough
// to route it — the signature is still fully verified by the verifier.
export const isPlatformToken = (token: string): boolean => {
  try {
    const header = JSON.parse(Buffer.from(token.split(".")[0] || "", "base64url").toString("utf8"));
    return header?.alg === "RS256";
  } catch {
    return false;
  }
};

/**
 * Parses a role from auth into the canonical spelling. There is deliberately no default: the
 * old `toStoreRole` answered `user` for anything it did not recognise, so a malformed role
 * produced a working but wrongly-privileged account. Callers treat `null` as a refusal.
 */
const parseStoreRole = (role: unknown): UserRole | null => {
  if (isPlatformRole(role)) return role;
  const normalized = String(role ?? "").trim().toLowerCase();
  if (normalized === "user") return "User";
  if (normalized === "admin") return "Admin";
  if (normalized === "superadmin") return "SuperAdmin";
  return null;
};

type AuthMeUser = { _id: string; email: string | null; fullName: string; role: string };

// Reads the person's own profile from auth, forwarding their token. Only hit the
// first time an unmigrated person appears; after that they resolve by personId.
const fetchAuthMe = async (token: string): Promise<AuthMeUser | null> => {
  if (!env.platform.authIssuer) return null;
  try {
    const url = new URL("/api/v1/auth/me", `${env.platform.authIssuer}/`).toString();
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { user?: AuthMeUser } };
    return body.data?.user ?? null;
  } catch {
    return null;
  }
};

export type ResolvedStoreUser = { _id: string; userName: string; role: UserRole };

/**
 * Maps a verified unified user to a local store account:
 *  1. by personId (already linked, or a prior shadow keyed by personId);
 *  2. else by email from auth — links that existing account (lazy migration);
 *  3. else creates a shadow account keyed by personId. Its password is an unusable
 *     placeholder: the person authenticates only through the unified token.
 *
 * The role returned is the **verified claim** (`caller.role`), not the local row: a role change
 * in auth therefore takes effect on the next token instead of waiting for the shadow row to
 * sync, and a stale row cannot hand out staff rights. The local row is still written, so the
 * database stays a readable mirror of the claim.
 */
export const resolvePlatformUser = async (
  caller: UserCaller,
  token: string,
): Promise<ResolvedStoreUser | null> => {
  if (!isPlatformRole(caller.role)) return null; // fail closed before touching the database
  const claimRole = caller.role;

  const existing = await userModel
    .findOne({ $or: [{ personId: caller.personId }, { _id: caller.personId }] })
    .select({ _id: 1, userName: 1, role: 1 })
    .lean();
  if (existing) {
    return { _id: String(existing._id), userName: String(existing.userName || ""), role: claimRole };
  }

  const me = await fetchAuthMe(token);
  if (!me) return null;

  const email = (me.email || "").toLowerCase().trim();
  if (email) {
    const byEmail = await userModel.findOne({ email }).select({ _id: 1, userName: 1, role: 1 }).lean();
    if (byEmail) {
      await userModel.updateOne({ _id: byEmail._id }, { $set: { personId: caller.personId, role: claimRole } });
      return { _id: String(byEmail._id), userName: String(byEmail.userName || ""), role: claimRole };
    }
  }

  const created = await userModel.create({
    _id: caller.personId,
    userName: me.fullName || email || "Melvin User",
    // A unique synthetic address for phone-only accounts keeps the email index happy.
    email: email || `${caller.personId}@unified.melvin`,
    password: randomBytes(24).toString("hex"),
    role: claimRole,
    verify: true,
    personId: caller.personId,
  });

  return {
    _id: String(created._id),
    userName: String(created.get("userName") || ""),
    role: claimRole,
  };
};
