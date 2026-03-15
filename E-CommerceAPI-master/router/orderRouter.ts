import express from "express";
import { checkOut, getOrders, guestCheckOut } from "../controller/orderController";
import { guestCheckoutRateLimiter } from "../Middleware/rateLimiter";
import { verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/orders").get(verifyToken, getOrders);
router.route("/order-checkout").post(verifyToken, checkOut);
router.route("/guest-checkout").post(guestCheckoutRateLimiter, guestCheckOut);

// Compatibility aliases for older clients. Identity still comes from token.
router.route("/orders/:userId").get(verifyToken, getOrders);
router.route("/order-checkout/:userId").post(verifyToken, checkOut);

export default router;
