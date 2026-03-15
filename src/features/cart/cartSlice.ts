import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { shopApi } from "../../redux/shopApi";
import type { CartLine, CartRecord, CheckoutRecord, GuestCheckoutGuest, User } from "../../types/domain";
import { createCartLineId, normalizeCart } from "../../utils/normalizers";

type RequestStatus = "idle" | "loading" | "succeeded" | "failed";
type CartMode = "guest" | "server";

export interface AddToCartInput {
  productId: string;
  name: string;
  price: number;
  image: string;
  capacity?: string;
  availableQuantity?: number;
}

export interface CartItemSelection {
  productId: string;
  capacity?: string;
}

interface CartState {
  items: CartLine[];
  bill: number;
  mode: CartMode;
  status: RequestStatus;
  checkoutStatus: RequestStatus;
  error: string | null;
  lastOrder: CheckoutRecord | null;
}

interface RootStateLike {
  auth: {
    user: User | null;
  };
  cart: CartState;
}

interface CartSnapshot {
  items: CartLine[];
  bill: number;
  mode: CartMode;
}

const insufficientStockMessage = "Not enough stock is available for this product";

const calculateBill = (items: CartLine[]) =>
  items.reduce((total, item) => total + item.price * item.quantity, 0);

const createInitialState = (): CartState => ({
  items: [],
  bill: 0,
  mode: "guest",
  status: "idle",
  checkoutStatus: "idle",
  error: null,
  lastOrder: null,
});

const buildGuestSnapshot = (cart: CartState): CartSnapshot => ({
  items: cart.items,
  bill: cart.bill,
  mode: "guest",
});

const buildServerSnapshot = (cart: CartRecord): CartSnapshot => {
  const normalizedCart = normalizeCart(cart);

  return {
    items: normalizedCart.items,
    bill: normalizedCart.bill,
    mode: "server",
  };
};

const ensureAuthenticated = (state: RootStateLike) => {
  if (!state.auth.user?._id) {
    throw new Error("Please log in to continue");
  }
};

const ensureStockAvailable = (currentQuantity: number, availableQuantity?: number) => {
  if (availableQuantity !== undefined && currentQuantity >= availableQuantity) {
    throw new Error(insufficientStockMessage);
  }
};

const buildGuestCartAfterAdd = (cart: CartState, itemToAdd: AddToCartInput): CartSnapshot => {
  const lineId = createCartLineId(itemToAdd.productId, itemToAdd.capacity);
  const existingItem = cart.items.find((item) => item.id === lineId);

  if (existingItem) {
    const resolvedAvailableQuantity = itemToAdd.availableQuantity ?? existingItem.availableQuantity;
    ensureStockAvailable(existingItem.quantity, resolvedAvailableQuantity);
  } else if ((itemToAdd.availableQuantity ?? 1) < 1) {
    throw new Error(insufficientStockMessage);
  }

  const items = existingItem
    ? cart.items.map((item) =>
        item.id === lineId
          ? {
              ...item,
              quantity: item.quantity + 1,
              availableQuantity: itemToAdd.availableQuantity ?? item.availableQuantity,
            }
          : item,
      )
    : [
        ...cart.items,
        {
          id: lineId,
          productId: itemToAdd.productId,
          name: itemToAdd.name,
          price: itemToAdd.price,
          image: itemToAdd.image,
          quantity: 1,
          capacity: itemToAdd.capacity,
          availableQuantity: itemToAdd.availableQuantity,
        },
      ];

  return {
    items,
    bill: calculateBill(items),
    mode: "guest",
  };
};

const buildGuestCartAfterDecrease = (cart: CartState, selection: CartItemSelection): CartSnapshot => {
  const lineId = createCartLineId(selection.productId, selection.capacity);
  const items = cart.items
    .map((item) =>
      item.id === lineId
        ? {
            ...item,
            quantity: item.quantity - 1,
          }
        : item,
    )
    .filter((item) => item.quantity > 0);

  return {
    items,
    bill: calculateBill(items),
    mode: "guest",
  };
};

const buildGuestCartAfterRemove = (cart: CartState, selection: CartItemSelection): CartSnapshot => {
  const lineId = createCartLineId(selection.productId, selection.capacity);
  const items = cart.items.filter((item) => item.id !== lineId);

  return {
    items,
    bill: calculateBill(items),
    mode: "guest",
  };
};

const shouldUseLocalCart = (state: RootStateLike) => state.cart.mode === "guest" && state.cart.items.length > 0;

const toCheckoutItems = (items: CartLine[]) =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    capacity: item.capacity,
  }));

const applyCartSnapshot = (state: CartState, snapshot: CartSnapshot) => {
  state.items = snapshot.items;
  state.bill = snapshot.bill;
  state.mode = snapshot.mode;
};

export const fetchCart = createAsyncThunk("cart/fetchCart", async (_, { dispatch, getState }) => {
  const state = getState() as RootStateLike;

  if (!state.auth.user?._id || shouldUseLocalCart(state)) {
    return buildGuestSnapshot(state.cart);
  }

  const cart = await dispatch(shopApi.endpoints.getCart.initiate(undefined, { subscribe: false })).unwrap();
  return buildServerSnapshot(cart);
});

export const addItemToCart = createAsyncThunk(
  "cart/addItemToCart",
  async (itemToAdd: AddToCartInput, { dispatch, getState }) => {
    const state = getState() as RootStateLike;

    if (!state.auth.user?._id || shouldUseLocalCart(state)) {
      return buildGuestCartAfterAdd(state.cart, itemToAdd);
    }

    const response = await dispatch(
      shopApi.endpoints.addCartItem.initiate({
        productId: itemToAdd.productId,
        capacity: itemToAdd.capacity,
      }),
    ).unwrap();
    return buildServerSnapshot(response.data);
  },
);

export const decreaseQuantity = createAsyncThunk(
  "cart/decreaseQuantity",
  async (selection: CartItemSelection, { dispatch, getState }) => {
    const state = getState() as RootStateLike;

    if (!state.auth.user?._id || shouldUseLocalCart(state)) {
      return buildGuestCartAfterDecrease(state.cart, selection);
    }

    const response = await dispatch(
      shopApi.endpoints.decrementCartItem.initiate({
        productId: selection.productId,
        capacity: selection.capacity,
      }),
    ).unwrap();
    return buildServerSnapshot(response.data);
  },
);

export const removeItemFromCart = createAsyncThunk(
  "cart/removeItemFromCart",
  async (selection: CartItemSelection, { dispatch, getState }) => {
    const state = getState() as RootStateLike;

    if (!state.auth.user?._id || shouldUseLocalCart(state)) {
      return buildGuestCartAfterRemove(state.cart, selection);
    }

    const response = await dispatch(
      shopApi.endpoints.removeCartItemCompletely.initiate({
        productId: selection.productId,
        capacity: selection.capacity,
      }),
    ).unwrap();
    return buildServerSnapshot(response.data);
  },
);

export const checkoutCart = createAsyncThunk("cart/checkoutCart", async (_, { dispatch, getState }) => {
  const state = getState() as RootStateLike;
  ensureAuthenticated(state);

  const response = await dispatch(
    shopApi.endpoints.checkoutOrder.initiate({
      paymentReference: `web-${Date.now()}`,
      items: shouldUseLocalCart(state) ? toCheckoutItems(state.cart.items) : undefined,
    }),
  ).unwrap();
  return response.data as CheckoutRecord;
});

export const checkoutGuestCart = createAsyncThunk(
  "cart/checkoutGuestCart",
  async (guest: GuestCheckoutGuest, { dispatch, getState }) => {
    const state = getState() as RootStateLike;

    if (state.cart.items.length === 0) {
      throw new Error("Your cart is empty");
    }

    const response = await dispatch(
      shopApi.endpoints.checkoutGuestOrder.initiate({
        paymentReference: `guest-${Date.now()}`,
        items: toCheckoutItems(state.cart.items),
        guest,
      }),
    ).unwrap();
    return response.data as CheckoutRecord;
  },
);

const cartSlice = createSlice({
  name: "cart",
  initialState: createInitialState(),
  reducers: {
    resetCartState: () => createInitialState(),
    clearLastOrder(state) {
      state.lastOrder = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = null;
        applyCartSnapshot(state, action.payload);
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to load cart";
      })
      .addCase(addItemToCart.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(addItemToCart.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = null;
        applyCartSnapshot(state, action.payload);
      })
      .addCase(addItemToCart.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to add item to cart";
      })
      .addCase(decreaseQuantity.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(decreaseQuantity.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = null;
        applyCartSnapshot(state, action.payload);
      })
      .addCase(decreaseQuantity.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to update cart quantity";
      })
      .addCase(removeItemFromCart.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(removeItemFromCart.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.error = null;
        applyCartSnapshot(state, action.payload);
      })
      .addCase(removeItemFromCart.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to remove item from cart";
      })
      .addCase(checkoutCart.pending, (state) => {
        state.checkoutStatus = "loading";
        state.error = null;
      })
      .addCase(checkoutCart.fulfilled, (state, action) => {
        state.checkoutStatus = "succeeded";
        state.status = "succeeded";
        state.error = null;
        state.items = [];
        state.bill = 0;
        state.mode = "guest";
        state.lastOrder = action.payload;
      })
      .addCase(checkoutCart.rejected, (state, action) => {
        state.checkoutStatus = "failed";
        state.error = action.error.message ?? "Failed to checkout cart";
      })
      .addCase(checkoutGuestCart.pending, (state) => {
        state.checkoutStatus = "loading";
        state.error = null;
      })
      .addCase(checkoutGuestCart.fulfilled, (state, action) => {
        state.checkoutStatus = "succeeded";
        state.status = "succeeded";
        state.error = null;
        state.items = [];
        state.bill = 0;
        state.mode = "guest";
        state.lastOrder = action.payload;
      })
      .addCase(checkoutGuestCart.rejected, (state, action) => {
        state.checkoutStatus = "failed";
        state.error = action.error.message ?? "Failed to checkout cart";
      });
  },
});

export const { clearLastOrder, resetCartState } = cartSlice.actions;
export default cartSlice.reducer;
