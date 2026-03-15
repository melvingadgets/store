import express from "express";
import {
  createCategory,
  deleteCate,
  getAllCategory,
  singleCategory,
} from "../controller/categoryController";
import { requireAdmin, verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/create-category").post(verifyToken, requireAdmin, createCategory);
router.route("/create-category/:userId").post(verifyToken, requireAdmin, createCategory);
router.route("/categories").get(getAllCategory).post(verifyToken, requireAdmin, createCategory);
router.route("/all-categories").get(getAllCategory);
router.route("/singel-cate/:id").get(singleCategory);
router.route("/categories/:id").get(singleCategory).delete(verifyToken, requireAdmin, deleteCate);
router.route("/delete-category/:id").delete(verifyToken, requireAdmin, deleteCate);

export default router;
