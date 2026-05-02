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

// zustand v5 + persist middleware doesn't always propagate the State generic
// into selector callbacks (TS infers `any` for the selector arg). Wrapping the
// raw store as a generic selector function gives every call site `s: BuildAuthState`
// for free without sprinkling type annotations across 12 files.
const useBuildAuthRaw = create<BuildAuthState>()(
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

type BuildAuthHook = {
  <T>(selector: (s: BuildAuthState) => T): T;
  getState: () => BuildAuthState;
  setState: (typeof useBuildAuthRaw)["setState"];
  subscribe: (typeof useBuildAuthRaw)["subscribe"];
};

export const useBuildAuth: BuildAuthHook = useBuildAuthRaw as unknown as BuildAuthHook;

export function getAuthToken(): string | null {
  return useBuildAuth.getState().token;
}
