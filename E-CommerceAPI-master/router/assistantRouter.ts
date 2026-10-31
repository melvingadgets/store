import express from "express";
import { assistantMessage, assistantMessageStream, assistantTimingSummary } from "../controller/assistantController";
import { requirePermission } from "@melvingadgets/platform-kit";
import { verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/assistant/message").post(verifyToken, assistantMessage);
router.route("/assistant/message/stream").post(verifyToken, assistantMessageStream);
router.route("/assistant/admin/timings").get(verifyToken, requirePermission("store.admin.access"), assistantTimingSummary);

export default router;
