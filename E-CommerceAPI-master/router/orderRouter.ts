import express from "express";
import { checkOut, getDeliveryQuote, getOrders, guestCheckOut, updateOrderStatus } from "../controller/orderController";
import { guestCheckoutRateLimiter } from "../Middleware/rateLimiter";
import { requireAdmin, verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/orders").get(verifyToken, getOrders);
router.route("/order-checkout").post(verifyToken, checkOut);
router.route("/guest-checkout").post(guestCheckoutRateLimiter, guestCheckOut);
// Fees before checkout (Shortwork/RESELLER-PLAN.md §8a). Rate-limited like guest checkout: it
// reads products and may call the courier.
router.route("/delivery-quote").post(guestCheckoutRateLimiter, getDeliveryQuote);
// Order lifecycle: paid → completed, or cancelled / rejected at delivery / refunded (admin only).
router.route("/orders/:orderId/status").patch(verifyToken, requireAdmin, updateOrderStatus);

// Compatibility aliases for older clients. Identity still comes from token.
router.route("/orders/:userId").get(verifyToken, getOrders);
router.route("/order-checkout/:userId").post(verifyToken, checkOut);

export default router;
