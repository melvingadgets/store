import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux/store";
import { isTokenExpired } from "../../utils/authToken";

const hasValidSession = (state: RootState) =>
  Boolean(state.auth.isAuthenticated && state.auth.user?._id && state.auth.token && !isTokenExpired(state.auth.token));

export const RequireAuth: React.FC = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(hasValidSession);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export const RequireGuest: React.FC = () => {
  const isAuthenticated = useSelector(hasValidSession);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
