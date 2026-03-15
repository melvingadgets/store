import { logoutSuccess } from "../features/auth/authSlice";
import { resetCartState } from "../features/cart/cartSlice";
import { logout } from "../features/user/userSlice";
import { shopApi } from "../redux/shopApi";
import type { AppDispatch } from "../redux/store";

let activeLogoutPromise: Promise<void> | null = null;

export const clearBrowserSessionArtifacts = async () => {
  window.localStorage.clear();
  window.sessionStorage.clear();

  if (!("caches" in window)) {
    return;
  }

  const cacheKeys = await window.caches.keys();
  await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
};

export const clearClientSessionState = async (dispatch: AppDispatch) => {
  if (activeLogoutPromise) {
    return activeLogoutPromise;
  }

  activeLogoutPromise = (async () => {
    try {
      dispatch(logoutSuccess());
      dispatch(logout());
      dispatch(resetCartState());
      dispatch(shopApi.util.resetApiState());
      await clearBrowserSessionArtifacts();
    } finally {
      activeLogoutPromise = null;
    }
  })();

  return activeLogoutPromise;
};
