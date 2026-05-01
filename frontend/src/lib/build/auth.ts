"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BuildAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type BuildAuthState = {
  token: string | null;
  user: BuildAuthUser | null;
  hydrated: boolean;
  setSession: (token: string, user: BuildAuthUser) => void;
  setUser: (user: BuildAuthUser) => void;
  logout: () => void;
};

export const useBuildAuth = create<BuildAuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      setSession: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: "aevion-build-auth",
      // Mark hydrated so SSR-mismatch effects can wait for the localStorage read.
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

export function getAuthToken(): string | null {
  return useBuildAuth.getState().token;
}
