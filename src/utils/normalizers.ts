import type { CartLine, CartRecord, CartItemRecord, Product } from "../types/domain";

const isProduct = (value: CartItemRecord["products"]): value is Product =>
  typeof value === "object" && value !== null && "_id" in value;

export const createCartLineId = (productId: string, capacity?: string) =>
  `${productId}::${String(capacity ?? "").trim().toUpperCase() || "BASE"}`;

export const getProductId = (product: Product | string | undefined) =>
  typeof product === "string" ? product : product?._id ?? "";

export const getCategoryId = (category: Product["category"]) =>
  typeof category === "string" ? category : category?._id ?? "";

export const normalizeCart = (cart: CartRecord): { items: CartLine[]; bill: number } => ({
  items: cart.cartItem.map((item) => {
    const product = isProduct(item.products) ? item.products : undefined;
    const capacity = String(item.capacity ?? "").trim().toUpperCase();
    const productId = product?._id ?? String(item.products);
    const matchingStorageOption = product?.storageOptions?.find(
      (option) => option.capacity.trim().toUpperCase() === capacity,
    );

    return {
      id: createCartLineId(productId, capacity),
      productId,
      name: product?.name ?? "Product",
      price: item.price,
      image: product?.image ?? "",
      quantity: item.quantity,
      capacity: capacity || undefined,
      availableQuantity: matchingStorageOption?.qty ?? product?.qty,
    };
  }),
  bill: cart.bill,
});
