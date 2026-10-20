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
  /** Токен взят из входа AEVION, а не из формы QBuild (см. принятьПлатформеннуюСессию). */
  fromPlatform: boolean;
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
      fromPlatform: false,
      setSession: (token, user) => set({ token, user, fromPlatform: false }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null, fromPlatform: false }),
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

/**
 * Вход AEVION — это вход и в QBuild.
 *
 * 🔴 Замер прода 20.10.2026: человек, вошедший на aevion.app, открывал «Новый проект»
 * и получал вторую форму входа QBuild, а соискатель на странице вакансии — «Sign in
 * to apply» без всякой формы рядом: откликнуться было нельзя вовсе. Запросы
 * (getAuthToken выше) платформенный токен уже брали, а экраны смотрят на стор,
 * который заполняла только форма QBuild.
 *
 * Своя сессия QBuild остаётся главной. Принятая из платформы помечена fromPlatform и
 * следует за платформой: вышел из AEVION — пропала и здесь; токен протух (401) — тоже.
 */
export async function принятьПлатформеннуюСессию(
  загрузитьМеня: () => Promise<{ user: BuildAuthUser }>,
): Promise<void> {
  const s = useBuildAuth.getState();
  if (s.token && !s.fromPlatform) return;
  const платформа = getPlatformAuthToken();
  if (!платформа) {
    if (s.fromPlatform) useBuildAuth.setState({ token: null, user: null, fromPlatform: false });
    return;
  }
  if (s.fromPlatform && s.token === платформа && s.user) return;
  useBuildAuth.setState({ token: платформа, user: null, fromPlatform: true });
  try {
    const { user } = await загрузитьМеня();
    if (useBuildAuth.getState().token === платформа) useBuildAuth.setState({ user });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403) {
      useBuildAuth.setState({ token: null, user: null, fromPlatform: false });
    } else {
      // Токен оставляем: отклик и проект пройдут, не хватит только имени в шапке.
      console.warn("[qbuild] профиль для платформенной сессии не загрузился", e);
    }
  }
}
