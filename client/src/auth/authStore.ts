import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  displayName: string | null;
  roles: string[];
  isRefreshing: boolean;
  setSession: (token: string, displayName: string, roles: string[]) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  displayName: null,
  roles: [],
  isRefreshing: false,
  setSession: (accessToken, displayName, roles) => set({ accessToken, displayName, roles }),
  clearSession: () => set({ accessToken: null, displayName: null, roles: [] })
}));
