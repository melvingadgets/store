import fs from "fs";
import path from "path";
import multer from "multer";
import type { Request } from "express";

const uploadsDirectory = path.resolve(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory, { recursive: true });
}

const createStorage = () =>
  multer.diskStorage({
    destination(_req: Request, _file, callback) {
      callback(null, uploadsDirectory);
    },
    filename(_req: Request, file, callback) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      callback(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  });

export const upload = multer({ storage: createStorage() }).single("avatar");
export const uploads = multer({ storage: createStorage() }).single("image");
