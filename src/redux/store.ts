import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query"
import userReducer from "../features/user/userSlice"
import cartReducer from "../features/cart/cartSlice"
import authReducer from "../features/auth/authSlice"
import { isFrontEndFrozen } from "../lib/frontEndFreeze"
import { shopApi } from "./shopApi"
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist'
import storage from 'redux-persist/lib/storage'

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["cart", shopApi.reducerPath],
}

const rootReducer = combineReducers({
  user: userReducer,
  auth: authReducer,
  cart: cartReducer,
  [shopApi.reducerPath]: shopApi.reducer,
})

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(shopApi.middleware),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

setupListeners(store.dispatch, (dispatch, actions) => {
  const handleFocus = () => {
    if (!isFrontEndFrozen()) {
      dispatch(actions.onFocus())
    }
  }

  const handleFocusLost = () => {
    dispatch(actions.onFocusLost())
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      handleFocus()
      return
    }

    handleFocusLost()
  }

  const handleOnline = () => {
    if (!isFrontEndFrozen()) {
      dispatch(actions.onOnline())
    }
  }

  const handleOffline = () => {
    dispatch(actions.onOffline())
  }

  window.addEventListener("visibilitychange", handleVisibilityChange, false)
  window.addEventListener("focus", handleFocus, false)
  window.addEventListener("blur", handleFocusLost, false)
  window.addEventListener("online", handleOnline, false)
  window.addEventListener("offline", handleOffline, false)

  return () => {
    window.removeEventListener("visibilitychange", handleVisibilityChange)
    window.removeEventListener("focus", handleFocus)
    window.removeEventListener("blur", handleFocusLost)
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
})
