import express from "express";
import { evaluateSwap, getSwapMetadata } from "../controller/swapController";

const router = express.Router();

router.route("/swap/metadata").get(getSwapMetadata);
router.route("/swap/evaluate").post(evaluateSwap);

export default router;
