import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./auth/ProtectedRoute";
import Dashboard from "./Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Resumes from "./pages/Resumes";
import Archive from "./pages/Archive";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/resumes" element={<Resumes />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/archive" element={<Archive />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
