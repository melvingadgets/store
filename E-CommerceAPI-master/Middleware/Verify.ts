import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

const unauthorized = (res: Response, message: string) =>
  res.status(401).json({
    success: 0,
    message,
  });

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return unauthorized(res, "Please provide a valid bearer token");
  }

  const token = authHeader.split(" ")[1];

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
