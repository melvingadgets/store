import type { Request, Response } from "express";
import slugify from "slugify";
import categoryModel from "../model/categoryModel";
import userModel from "../model/userModel";

const genSlugCode = () => {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const length = 6;
  let randomId = "";

  for (let index = 0; index < length; index += 1) {
    randomId += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return randomId;
};

export const createCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, parent = "" } = req.body as { name?: string; parent?: string };

    if (!name?.trim()) {
      return res.status(400).json({
        success: 0,
        message: "enter category name",
      });
    }

    const ownerId = req.user?._id;
    if (!ownerId) {
      return res.status(401).json({
        success: 0,
        message: "authentication is required",
      });
    }
    const getUser = await userModel.findById(ownerId);

    if (!getUser) {
      return res.status(404).json({
        success: 0,
        message: "category owner not found",
      });
    }

    const categoryData = await categoryModel.create({
      name: name.trim(),
      parent: parent.trim(),
      slug: `${slugify(name, { lower: true, strict: true })}-${genSlugCode()}`,
      user: getUser._id,
    });

    return res.status(201).json({
      success: 1,
      message: "category created successfully",
      data: categoryData,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "category not created",
    });
  }
};

export const getAllCategory = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const allCategories = await categoryModel.find().populate({
      path: "user",
      select: "userName email",
    });

    return res.status(200).json({
      success: 1,
      message: "all categories data",
      data: allCategories,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "unable to load categories",
    });
  }
};

export const singleCategory = async (req: Request, res: Response): Promise<Response> => {
  try {
    const singleCate = await categoryModel.findById(req.params.id).populate({
      path: "user",
      select: "userName email",
    });

    if (!singleCate) {
      return res.status(404).json({
        success: 0,
        message: "category not found",
      });
    }

    return res.status(200).json({
      success: 1,
      message: "single category",
      data: singleCate,
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "category lookup failed",
    });
  }
};

export const deleteCate = async (req: Request, res: Response): Promise<Response> => {
  try {
    const removeCate = await categoryModel.findByIdAndDelete(req.params.id);

    if (!removeCate) {
      return res.status(404).json({
        success: 0,
        message: "category not found",
      });
    }

    return res.status(200).json({
      success: 1,
      message: "category successfully deleted",
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to delete category",
    });
  }
};
