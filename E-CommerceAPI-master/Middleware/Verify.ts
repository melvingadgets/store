import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
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
    req.user = payload;
    return next();
  } catch {
    return unauthorized(res, "Token has expired or is invalid");
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;

  if (role === "admin" || role === "superadmin") {
    return next();
  }

  return res.status(403).json({
    success: 0,
    message: "Admin access is required for this action",
  });
};
