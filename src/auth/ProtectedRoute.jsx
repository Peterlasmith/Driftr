import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import AppShell from "../components/AppShell";

export default function ProtectedRoute() {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

