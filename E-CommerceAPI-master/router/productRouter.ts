import express from "express";
import {
  ViewAllProduct,
  ViewSingleProduct,
  createProduct,
  updateProductStorageOptions,
} from "../controller/productController";
import { requireAdmin, verifyToken } from "../Middleware/Verify";
import { uploads } from "../utils/multer";

const router = express.Router();

router.route("/create-product/:catId").post(verifyToken, requireAdmin, uploads, createProduct);
router.route("/create-product/:userId/:catId").post(verifyToken, requireAdmin, uploads, createProduct);
router.route("/products/:id/storage-options").put(verifyToken, requireAdmin, updateProductStorageOptions);
router.route("/products").get(ViewAllProduct);
router.route("/products/:id").get(ViewSingleProduct);
router.route("/singleProduct/:id").get(ViewSingleProduct);
router.route("/all-Products").get(ViewAllProduct);

export default router;
