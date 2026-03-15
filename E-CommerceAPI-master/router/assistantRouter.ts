import express from "express";
import { assistantMessage, assistantTimingSummary } from "../controller/assistantController";
import { requireAdmin, verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/assistant/message").post(verifyToken, assistantMessage);
router.route("/assistant/admin/timings").get(verifyToken, requireAdmin, assistantTimingSummary);

export default router;
