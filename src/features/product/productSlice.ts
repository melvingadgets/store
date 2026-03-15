import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { getProductById, getProducts } from "../../services/productService";
import type { Product } from "../../types/domain";

interface ProductState {
    products: Product[];
    selectedProduct: Product | null;
    status: "idle" | "loading" | "succeeded" | "failed";
    error: string | null;
}
const initialState: ProductState = {
    products: [],
    selectedProduct: null,
    status: "idle",
    error: null,
}
//fetch all products from the server
export const fetchProducts = createAsyncThunk(
    "product/fetchProducts", async () => {
        const response = await getProducts()
        return response.data.data
    }
)

//thunk to fetch a single product by ID
export const fetchProductById = createAsyncThunk(
    "products/fetchProductById", async(id: string)=>{
        const response = await getProductById(id);
        return response.data.data
    }
)

const productSlice = createSlice({
    name: "product",
    initialState,
    reducers: {
        clearSelectedProduct(state){
            state.selectedProduct = null
        }
    },
    extraReducers(builder) {
        builder
        //handle fetchProducts
        .addCase(fetchProducts.pending, (state)=>{
            state.status = "loading"
        })
        .addCase(fetchProducts.fulfilled, (state, action)=>{
            state.status = "succeeded";
            state.products = action.payload
        })
        .addCase(fetchProducts.rejected, (state, action)=>{
            state.status = "failed";
            state.error = action.error.message || "Failed to fetch product"
        })
        //handle fetchProductById
        .addCase(fetchProductById.pending, (state)=>{
            state.status = "loading"
        })
        .addCase(fetchProductById.fulfilled, (state, action)=>{
            state.status = "succeeded";
            state.selectedProduct = action.payload
        })
        .addCase(fetchProductById.rejected, (state, action)=>{
            state.status = "failed";
            state.selectedProduct = null
            state.error = action.error.message || "Failed to fetch product"
        })
    },
})
export const {clearSelectedProduct} = productSlice.actions
export default productSlice.reducer
