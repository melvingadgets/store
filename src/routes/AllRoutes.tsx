/* eslint-disable react-refresh/only-export-components */
import React, { Suspense, lazy } from "react"
import { RouteObject, createBrowserRouter } from "react-router-dom"
import { RequireAuth, RequireGuest } from "../component/common/RouteGuards"
import AppShell from "../layout/AppShell"
import WebLayout from "../layout/WebLayout"

//lazyloading pages
const Home = lazy(() => import("../pages/Home"))
const Cart = lazy(() => import("../pages/Cart"))
const Login = lazy(() => import("../pages/Login"))
const Register = lazy(() => import("../pages/Register"))
const Product = lazy(() => import("../pages/Product"))
const ProductDetails = lazy(() => import("../pages/ProductDetails"))
const EasyBuy = lazy(() => import("../pages/EasyBuy"))
const History = lazy(() => import("../pages/History"))
const Account = lazy(() => import("../pages/Account"))
const Admin = lazy(() => import("../pages/Admin"))
const SwapDevice = lazy(() => import("../pages/SwapDevice"))
// const Fakeproduct = lazy(() => import("../loginFake/Productss"))
const Checkout = lazy(() => import("../pages/Checkout"))
const OrderConfirmation = lazy(() => import("../pages/OrderConfirmation"))

//higher order component to wrap lazy component in suspense
const withSuspense = (Component: React.ComponentType)=>(
    <Suspense fallback={null}>
        <Component />
    </Suspense>
)

//routes configuration
const routesConfig: RouteObject[] = [
    {
      element: <AppShell />,
      children: [
        {
            path: "/",
            element: <WebLayout/>,
            children: [
                {index: true, element: withSuspense(Home)},
                {path: "/cart", element: withSuspense(Cart)},
                {path: "/product", element: withSuspense(Product)},
                {
                  element: <RequireAuth />,
                  children: [
                    {path: "/account", element: withSuspense(Account)},
                    {path: "/settings", element: withSuspense(Account)},
                    {path: "/admin", element: withSuspense(Admin)},
                    {path: "/menu", element: withSuspense(Admin)},
                    {path: "/history", element: withSuspense(History)},
                  ]
                },

            ]
        },
        {
          element: <RequireGuest />,
          children: [
            { path: "login", element: withSuspense(Login) },
            { path: "register", element: withSuspense(Register) },
          ]
        },
      { path: "orderconfirm", element: withSuspense(OrderConfirmation) },
      { path: "checkout", element: withSuspense(Checkout) },
      { path: "/product/:id/easybuy", element: withSuspense(EasyBuy) },
      { path: "/product/:id/swap", element: withSuspense(SwapDevice) },
      {path: "/product/:id", element: withSuspense(ProductDetails)},
      ]
    },
//   { path: "fakeproduct", element: withSuspense(Fakeproduct) },
//   { path: "/product/mycart", element: withSuspense(MyCart) },
]

//export router
export const router = createBrowserRouter(routesConfig)
