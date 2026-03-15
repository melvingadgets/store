# Backend to Frontend Coverage

This matrix tracks the backend route surface against the frontend implementation.

## Canonical API routes

| Method | Route | Frontend status | Frontend surface |
| --- | --- | --- | --- |
| `POST` | `/api/v1/register` | wired | `src/pages/Register.tsx` |
| `POST` | `/api/v1/login` | wired | `src/pages/Login.tsx` |
| `GET` | `/api/v1/logout-user` | wired | `src/pages/Account.tsx` |
| `GET` | `/api/v1/single-profile/:id` | wired | `src/pages/Account.tsx` |
| `PUT` | `/api/v1/edit/pro/:proId` | wired | `src/pages/Account.tsx` |
| `PUT` | `/api/v1/edit/pro-Img/:proId` | wired | `src/pages/Account.tsx` |
| `GET` | `/api/v1/all-users` | wired | `src/pages/Admin.tsx` |
| `GET` | `/api/v1/categories` | wired | `src/component/common/Category.tsx`, `src/pages/Product.tsx`, `src/pages/Admin.tsx` |
| `POST` | `/api/v1/create-category/:userId` | wired | `src/pages/Admin.tsx` |
| `GET` | `/api/v1/categories/:id` | wired | `src/pages/Product.tsx` |
| `DELETE` | `/api/v1/categories/:id` | wired | `src/pages/Admin.tsx` |
| `GET` | `/api/v1/products` | wired | `src/component/common/FeaturedProducts.tsx`, `src/pages/Product.tsx` |
| `GET` | `/api/v1/products/:id` | wired | `src/pages/ProductDetails.tsx` |
| `POST` | `/api/v1/create-product/:userId/:catId` | wired | `src/pages/Admin.tsx` |
| `GET` | `/api/v1/cart-items/:userId` | wired | `src/layout/WebLayout.tsx`, `src/pages/Cart.tsx`, `src/pages/Checkout.tsx`, `src/pages/ProductDetails.tsx` |
| `POST` | `/api/v1/cart-items/:userId/:prodId` | wired | `src/component/common/ProductCard.tsx`, `src/pages/ProductDetails.tsx`, `src/pages/Cart.tsx` |
| `DELETE` | `/api/v1/cart-items/:userId/:prodId` | wired | `src/pages/ProductDetails.tsx`, `src/pages/Cart.tsx` |
| `DELETE` | `/api/v1/remove-item/:userId` | wired | `src/pages/Cart.tsx` |
| `POST` | `/api/v1/order-checkout/:userId` | wired | `src/pages/Checkout.tsx` |
| `GET` | `/api/v1/orders/:userId` | wired | `src/pages/History.tsx` |

## Backend-rendered and operational routes

| Method | Route | Status | Notes |
| --- | --- | --- | --- |
| `GET` | `/api` | backend-only | operational readiness endpoint; covered by backend tests |
| `GET` | `/health` | backend-only | operational health endpoint; covered by backend tests |
| `GET` | `/page/data/:id` | backend-rendered | verification view rendered by `Views/verifyAccount.ejs` |
| `GET` | `/api/v1/verify-account/:id` | backend-rendered | email verification flow resolves on the backend |

## Compatibility aliases

These remain in the backend for compatibility, but the frontend targets the canonical routes above.

| Method | Route | Alias for |
| --- | --- | --- |
| `POST` | `/api/v1/create-user` | `/api/v1/register` |
| `POST` | `/api/v1/login-user` | `/api/v1/login` |
| `GET` | `/api/v1/all-categories` | `/api/v1/categories` |
| `GET` | `/api/v1/singel-cate/:id` | `/api/v1/categories/:id` |
| `DELETE` | `/api/v1/delete-category/:id` | `/api/v1/categories/:id` |
| `GET` | `/api/v1/singleProduct/:id` | `/api/v1/products/:id` |
| `GET` | `/api/v1/all-Products` | `/api/v1/products` |
