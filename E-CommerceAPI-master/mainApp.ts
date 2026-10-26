import express, { type Application } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import profileRouter from "./router/profile.Router";
import userRouter from "./router/userRouter";
import categoryRouter from "./router/categoryRouter";
import productRouter from "./router/productRouter";
import cartRouter from "./router/cartRouter";
import orderRouter from "./router/orderRouter";
import swapRouter from "./router/swapRouter";
import assistantRouter from "./router/assistantRouter";
import { requestLog } from "./Middleware/requestLog";
import { env } from "./config/env";
import { buildEventReceiver, platformReceiverEnabled } from "./utils/platformReceiver";
import { createInternalRouter } from "./router/internalRouter";
import { getPlatformUserVerifier } from "./utils/platformUser";

export const mainApp = (app: Application) => {
  app.set("trust proxy", true);
  app.use(requestLog("store"));
  app.use(cors());
  // The JSON request log is the record; morgan's coloured line is a local-dev convenience only.
  if (env.nodeEnv !== "production") {
    app.use(morgan("dev"));
  }
  // Signed event deliveries from the relay (Shortwork/AGENTS.md §3.4). Mounted before the JSON
  // parser: the signature covers the exact body bytes, so it needs the raw buffer.
  if (platformReceiverEnabled) {
    app.post("/internal/events", express.raw({ type: () => true, limit: "1mb" }), buildEventReceiver());
  }

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));
  // Service-token reads for other platform services (the reseller service's order lookups).
  app.use("/internal", createInternalRouter(getPlatformUserVerifier()));

  app.get("/api", (_req, res) => {
    res.status(200).json({
      success: 1,
      message: "api is ready",
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      success: 1,
      message: "ok",
    });
  });

  app.get("/page/data/:id", (req, res) => {
    res.render("verifyAccount", {
      userName: "Linda",
      id: req.params.id,
    });
  });

  app.use("/api/v1", userRouter);
  app.use("/api/v1", profileRouter);
  app.use("/api/v1", categoryRouter);
  app.use("/api/v1", cartRouter);
  app.use("/api/v1", productRouter);
  app.use("/api/v1", orderRouter);
  app.use("/api/v1", swapRouter);
  app.use("/api/v1", assistantRouter);
};
