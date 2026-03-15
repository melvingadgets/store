export interface StorageOption {
  capacity: string;
  price: number;
  qty: number;
}

export const normalizeCapacity = (value: unknown) => String(value ?? "").trim().toUpperCase();

export const normalizeStorageOptionsInput = (value: unknown): StorageOption[] => {
  const parsedValue =
    typeof value === "string" && value.trim().startsWith("[")
      ? JSON.parse(value)
      : value;

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  const normalizedOptions = parsedValue
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const rawEntry = entry as { capacity?: unknown; price?: unknown; qty?: unknown };
      const capacity = normalizeCapacity(rawEntry.capacity);
      const price = Number(rawEntry.price);
      const qty = Number(rawEntry.qty);

      if (!capacity || !Number.isFinite(price) || !Number.isFinite(qty) || price < 0 || qty < 0) {
        return null;
      }

      return {
        capacity,
        price: Math.round(price),
        qty: Math.floor(qty),
      };
    })
    .filter((entry): entry is StorageOption => entry !== null);

  return normalizedOptions;
};

export const validateStorageOptions = (options: StorageOption[]) => {
  if (options.length === 0) {
    return {
      success: false as const,
      message: "storage options are required",
    };
  }

  const uniqueCapacities = new Set(options.map((option) => option.capacity));
  if (uniqueCapacities.size !== options.length) {
    return {
      success: false as const,
      message: "storage option capacities must be unique",
    };
  }

  return {
    success: true as const,
    message: "ok",
  };
};

export const summarizeStorageOptions = (options: StorageOption[]) => ({
  price: options.reduce((lowestPrice, option) => Math.min(lowestPrice, option.price), options[0]?.price ?? 0),
  qty: options.reduce((totalQty, option) => totalQty + option.qty, 0),
});

export const findStorageOption = (
  product: { storageOptions?: Array<{ capacity?: unknown; price?: unknown; qty?: unknown }> },
  capacity: unknown,
) => {
  const normalizedCapacity = normalizeCapacity(capacity);

  if (!normalizedCapacity) {
    return null;
  }

  return (
    product.storageOptions?.find((option) => normalizeCapacity(option.capacity) === normalizedCapacity) ?? null
  );
};
