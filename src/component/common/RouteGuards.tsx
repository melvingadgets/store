import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux/store";
import { isTokenExpired } from "../../utils/authToken";
import { can, type Permission } from "../../lib/access";

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

/**
 * A screen that needs a specific permission, not merely a signed-in person.
 *
 * `/admin` used to sit under `RequireAuth` alone, so any customer who typed the address got
 * the admin shell and a screen of failing requests. The API refused every one of them, so
 * nothing leaked — but the page looked broken rather than forbidden. This asks the same
 * question the API asks, so the answer is the same.
 */
export const RequirePermission: React.FC<{ perm: Permission }> = ({ perm }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  if (!can(user, perm)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
};
