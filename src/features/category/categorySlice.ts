import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getCategories, getCategoryById } from "../../services/categoryService";
import type { Category } from "../../types/domain";

interface CategoryState {
  categories: Category[];
  selectedCategory: Category | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

const initialState: CategoryState = {
  categories: [],
  selectedCategory: null,
  status: "idle",
  error: null,
};

export const fetchCategories = createAsyncThunk("category/fetchCategories", async () => {
  const response = await getCategories();
  return response.data.data;
});

export const fetchCategoryById = createAsyncThunk(
  "category/fetchCategoryById",
  async (categoryId: string) => {
    const response = await getCategoryById(categoryId);
    return response.data.data;
  },
);

const categorySlice = createSlice({
  name: "category",
  initialState,
  reducers: {
    clearSelectedCategory(state) {
      state.selectedCategory = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error.message ?? "Failed to load categories";
      })
      .addCase(fetchCategoryById.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchCategoryById.fulfilled, (state, action) => {
        state.selectedCategory = action.payload;
      })
      .addCase(fetchCategoryById.rejected, (state, action) => {
        state.error = action.error.message ?? "Failed to load category";
      });
  },
});

export const { clearSelectedCategory } = categorySlice.actions;
export default categorySlice.reducer;
