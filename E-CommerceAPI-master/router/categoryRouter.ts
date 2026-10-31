import express from "express";
import {
  createCategory,
  deleteCate,
  getAllCategory,
  singleCategory,
} from "../controller/categoryController";
import { requirePermission } from "@melvingadgets/platform-kit";
import { verifyToken } from "../Middleware/Verify";

const router = express.Router();

router.route("/create-category").post(verifyToken, requirePermission("store.catalog.write"), createCategory);
router.route("/create-category/:userId").post(verifyToken, requirePermission("store.catalog.write"), createCategory);
router.route("/categories").get(getAllCategory).post(verifyToken, requirePermission("store.catalog.write"), createCategory);
router.route("/all-categories").get(getAllCategory);
router.route("/singel-cate/:id").get(singleCategory);
router.route("/categories/:id").get(singleCategory).delete(verifyToken, requirePermission("store.catalog.write"), deleteCate);
router.route("/delete-category/:id").delete(verifyToken, requirePermission("store.catalog.write"), deleteCate);

export default router;
