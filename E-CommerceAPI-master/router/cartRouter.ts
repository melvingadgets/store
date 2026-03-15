import express from "express";
import { addToCart, getCart, removeCartItem, syncSessionCart } from "../controller/cartController";
import { verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/cart-items").get(verifyToken, getCart);
router.route("/cart-items/:prodId").post(verifyToken, addToCart).delete(verifyToken, removeCartItem);
router.route("/remove-item").delete(verifyToken, removeCartItem);
router.route("/cart-sync").post(verifyToken, syncSessionCart);

// Compatibility aliases for older clients. Identity still comes from token.
router.route("/cart-items/:userId").get(verifyToken, getCart);
router.route("/cart-items/:userId/:prodId").post(verifyToken, addToCart).delete(verifyToken, removeCartItem);
router.route("/remove-item/:userId").delete(verifyToken, removeCartItem);
router.route("/cart-sync/:userId").post(verifyToken, syncSessionCart);

export default router;
