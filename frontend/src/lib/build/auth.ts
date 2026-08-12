"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAuthToken as getPlatformAuthToken } from "@/lib/auth";

export type BuildAuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerifiedAt?: string | null;
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

/**
 * Токен для запросов QBuild. Единственный способ его прочитать в модуле —
 * читать литералы ключей по страницам запрещено, на этом всё и сломалось.
 *
 * Своя сессия QBuild (`useBuildAuth`) остаётся первой: под неё есть стор,
 * роль и пользователь. Но на 12.08.2026 её не заполняет НИКТО — `setSession`
 * не вызывается ни из одного файла, страницы входа у модуля нет. То есть
 * `token` здесь был null всегда, и каждый защищённый вызов QBuild уходил без
 * заголовка Authorization. Отказа при этом не было: бэкенд отвечал 401, а
 * страница показывала пустой список, будто данных просто нет.
 *
 * Запасной вариант — платформенный JWT, и это не «на всякий случай»:
 * `requireBuildAuth` на бэкенде проверяет его тем же `verifyBearerOptional`
 * и тем же секретом, что и остальная платформа. То есть токен со входа
 * AEVION здесь валиден по построению.
 */
export function getAuthToken(): string | null {
  return useBuildAuth.getState().token ?? getPlatformAuthToken();
}
