/**
 * QBuild: токен берётся из своей сессии, а если её нет — платформенный.
 *
 * До 12.08.2026 у модуля было ТРИ способа прочитать токен и ни одного
 * рабочего: стор `useBuildAuth` не заполняет никто (`setSession` не вызывается
 * ни из одного файла, страницы входа у модуля нет), а страницы читали
 * литералы "build_token" и "build_auth_token" — имена, под которыми не пишет
 * никто. Каждый защищённый вызов уходил без Authorization, бэкенд отвечал 401,
 * а страница показывала пустой список, будто данных просто нет.
 *
 * Запасной путь законен по построению: `requireBuildAuth` на бэкенде проверяет
 * платформенный JWT тем же `verifyBearerOptional` и тем же секретом.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAuthToken, useBuildAuth } from "../auth";
import { setAuthToken, clearAuthToken } from "@/lib/auth";

beforeEach(() => {
  useBuildAuth.setState({ token: null, user: null });
  clearAuthToken();
});

afterEach(() => {
  useBuildAuth.setState({ token: null, user: null });
  clearAuthToken();
});

describe("QBuild getAuthToken", () => {
  it("без всякой сессии отдаёт null", () => {
    expect(getAuthToken()).toBeNull();
  });

  it("после входа в AEVION отдаёт платформенный токен", () => {
    setAuthToken("platform-jwt");
    expect(getAuthToken()).toBe("platform-jwt");
  });

  it("своя сессия QBuild важнее платформенной", () => {
    setAuthToken("platform-jwt");
    useBuildAuth.setState({ token: "build-own-jwt" });
    expect(getAuthToken()).toBe("build-own-jwt");
  });

  it("мёртвый литерал build_token сессией не считается", () => {
    localStorage.setItem("build_token", "stale-garbage");
    expect(getAuthToken()).toBeNull();
  });
});
