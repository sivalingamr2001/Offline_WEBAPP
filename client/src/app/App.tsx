import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "../auth/LoginPage";
import { useAuthStore } from "../auth/authStore";
import { wipeLocalDatabase } from "../db/database";
import { startConnectivityMonitoring } from "../sync/connectivity";
import PortalShell from "../portal/PortalShell";

export default function App() {
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    return startConnectivityMonitoring();
  }, [accessToken]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={accessToken ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route
          path="/*"
          element={accessToken ? <PortalShell /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

/** Call from a logout button anywhere in the shell. */
export async function logout(apiFetch: (path: string, init?: RequestInit) => Promise<Response>) {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } catch {
    // Ignore server failure during logout, proceed with local session cleanup
  }
  await wipeLocalDatabase();
  useAuthStore.getState().clearSession();
}
