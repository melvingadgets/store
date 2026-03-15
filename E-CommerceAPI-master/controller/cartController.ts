import type { Request, Response } from "express";
import cartModel from "../model/cartModel";
import productModel from "../model/productModel";
import userModel from "../model/userModel";
import { loadCatalogModels, withCatalogImagesForCart } from "../utils/catalogImagePresenter";
import { findStorageOption, normalizeCapacity } from "../utils/storageOptions";

const calculateBill = (items: Array<{ quantity: number; price: number }>) =>
  items.reduce((accumulator, currentItem) => accumulator + currentItem.quantity * currentItem.price, 0);

const cartPopulation = {
  path: "cartItem.products",
  select: "name image price qty desc storageOptions",
} as const;

const loadActiveCartForUser = async (userId: string) =>
  cartModel.findOne({ user: userId, isActive: true }).sort({ updatedAt: -1 }).populate(cartPopulation);

const createHydratedCart = async (_userId: string, cartId: string) =>
  cartModel.findById(cartId).populate(cartPopulation);

const normalizeSessionId = (value: unknown) => String(value ?? "").trim().slice(0, 128);
const insufficientStockMessage = "not enough stock is available for this product";

const getTokenUserId = (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    res.status(401).json({
      success: 0,
      message: "authentication is required",
    });
    return null;
  }

  return userId;
};

const findCartItemIndex = (
  cartItem: Array<{ products?: { equals?: (value: string) => boolean }; capacity?: string }>,
  productId: string,
  capacity: string,
) =>
  cartItem.findIndex(
    (item) =>
      item.products?.equals?.(productId) &&
      normalizeCapacity(item.capacity) === normalizeCapacity(capacity),
  );

const resolveProductSelection = (
  product: {
    price?: number;
    qty?: number;
    storageOptions?: Array<{ capacity?: string; price?: number; qty?: number }>;
  },
  capacity: unknown,
) => {
  const normalizedCapacity = normalizeCapacity(capacity);
  const productHasStorageOptions = Array.isArray(product.storageOptions) && product.storageOptions.length > 0;

  if (!productHasStorageOptions) {
    return {
      success: true as const,
      capacity: "",
      price: Number(product.price ?? 0),
      availableQuantity: Number(product.qty ?? 0),
    };
  }

  if (!normalizedCapacity) {
    return {
      success: false as const,
      message: "capacity is required for this product",
    };
  }

  const selectedStorageOption = findStorageOption(product, normalizedCapacity);

  if (!selectedStorageOption) {
    return {
      success: false as const,
      message: "selected capacity is not available for this product",
    };
  }

  return {
    success: true as const,
    capacity: normalizedCapacity,
    price: Number(selectedStorageOption.price ?? 0),
    availableQuantity: Number(selectedStorageOption.qty ?? 0),
  };
};

export const getCart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }

    const cart = await loadActiveCartForUser(userId);
    const catalogModels = await loadCatalogModels();

    return res.status(200).json({
      success: 1,
      message: "cart loaded successfully",
      data: withCatalogImagesForCart(
        cart ?? {
          user: userId,
          cartType: "saved",
          cartItem: [],
          bill: 0,
        },
        catalogModels,
      ),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "unable to load cart",
    });
  }
};

export const addToCart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }
    const { prodId } = req.params;
    const { capacity = "" } = req.body as {
      capacity?: string;
    };

    const getUser = await userModel.findById(userId);
    if (!getUser) {
      return res.status(404).json({
        success: 0,
        message: "user not found",
      });
    }

    const getProduct = await productModel.findById(prodId);
    if (!getProduct) {
      return res.status(404).json({
        success: 0,
        message: "product not found",
      });
    }

    const selection = resolveProductSelection(getProduct, capacity);
    if (!selection.success) {
      return res.status(400).json({
        success: 0,
        message: selection.message,
      });
    }

    let checkUserCart = await cartModel.findOne({ user: userId, isActive: true }).sort({ updatedAt: -1 });
    const itemIndex = checkUserCart
      ? findCartItemIndex(checkUserCart.cartItem, prodId, selection.capacity)
      : -1;
    const existingQuantity = itemIndex > -1 ? checkUserCart?.cartItem[itemIndex].quantity ?? 0 : 0;

    if (selection.availableQuantity < existingQuantity + 1) {
      return res.status(409).json({
        success: 0,
        message: insufficientStockMessage,
      });
    }

    if (!checkUserCart) {
      checkUserCart = await cartModel.create({
        user: getUser._id,
        cartType: "saved",
        isActive: true,
        cartItem: [
          {
            products: getProduct._id,
            capacity: selection.capacity,
            quantity: 1,
            price: selection.price,
          },
        ],
        bill: Number(selection.price),
      });
    } else {
      if (itemIndex > -1) {
        checkUserCart.cartItem[itemIndex].quantity += 1;
      } else {
        checkUserCart.cartItem.push({
          products: getProduct._id,
          capacity: selection.capacity,
          quantity: 1,
          price: selection.price,
        });
      }

      checkUserCart.bill = calculateBill(checkUserCart.cartItem);
      await checkUserCart.save();
    }

    const hydratedCart = await createHydratedCart(userId, checkUserCart._id.toString());
    const catalogModels = await loadCatalogModels();

    return res.status(200).json({
      success: 1,
      message: "cart updated successfully",
      data: withCatalogImagesForCart(hydratedCart ?? checkUserCart, catalogModels),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "unable to add to cart",
    });
  }
};

export const removeCartItem = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }
    const productId = String(req.query.productId ?? req.params.prodId ?? "");
    const capacity = normalizeCapacity(req.query.capacity ?? req.body?.capacity ?? "");
    const removeAll = String(req.query.removeAll ?? "false").toLowerCase() === "true";

    if (!productId) {
      return res.status(400).json({
        success: 0,
        message: "productId is required",
      });
    }

    const checkUserCart = await cartModel.findOne({ user: userId, isActive: true }).sort({ updatedAt: -1 });

    if (!checkUserCart) {
      return res.status(404).json({
        success: 0,
        message: "cart not found",
      });
    }

    const position = findCartItemIndex(checkUserCart.cartItem, productId, capacity);

    if (position === -1) {
      return res.status(404).json({
        success: 0,
        message: "item not found in cart",
      });
    }

    const cartItem = checkUserCart.cartItem[position];

    if (!removeAll && cartItem.quantity > 1) {
      cartItem.quantity -= 1;
    } else {
      checkUserCart.cartItem.splice(position, 1);
    }

    checkUserCart.bill = calculateBill(checkUserCart.cartItem);
    await checkUserCart.save();

    const hydratedCart = await createHydratedCart(userId, checkUserCart._id.toString());
    const catalogModels = await loadCatalogModels();

    return res.status(200).json({
      success: 1,
      message: "item removed from cart",
      data: withCatalogImagesForCart(
        hydratedCart ??
          ({
            user: userId,
            cartItem: [],
            bill: 0,
          } as const),
        catalogModels,
      ),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to remove item from cart",
    });
  }
};

export const syncSessionCart = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = getTokenUserId(req, res);
    if (!userId) {
      return res;
    }

    const { sessionId = "", items = [] } = req.body as {
      sessionId?: string;
      items?: Array<{
        productId?: string;
        quantity?: number;
        capacity?: string;
      }>;
    };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: 0,
        message: "items are required for synchronization",
      });
    }

    const normalizedSessionId = normalizeSessionId(sessionId);
    if (!normalizedSessionId) {
      return res.status(400).json({
        success: 0,
        message: "sessionId is required for synchronization",
      });
    }

    const existingSyncedCart = await cartModel
      .findOne({
        user: userId,
        sourceSessionId: normalizedSessionId,
      })
      .populate(cartPopulation);

    if (existingSyncedCart) {
      await cartModel.updateMany({ user: userId }, { isActive: false });
      existingSyncedCart.isActive = true;
      await existingSyncedCart.save();
      const catalogModels = await loadCatalogModels();

      return res.status(200).json({
        success: 1,
        message: "session cart was already synced",
        data: withCatalogImagesForCart(existingSyncedCart, catalogModels),
      });
    }

    const productIds = items
      .map((item) => String(item.productId ?? "").trim())
      .filter((productId) => productId.length > 0);

    if (productIds.length === 0) {
      return res.status(400).json({
        success: 0,
        message: "items must include valid product ids",
      });
    }

    const products = await productModel.find({ _id: { $in: productIds } }).select("_id price qty storageOptions");
    const productMap = new Map(products.map((product) => [product._id.toString(), product]));
    let hasInsufficientStock = false;
    let hasInvalidCapacity = false;

    const normalizedItems = items
      .map((item) => {
        const productId = String(item.productId ?? "").trim();
        const quantity = Math.max(1, Number(item.quantity ?? 1));
        const product = productMap.get(productId);

        if (!product) {
          return null;
        }

        const selection = resolveProductSelection(product, item.capacity);
        if (!selection.success) {
          hasInvalidCapacity = true;
          return null;
        }

        if (quantity > selection.availableQuantity) {
          hasInsufficientStock = true;
          return null;
        }

        return {
          products: product._id,
          capacity: selection.capacity,
          quantity,
          price: selection.price,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    if (hasInvalidCapacity) {
      return res.status(400).json({
        success: 0,
        message: "one or more capacities are invalid for the selected products",
      });
    }

    if (hasInsufficientStock) {
      return res.status(409).json({
        success: 0,
        message: insufficientStockMessage,
      });
    }

    if (normalizedItems.length === 0) {
      return res.status(400).json({
        success: 0,
        message: "no valid products were found for synchronization",
      });
    }

    await cartModel.updateMany({ user: userId }, { isActive: false });
    const hasExistingCarts = (await cartModel.countDocuments({ user: userId })) > 0;

    const syncedCart = await cartModel.create({
      user: userId,
      cartType: hasExistingCarts ? "synced_session" : "saved",
      sourceSessionId: normalizedSessionId,
      isActive: true,
      cartItem: normalizedItems,
      bill: calculateBill(normalizedItems),
    });

    const hydratedCart = await createHydratedCart(userId, syncedCart._id.toString());
    const catalogModels = await loadCatalogModels();

    return res.status(201).json({
      success: 1,
      message: "session cart synced successfully",
      data: withCatalogImagesForCart(hydratedCart ?? syncedCart, catalogModels),
    });
  } catch {
    return res.status(500).json({
      success: 0,
      message: "failed to sync session cart",
    });
  }
};
