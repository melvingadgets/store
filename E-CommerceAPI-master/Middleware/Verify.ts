import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { isPlatformRole } from "@melvingadgets/platform-kit";
import { getPlatformUserVerifier, isPlatformToken, resolvePlatformUser } from "../utils/platformUser";

const unauthorized = (res: Response, message: string) =>
  res.status(401).json({
    success: 0,
    message,
  });

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "Please provide a valid bearer token");
  }

  const token = authHeader.split(" ")[1];

  // Unified token (Shortwork/AGENTS.md §2): verify against auth's JWKS and map the
  // person to a local store account. Runs alongside the store's own token (§7.1).
  const platformVerifier = getPlatformUserVerifier();
  if (platformVerifier && isPlatformToken(token)) {
    try {
      const caller = await platformVerifier.verifyUserToken(token);
      const user = await resolvePlatformUser(caller, token);
      if (!user) {
        return unauthorized(res, "Token has expired or is invalid");
      }
      req.user = user;
      return next();
    } catch {
      return unauthorized(res, "Token has expired or is invalid");
    }
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret()) as Express.UserPayload;
    // No default: the store used to fall through to `user` for anything unrecognised, which
    // made a malformed role look like a working login. An unreadable role is a 401.
    if (!isPlatformRole(payload?.role)) {
      return unauthorized(res, "Token has expired or is invalid");
    }
    req.user = payload;
    return next();
  } catch {
    return unauthorized(res, "Token has expired or is invalid");
  }
};

// `requireAdmin` used to live here. It compared lowercase role strings and returned 403 for a
// `SuperAdmin`, because `"SuperAdmin" !== "superadmin"` — the exact lockout this rollout fixes.
// Every admin route now names the permission it needs from @melvingadgets/platform-kit:
//   store.admin.access     — staff-only reads (all users, sessions, assistant timings)
//   store.catalog.write    — categories and products
//   store.orders.manage    — order status changes
//   store.orders.create    — a customer placing an order
// The permissions themselves are defined once, in the kit (docs/rbac-unification.md).

