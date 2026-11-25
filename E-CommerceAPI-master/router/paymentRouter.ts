import express from "express";
import {
  handlePaystackWebhook,
  initializePaystackPayment,
  verifyPaystackPayment,
} from "../controller/paymentController";
import { paymentRateLimiter } from "../Middleware/rateLimiter";
import { verifyOptionalToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/payments/paystack/initialize").post(
  paymentRateLimiter,
  verifyOptionalToken,
  initializePaystackPayment,
);
router.route("/payments/paystack/verify").post(
  paymentRateLimiter,
  verifyPaystackPayment,
);
router.route("/webhooks/paystack").post(handlePaystackWebhook);

export default router;
