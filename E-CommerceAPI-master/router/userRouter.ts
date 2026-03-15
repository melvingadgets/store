import express from "express";
import {
  createUser,
  getAllUsers,
  getSingleUser,
  logOut,
  loginUser,
  verifyUser,
} from "../controller/UserController";
import { authRateLimiter } from "../Middleware/rateLimiter";
import { requireAdmin, verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/create-user").post(authRateLimiter, createUser);
router.route("/register").post(authRateLimiter, createUser);
router.route("/login-user").post(authRateLimiter, loginUser);
router.route("/login").post(authRateLimiter, loginUser);
router.route("/single-profile").get(verifyToken, getSingleUser);
router.route("/single-profile/:id").get(verifyToken, getSingleUser);
router.route("/all-users").get(verifyToken, requireAdmin, getAllUsers);
router.route("/logout-user").get(logOut);
router.route("/verify-account/:id").get(verifyUser);

export default router;
