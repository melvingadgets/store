import React, { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import type { AppDispatch, RootState } from "../../redux/store";
import { getTokenExpiryDelay, isTokenExpired } from "../../utils/authToken";
import { clearClientSessionState } from "../../utils/sessionCleanup";
import { setApiClientUnauthorizedHandler } from "../../utils/axios";
import { sessionUpdated } from "../../features/auth/authSlice";
import { sendUserSessionPresence } from "../../utils/userSessionTelemetry";

const AuthSessionManager: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const token = useSelector((state: RootState) => state.auth.token);
  const session = useSelector((state: RootState) => state.auth.session);
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

  useEffect(() => {
    if (!isAuthenticated || !token || !session?.sessionId) {
      return;
    }

    let active = true;

    const pushPresence = async (
      event: string,
      status: "online" | "idle" | "offline" = "online",
      keepalive = false,
    ) => {
      const updatedSession = await sendUserSessionPresence({
        token,
        sessionId: session.sessionId,
        event,
        status,
        keepalive,
      });

      if (updatedSession && active) {
        dispatch(sessionUpdated(updatedSession));
      }
    };

    void pushPresence(
      "session_active",
      document.visibilityState === "hidden" ? "idle" : "online",
    );

    const intervalId = window.setInterval(() => {
      void pushPresence(
        "heartbeat",
        document.visibilityState === "hidden" ? "idle" : "online",
      );
    }, 45_000);

    const handleVisibilityChange = () => {
      void pushPresence(
        "visibilitychange",
        document.visibilityState === "hidden" ? "idle" : "online",
      );
    };

    const handleFocus = () => {
      void pushPresence("focus", "online");
    };

    const handleOnline = () => {
      void pushPresence("online", "online");
    };

    const handlePageHide = () => {
      void pushPresence("pagehide", "offline", true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handlePageHide);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
    };
  }, [dispatch, isAuthenticated, session?.sessionId, token]);

  return null;
};

export default AuthSessionManager;
