import type { NextFunction, Request, Response } from "express";

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  message: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const getClientIdentifier = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

const createRateLimiter = ({ maxRequests, windowMs, message }: RateLimiterOptions) => {
  const entries = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIdentifier = getClientIdentifier(req);
    const now = Date.now();
    const currentEntry = entries.get(clientIdentifier);

    if (!currentEntry || currentEntry.resetAt <= now) {
      entries.set(clientIdentifier, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (currentEntry.count >= maxRequests) {
      return res.status(429).json({
        success: 0,
        message,
      });
    }

    currentEntry.count += 1;
    entries.set(clientIdentifier, currentEntry);
    return next();
  };
};

const authLimiter = createRateLimiter({
  maxRequests: 10,
  windowMs: 15 * 60 * 1000,
  message: "too many authentication attempts, please try again later",
});

const guestCheckoutLimiter = createRateLimiter({
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
  message: "too many guest checkout attempts, please try again later",
});

export function authRateLimiter(req: Request, res: Response, next: NextFunction) {
  return authLimiter(req, res, next);
}

export function guestCheckoutRateLimiter(req: Request, res: Response, next: NextFunction) {
  return guestCheckoutLimiter(req, res, next);
}
