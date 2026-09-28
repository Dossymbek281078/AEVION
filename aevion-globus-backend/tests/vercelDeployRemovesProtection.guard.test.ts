// Приложение, выкаченное на Vercel, должно открываться ПОСЕТИТЕЛЮ, а не нам.
//
// 28.09.2026, замер на живом проде: Next-проект выкатился, ответ ok:true с адресом,
// а адрес 24 раза подряд отдавал 302 на vercel.com/sso-api — то есть приложение закрыто
// входом в наш аккаунт. Загрузка удалась, служить не служит, снаружи выглядит успехом
// (конвенция §10 бэкенда: deploy = uploaded + serves).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const маршрут = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");
const кусок = (() => {
  const i = маршрут.indexOf("v13/deployments");
  return маршрут.slice(i, i + 4000);
})();

describe("выкатка на Vercel снимает защиту с проекта пользователя", () => {
  it("после создания выкатки идёт PATCH проекта со снятием обеих защит", () => {
    expect(кусок).toContain("api.vercel.com/v9/projects/");
    expect(кусок).toContain('method: "PATCH"');
    expect(кусок).toContain("ssoProtection: null");
    expect(кусок).toContain("passwordProtection: null");
  });

  it("снятие идёт ПОСЛЕ выкатки: раньше проекта ещё нет", () => {
    const iВыкатка = кусок.indexOf("v13/deployments");
    const iСнятие = кусок.indexOf("v9/projects/");
    expect(iВыкатка).toBeGreaterThanOrEqual(0);
    expect(iСнятие).toBeGreaterThan(iВыкатка);
  });

  it("неудача не молчит: поле в ответе и запись в Sentry", () => {
    expect(кусок).toContain("protectionRemoved");
    expect(кусок).toContain("protectionError");
    expect(кусок).toContain("vercel protection not removed");
  });

  it("правится ТОЛЬКО тот проект, который мы сами создали", () => {
    // deploySlug — имя, под которым выкатывали; чужие проекты аккаунта не трогаем.
    expect(кусок).toContain("encodeURIComponent(deploySlug)");
  });
});
