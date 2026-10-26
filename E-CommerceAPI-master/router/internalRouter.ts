import express, { type NextFunction, type Request, type Response } from "express";
import { requireServiceToken, type Scope, type TokenVerifier } from "@melvingadgets/platform-kit";
import { getPersonOrders } from "../controller/internalController";

type Handler = (req: Request, res: Response, next: NextFunction) => void;

// Routes only other platform services may call, each needing its own scope
// (Shortwork/AGENTS.md §2.4). Answers 503 until platform tokens are configured.
export const createInternalRouter = (verifier: TokenVerifier | null) => {
  const router = express.Router();
  const scope = (required: Scope): Handler =>
    verifier
      ? (requireServiceToken(verifier, { audience: "store", scope: required }) as unknown as Handler)
      : (_req, res) => {
          res.status(503).json({ message: "platform tokens are not configured" });
        };
  const wrap =
    (handler: (req: Request, res: Response) => Promise<unknown>): Handler =>
    (req, res, next) => {
      handler(req, res).catch(next);
    };

  router.get("/people/:personId/orders", scope("store:orders.read"), wrap(getPersonOrders));
  return router;
};
