import { createApi } from "@reduxjs/toolkit/query/react";
import type { AxiosError, AxiosRequestConfig } from "axios";
import type { CategoryPayload } from "../services/categoryService";
import type { CheckoutPayload, GuestCheckoutPayload } from "../services/orderService";
import type { ProfilePayload, UserWithProfile } from "../services/profileService";
import type {
  ApiResponse,
  CartRecord,
  Category,
  CheckoutRecord,
  OrderRecord,
  Product,
  ProductStorageOption,
  Profile,
  AssistantMessageRequest,
  AssistantMessageResponse,
  AssistantTimingSummary,
  SwapConditionSelections,
  SwapEvaluationResult,
  SwapMetadata,
  User,
} from "../types/domain";
import apiClient, { type ApiClientRequestConfig } from "../utils/axios";

type AxiosBaseQueryArgs = {
  url: string;
  method?: AxiosRequestConfig["method"];
  data?: unknown;
  params?: unknown;
  headers?: AxiosRequestConfig["headers"];
  suppressGlobalLoader?: boolean;
};

type AxiosBaseQueryError = {
  status?: number;
  data?: unknown;
};

const axiosBaseQuery =
  () =>
  async ({ url, method = "get", data, params, headers, suppressGlobalLoader }: AxiosBaseQueryArgs) => {
    try {
      const result = await apiClient({
        url,
        method,
        data,
        params,
        headers,
        suppressGlobalLoader,
      } as ApiClientRequestConfig);

      return {
        data: result.data,
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      return {
        error: {
          status: axiosError.response?.status,
          data: axiosError.response?.data ?? axiosError.message,
        } satisfies AxiosBaseQueryError,
      };
    }
  };

export const shopApi = createApi({
  reducerPath: "shopApi",
  baseQuery: axiosBaseQuery(),
  keepUnusedDataFor: 120,
  refetchOnFocus: true,
  refetchOnReconnect: true,
  tagTypes: ["Products", "Categories", "Orders", "Profile", "Users", "Cart"],
  endpoints: (builder) => ({
    getProducts: builder.query<Product[], void>({
      query: () => ({
        url: "/products",
      }),
      transformResponse: (response: ApiResponse<Product[]>) => response.data,
      providesTags: (result) =>
        result
          ? [
              { type: "Products", id: "LIST" },
              ...result.map((product) => ({ type: "Products" as const, id: product._id })),
            ]
          : [{ type: "Products", id: "LIST" }],
    }),
    getProductById: builder.query<Product, string>({
      query: (productId) => ({
        url: `/products/${productId}`,
      }),
      transformResponse: (response: ApiResponse<Product>) => response.data,
      providesTags: (_result, _error, productId) => [{ type: "Products", id: productId }],
    }),
    getSwapMetadata: builder.query<SwapMetadata, void>({
      query: () => ({
        url: "/swap/metadata",
      }),
      transformResponse: (response: ApiResponse<SwapMetadata>) => response.data,
    }),
    evaluateSwap: builder.query<
      SwapEvaluationResult,
      {
        targetProductId: string;
        targetCapacity?: string;
        tradeInModel: string;
        tradeInStorage: string;
        conditionSelections: SwapConditionSelections;
      }
    >({
      query: (payload) => ({
        url: "/swap/evaluate",
        method: "post",
        data: payload,
        suppressGlobalLoader: true,
      }),
      transformResponse: (response: ApiResponse<SwapEvaluationResult>) => response.data,
    }),
    sendAssistantMessage: builder.mutation<AssistantMessageResponse, AssistantMessageRequest>({
      query: (payload) => ({
        url: "/assistant/message",
        method: "post",
        data: payload,
        suppressGlobalLoader: true,
      }),
      transformResponse: (response: ApiResponse<AssistantMessageResponse>) => response.data,
    }),
    getAssistantTimingSummary: builder.query<AssistantTimingSummary, void>({
      query: () => ({
        url: "/assistant/admin/timings",
        suppressGlobalLoader: true,
      }),
      transformResponse: (response: ApiResponse<AssistantTimingSummary>) => response.data,
    }),
    createProduct: builder.mutation<ApiResponse<Product>, { categoryId: string; formData: FormData }>({
      query: ({ categoryId, formData }) => ({
        url: `/create-product/${categoryId}`,
        method: "post",
        data: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
      invalidatesTags: [{ type: "Products", id: "LIST" }],
    }),
    updateProductStorageOptions: builder.mutation<
      ApiResponse<Product>,
      { productId: string; storageOptions: ProductStorageOption[] }
    >({
      query: ({ productId, storageOptions }) => ({
        url: `/products/${productId}/storage-options`,
        method: "put",
        data: {
          storageOptions,
        },
      }),
      invalidatesTags: (_result, _error, { productId }) => [
        { type: "Products", id: productId },
        { type: "Products", id: "LIST" },
      ],
    }),
    getCategories: builder.query<Category[], void>({
      query: () => ({
        url: "/categories",
      }),
      transformResponse: (response: ApiResponse<Category[]>) => response.data,
      providesTags: (result) =>
        result
          ? [
              { type: "Categories", id: "LIST" },
              ...result.map((category) => ({ type: "Categories" as const, id: category._id })),
            ]
          : [{ type: "Categories", id: "LIST" }],
    }),
    createCategory: builder.mutation<ApiResponse<Category>, CategoryPayload>({
      query: (payload) => ({
        url: "/create-category",
        method: "post",
        data: payload,
      }),
      invalidatesTags: [{ type: "Categories", id: "LIST" }],
    }),
    deleteCategory: builder.mutation<ApiResponse<null>, string>({
      query: (categoryId) => ({
        url: `/categories/${categoryId}`,
        method: "delete",
      }),
      invalidatesTags: (_result, _error, categoryId) => [
        { type: "Categories", id: categoryId },
        { type: "Categories", id: "LIST" },
      ],
    }),
    getOrders: builder.query<OrderRecord[], void>({
      query: () => ({
        url: "/orders",
      }),
      transformResponse: (response: ApiResponse<OrderRecord[]>) => response.data,
      providesTags: (result) =>
        result
          ? [
              { type: "Orders", id: "LIST" },
              ...result.map((order) => ({ type: "Orders" as const, id: order._id })),
            ]
          : [{ type: "Orders", id: "LIST" }],
    }),
    checkoutOrder: builder.mutation<ApiResponse<OrderRecord>, CheckoutPayload>({
      query: (payload) => ({
        url: "/order-checkout",
        method: "post",
        data: payload,
      }),
      invalidatesTags: [{ type: "Orders", id: "LIST" }, { type: "Cart", id: "CURRENT" }],
    }),
    checkoutGuestOrder: builder.mutation<ApiResponse<CheckoutRecord>, GuestCheckoutPayload>({
      query: (payload) => ({
        url: "/guest-checkout",
        method: "post",
        data: payload,
      }),
    }),
    getProfile: builder.query<UserWithProfile, void>({
      query: () => ({
        url: "/single-profile",
      }),
      transformResponse: (response: ApiResponse<UserWithProfile>) => response.data,
      providesTags: [{ type: "Profile", id: "CURRENT" }],
    }),
    updateProfile: builder.mutation<ApiResponse<Profile>, { profileId: string; payload: ProfilePayload }>({
      query: ({ profileId, payload }) => ({
        url: `/edit/pro/${profileId}`,
        method: "put",
        data: payload,
      }),
      invalidatesTags: [{ type: "Profile", id: "CURRENT" }],
    }),
    updateProfileImage: builder.mutation<ApiResponse<Profile>, { profileId: string; file: File }>({
      query: ({ profileId, file }) => {
        const formData = new FormData();
        formData.append("avatar", file);

        return {
          url: `/edit/pro-Img/${profileId}`,
          method: "put",
          data: formData,
          headers: {
            "Content-Type": "multipart/form-data",
          },
        };
      },
      invalidatesTags: [{ type: "Profile", id: "CURRENT" }],
    }),
    getAllUsers: builder.query<User[], void>({
      query: () => ({
        url: "/all-users",
      }),
      transformResponse: (response: ApiResponse<User[]>) => response.data,
      providesTags: [{ type: "Users", id: "LIST" }],
    }),
    getCart: builder.query<CartRecord, void>({
      query: () => ({
        url: "/cart-items",
      }),
      transformResponse: (response: ApiResponse<CartRecord>) => response.data,
      providesTags: [{ type: "Cart", id: "CURRENT" }],
    }),
    addCartItem: builder.mutation<ApiResponse<CartRecord>, { productId: string; capacity?: string }>({
      query: ({ productId, capacity }) => ({
        url: `/cart-items/${productId}`,
        method: "post",
        data: {
          capacity,
        },
      }),
      invalidatesTags: [{ type: "Cart", id: "CURRENT" }],
    }),
    decrementCartItem: builder.mutation<ApiResponse<CartRecord>, { productId: string; capacity?: string }>({
      query: ({ productId, capacity }) => ({
        url: `/cart-items/${productId}`,
        method: "delete",
        params: {
          capacity,
        },
      }),
      invalidatesTags: [{ type: "Cart", id: "CURRENT" }],
    }),
    removeCartItemCompletely: builder.mutation<ApiResponse<CartRecord>, { productId: string; capacity?: string }>({
      query: ({ productId, capacity }) => ({
        url: "/remove-item",
        method: "delete",
        params: {
          productId,
          capacity,
          removeAll: true,
        },
      }),
      invalidatesTags: [{ type: "Cart", id: "CURRENT" }],
    }),
  }),
});

export const {
  useAddCartItemMutation,
  useCheckoutGuestOrderMutation,
  useCheckoutOrderMutation,
  useCreateCategoryMutation,
  useCreateProductMutation,
  useDecrementCartItemMutation,
  useEvaluateSwapQuery,
  useDeleteCategoryMutation,
  useGetAllUsersQuery,
  useGetCartQuery,
  useGetCategoriesQuery,
  useGetOrdersQuery,
  useGetAssistantTimingSummaryQuery,
  useGetProductByIdQuery,
  useGetProductsQuery,
  useGetProfileQuery,
  useGetSwapMetadataQuery,
  useRemoveCartItemCompletelyMutation,
  useSendAssistantMessageMutation,
  useUpdateProductStorageOptionsMutation,
  useUpdateProfileImageMutation,
  useUpdateProfileMutation,
} = shopApi;
