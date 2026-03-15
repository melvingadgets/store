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

export const mainApp = (app: Application) => {
  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

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
