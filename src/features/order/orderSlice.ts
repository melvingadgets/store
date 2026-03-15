import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getOrders } from "../../services/orderService";
import type { OrderRecord, User } from "../../types/domain";

interface RootStateLike {
  auth: {
    user: User | null;
  };
}

interface OrderState {
  orders: OrderRecord[];
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

const initialState: OrderState = {
  orders: [],
  status: "idle",
  error: null,
};

export const fetchOrders = createAsyncThunk("orders/fetchOrders", async (_, { getState }) => {
  const state = getState() as RootStateLike;

  if (!state.auth.user?._id) {
    throw new Error("Please log in to view your orders");
  }

  const response = await getOrders();
  return response.data.data;
});

const orderSlice = createSlice({
  name: "orders",
  initialState,
  reducers: {
    resetOrders: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.orders = action.payload;
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to load orders";
      });
  },
});

export const { resetOrders } = orderSlice.actions;
export default orderSlice.reducer;
