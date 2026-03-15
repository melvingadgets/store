import type { Request, Response } from "express";
import { buildIphoneStorageOptions, hasIphoneCapacityPreset } from "../data/iphoneStorageOptions";
import { env, hasCloudinaryConfig } from "../config/env";
import categoryModel from "../model/categoryModel";
import productModel from "../model/productModel";
import userModel from "../model/userModel";
import cloudinary from "../utils/cloudinary";
import {
  loadCatalogModels,
  withCatalogImageForSingleProduct,
  withCatalogImagesForProducts,
} from "../utils/catalogImagePresenter";
import {
  normalizeStorageOptionsInput,
  summarizeStorageOptions,
  validateStorageOptions,
} from "../utils/storageOptions";
import { getProductById, listProducts } from "../services/productReadService";

const buildResolvedStorageOptions = ({
  name,
  qty,
  price,
  storageOptions,
}: {
  name: string;
  qty: number;
  price: number;
  storageOptions: unknown;
}) => {
  const parsedStorageOptions = normalizeStorageOptionsInput(storageOptions);

  if (parsedStorageOptions.length > 0) {
    return parsedStorageOptions;
  }

  if (hasIphoneCapacityPreset(name)) {
    return buildIphoneStorageOptions(name, price, qty);
  }

  return [];
};

export const createProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { name, desc = "", qty = 0, price = 0, storageOptions = [] } = req.body as {
      name?: string;
      desc?: string;
      qty?: number | string;
      price?: number | string;
      storageOptions?: unknown;
    };
    const { catId } = req.params;

    if (!name?.trim()) {
      return res.status(400).json({
        success: 0,
        message: "product name is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: 0,
        message: "product image is required",
      });
    }

    const getCate = await categoryModel.findById(catId);
    if (!getCate) {
      return res.status(404).json({
        success: 0,
        message: "category not found",
      });
    }

    const getUser = await userModel.findById(req.user?._id);
    if (!getUser) {
      return res.status(404).json({
        success: 0,
        message: "product creator not found",
      });
    }

    let imageUrl = `${env.appBaseUrl}/uploads/${req.file.filename}`;

    if (hasCloudinaryConfig) {
      const uploadResult = await cloudinary.uploader.upload(req.file.path);
      imageUrl = uploadResult.secure_url;
    }

    const resolvedStorageOptions = buildResolvedStorageOptions({
      name: name.trim(),
      qty: Number(qty),
      price: Number(price),
      storageOptions,
    });

    if (resolvedStorageOptions.length > 0) {
      const validation = validateStorageOptions(resolvedStorageOptions);
      if (!validation.success) {
        return res.status(400).json({
          success: 0,
          message: validation.message,
        });
      }
    }

    const inventorySummary =
      resolvedStorageOptions.length > 0
        ? summarizeStorageOptions(resolvedStorageOptions)
        : {
            qty: Number(qty),
            price: Number(price),
          };

    const dataProduct = await productModel.create({
      name: name.trim(),
      desc: desc.trim(),
      qty: inventorySummary.qty,
      price: inventorySummary.price,
      storageOptions: resolvedStorageOptions,
      category: getCate._id,
      image: imageUrl,
      createdBy: getUser._id,
    });

    getCate.products.push(dataProduct._id);
    await getCate.save();

    return res.status(201).json({
      success: 1,
      message: "product successfully created",
      data: withCatalogImageForSingleProduct(dataProduct, await loadCatalogModels()),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to create product",
    });
  }
};

export const updateProductStorageOptions = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { id } = req.params;
    const { storageOptions = [] } = req.body as {
      storageOptions?: unknown;
    };

    const product = await productModel.findById(id);

    if (!product) {
      return res.status(404).json({
        success: 0,
        message: "product not found",
      });
    }

    const normalizedStorageOptions = normalizeStorageOptionsInput(storageOptions);
    const validation = validateStorageOptions(normalizedStorageOptions);

    if (!validation.success) {
      return res.status(400).json({
        success: 0,
        message: validation.message,
      });
    }

    const inventorySummary = summarizeStorageOptions(normalizedStorageOptions);
    product.storageOptions = normalizedStorageOptions;
    product.qty = inventorySummary.qty;
    product.price = inventorySummary.price;
    await product.save();

    return res.status(200).json({
      success: 1,
      message: "product storage options updated successfully",
      data: withCatalogImageForSingleProduct(product, await loadCatalogModels()),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to update product storage options",
    });
  }
};

export const ViewAllProduct = async (_req: Request, res: Response): Promise<Response> => {
  try {
    const fetchProduct = await listProducts({
      productStore: productModel,
      limit: 500,
    });
    const catalogModels = await loadCatalogModels();

    return res.status(200).json({
      success: 1,
      message: "products loaded successfully",
      data: withCatalogImagesForProducts(fetchProduct, catalogModels),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "an error occurred",
    });
  }
};

export const ViewSingleProduct = async (req: Request, res: Response): Promise<Response> => {
  try {
    const fetchProduct = await getProductById({
      productId: req.params.id,
      productStore: productModel,
    });

    if (!fetchProduct) {
      return res.status(404).json({
        success: 0,
        message: "product not found",
      });
    }

    return res.status(200).json({
      success: 1,
      message: "product loaded successfully",
      data: withCatalogImageForSingleProduct(fetchProduct, await loadCatalogModels()),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "an error occurred",
    });
  }
};
