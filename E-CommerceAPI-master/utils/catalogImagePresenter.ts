import {
  fetchPublicEasyBuyCatalog,
  findPublicEasyBuyCatalogModel,
  type PublicEasyBuyCatalogModel,
} from "./easyBuyCatalog";

const toPlainValue = <T>(value: T): T => {
  if (value && typeof value === "object" && "toObject" in (value as Record<string, unknown>)) {
    const toObject = (value as { toObject?: () => T }).toObject;
    if (typeof toObject === "function") {
      return toObject.call(value);
    }
  }

  return value;
};

const withCatalogImageForProduct = (
  product: Record<string, unknown> | null | undefined,
  catalogModels: PublicEasyBuyCatalogModel[] | undefined,
) => {
  const plainProduct = toPlainValue(product);

  if (!plainProduct || typeof plainProduct !== "object") {
    return plainProduct;
  }

  const productName = String(plainProduct.name ?? "").trim();
  if (!productName) {
    return plainProduct;
  }

  const catalogImage = findPublicEasyBuyCatalogModel(catalogModels, productName)?.imageUrl;

  return catalogImage
    ? {
        ...plainProduct,
        image: catalogImage,
      }
    : plainProduct;
};

export const loadCatalogModels = async () => (await fetchPublicEasyBuyCatalog())?.models;

export const withCatalogImagesForProducts = (
  products: unknown,
  catalogModels: PublicEasyBuyCatalogModel[] | undefined,
) => {
  const plainProducts = toPlainValue(products);

  if (!Array.isArray(plainProducts)) {
    return [];
  }

  return plainProducts.map((product) =>
    withCatalogImageForProduct(product as Record<string, unknown>, catalogModels),
  );
};

export const withCatalogImageForSingleProduct = (
  product: unknown,
  catalogModels: PublicEasyBuyCatalogModel[] | undefined,
) => withCatalogImageForProduct(toPlainValue(product as Record<string, unknown>), catalogModels);

export const withCatalogImagesForCart = (
  cart: unknown,
  catalogModels: PublicEasyBuyCatalogModel[] | undefined,
) => {
  const plainCart = toPlainValue(cart);

  if (!plainCart || typeof plainCart !== "object") {
    return plainCart;
  }

  const cartItem = Array.isArray((plainCart as { cartItem?: unknown[] }).cartItem)
    ? ((plainCart as { cartItem: unknown[] }).cartItem).map((item) => {
        const plainItem = toPlainValue(item);

        if (!plainItem || typeof plainItem !== "object") {
          return plainItem;
        }

        const productValue = (plainItem as { products?: unknown }).products;

        return {
          ...plainItem,
          products:
            productValue && typeof productValue === "object"
              ? withCatalogImageForProduct(productValue as Record<string, unknown>, catalogModels)
              : productValue,
        };
      })
    : (plainCart as { cartItem?: unknown[] }).cartItem;

  return {
    ...plainCart,
    cartItem,
  };
};

export const withCatalogImagesForOrders = (
  orders: unknown,
  catalogModels: PublicEasyBuyCatalogModel[] | undefined,
) => {
  const plainOrders = toPlainValue(orders);

  if (!Array.isArray(plainOrders)) {
    return [];
  }

  return plainOrders.map((order) => {
    const plainOrder = toPlainValue(order);

    if (!plainOrder || typeof plainOrder !== "object") {
      return plainOrder;
    }

    const orderItem = Array.isArray((plainOrder as { orderItem?: unknown[] }).orderItem)
      ? ((plainOrder as { orderItem: unknown[] }).orderItem).map((item) => {
          const plainItem = toPlainValue(item);

          if (!plainItem || typeof plainItem !== "object") {
            return plainItem;
          }

          const productValue = (plainItem as { products?: unknown }).products;

          return {
            ...plainItem,
            products:
              productValue && typeof productValue === "object"
                ? withCatalogImageForProduct(productValue as Record<string, unknown>, catalogModels)
                : productValue,
          };
        })
      : (plainOrder as { orderItem?: unknown[] }).orderItem;

    return {
      ...plainOrder,
      orderItem,
    };
  });
};
