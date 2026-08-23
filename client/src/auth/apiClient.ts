import { useAuthStore } from "./authStore";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://localhost:5001";

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    useAuthStore.setState({ isRefreshing: true });
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        credentials: "include" // sends the mock refresh cookie
      });
      if (!res.ok) {
        useAuthStore.getState().clearSession();
        return false;
      }
      const data = await res.json();
      useAuthStore.getState().setSession(data.accessToken, data.displayName, data.roles);
      return true;
    } catch {
      return false;
    } finally {
      useAuthStore.setState({ isRefreshing: false });
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Authenticated fetch. Retries exactly once after a silent refresh on 401.
 * Callers (including the sync engine) should treat a `false` return from
 * this helper's caller-visible failure as "pause, don't fail loudly" when
 * offline — see sync/syncEngine.ts.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = useAuthStore.getState().accessToken;

  const doFetch = (bearer: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init.headers ?? {}),
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        "Content-Type": "application/json"
      }
    });

  let response = await doFetch(token);

  if (response.status === 401 && navigator.onLine) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch(useAuthStore.getState().accessToken);
    }
  }

  return response;
}
