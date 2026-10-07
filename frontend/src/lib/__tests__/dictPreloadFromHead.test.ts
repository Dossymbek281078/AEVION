/**
 * Словарь, начатый инлайн-скриптом макета, подхватывается модулем переводов,
 * а сам маршрут /i18n/<lang> отдаёт тот же словарь, что и код.
 *
 * Зачем. Замер 15.09.2026: на Slow 4G русский появлялся через 9 с после
 * текста, потому что словарь качался ПОСЛЕ основного JS. Теперь его начинает
 * качать HTML; если модуль этот ответ не подхватит, будет два скачивания и
 * никакого выигрыша — а снаружи это неотличимо от успеха.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LANG_KEY_COUNT } from "../i18n-data";

const HERE = dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  delete window.__aevionDict;
  vi.resetModules();
});

describe("предзагрузка словаря из <head>", () => {
  it("loadDict берёт ответ инлайн-скрипта, а не качает чанк", async () => {
    const fake = { "probe.key": "из предзагрузки" };
    window.__aevionDict = { lang: "ru", promise: Promise.resolve(fake) };
    vi.resetModules();
    const mod = await import("../i18n");
    const dict = await mod.loadDict("ru");
    expect(dict).toBe(fake);
    expect(mod.peekDict("ru")).toBe(fake);
  });

  it("контроль: предзагрузка ДРУГОГО языка не подменяет словарь", async () => {
    window.__aevionDict = { lang: "kk", promise: Promise.resolve({ "probe.key": "kk" }) };
    vi.resetModules();
    const mod = await import("../i18n");
    const dict = await mod.loadDict("ru");
    expect(Object.keys(dict).length).toBe(LANG_KEY_COUNT.ru);
  });

  it("контроль: пустой ответ предзагрузки — обычный путь, словарь целый", async () => {
    window.__aevionDict = { lang: "ru", promise: Promise.resolve(null) };
    vi.resetModules();
    const mod = await import("../i18n");
    const dict = await mod.loadDict("ru");
    expect(Object.keys(dict).length).toBe(LANG_KEY_COUNT.ru);
  });

  it("маршрут /i18n/ru отдаёт словарь целиком и с вечным кэшем; неизвестный язык — 404", async () => {
    const route = await import("../../app/i18n/[lang]/route");
    const res = await route.GET(new Request("http://x/i18n/ru"), { params: Promise.resolve({ lang: "ru" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("immutable");
    const body = (await res.json()) as Record<string, string>;
    expect(Object.keys(body).length).toBe(LANG_KEY_COUNT.ru);
    const bad = await route.GET(new Request("http://x/i18n/xx"), { params: Promise.resolve({ lang: "xx" }) });
    expect(bad.status).toBe(404);
    expect(route.generateStaticParams().map((p) => p.lang)).not.toContain("en");
  });

  it("макет: скрипт предзагрузки стоит в HTML и версионирован коммитом сборки", () => {
    const layout = readFileSync(join(HERE, "..", "..", "app", "layout.tsx"), "utf8");
    const скрипт = readFileSync(join(HERE, "..", "dictPreloadScript.ts"), "utf8");
    // Скрипт переехал в свой модуль 07.10.2026, чтобы его можно было исполнять
    // в стороже; макет обязан по-прежнему ставить его в HTML и версионировать.
    expect(layout).toContain("__html: скриптПредзагрузкиСловаря(BUILD_STAMP.commit)");
    expect(скрипт).toContain("fetch('/i18n/'+L+'?v=");
    expect(скрипт).toContain("отпечатокСборки");
    // 🔴 ПОРЯДОК ИСПРАВЛЕН 07.10.2026: КУКА РАНЬШЕ ХРАНИЛИЩА.
    //
    // Здесь закреплялось обратное — сперва localStorage, потом кука, — и рядом
    // стояла подпись «порядок источников тот же, что у провайдера». Подпись
    // была неверна: провайдер (src/lib/i18n.tsx) читает куку ПЕРВОЙ и прямо
    // пишет «кука переживает чистку storage и приходит с других вкладок —
    // выбор старше догадки». То есть сторож закреплял дефект и называл его
    // согласованностью.
    //
    // Цена дефекта, замерена браузером на проде 07.10: заход на /en/... даёт
    // 308 и ставит куку en на сервере (middleware.ts:125), хранилище остаётся
    // ru — и главная выходила русской при английской куке. Проверено прямо на
    // живой странице: прежний порядок выбирал ru, новый выбирает en.
    const iCookie = скрипт.indexOf("document.cookie.split('; ')");
    const iStorage = скрипт.indexOf("localStorage.getItem('aevion_lang_v1')", iCookie);
    const iNav = скрипт.indexOf("navigator.language", iStorage);
    expect(iStorage).toBeGreaterThan(-1);
    expect(iStorage, 'хранилище должно читаться ПОСЛЕ куки').toBeGreaterThan(iCookie);
    expect(iNav, 'язык браузера — последний запасной путь').toBeGreaterThan(iStorage);
  });
});
