import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppDispatch, RootState } from "../../redux/store";
import { getTokenExpiryDelay, isTokenExpired } from "../../utils/authToken";
import { clearClientSessionState } from "../../utils/sessionCleanup";
import { setApiClientUnauthorizedHandler } from "../../utils/axios";

const AuthSessionManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSelector((state: RootState) => state.auth.token);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  useEffect(() => {
    let cancelled = false;

    const forceLogout = async () => {
      await clearClientSessionState(dispatch);

      if (!cancelled && location.pathname !== "/login") {
        navigate("/login", { replace: true });
      }
    };

    setApiClientUnauthorizedHandler(() => {
      void forceLogout();
    });

    return () => {
      cancelled = true;
      setApiClientUnauthorizedHandler(null);
    };
  }, [dispatch, location.pathname, navigate]);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      return;
    }

    if (isTokenExpired(token)) {
      void clearClientSessionState(dispatch).then(() => {
        navigate("/login", { replace: true });
      });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void clearClientSessionState(dispatch).then(() => {
        navigate("/login", { replace: true });
      });
    }, getTokenExpiryDelay(token));

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [dispatch, isAuthenticated, navigate, token]);

  return null;
};

export default AuthSessionManager;
