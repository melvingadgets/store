import express from "express";
import { editImage, updateProfile } from "../controller/profileController";
import { verifyToken } from "../Middleware/Verify";
import { upload } from "../utils/multer";

const router = express.Router();

router.route("/edit/pro/:proId").put(verifyToken, updateProfile);
router.route("/edit/pro-Img/:proId").put(verifyToken, upload, editImage);

export default router;
