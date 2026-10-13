// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { КЛИЕНТ } from "../klientSkript";
import { PZ_SLOVA } from "../pzSlova";

/*
 * 🔴 Сторож «доска по окну пользователя + масштаб −/+» (слово основателя 13.10.2026: «доска очень
 * маленькая и не увеличивается… как lichess/chess.com»; замер до: 1463×724 — 434 px = 60 % vh,
 * 1920×1080 — 480 px = 44 % vh, кнопок масштаба нет).
 *
 * Текстовая часть держит ФОРМУЛУ стороны (от окна, без фиксированного потолка 480 px) и наличие
 * кнопок; поведенческая исполняет тот же инлайн-скрипт, что уходит в HTML, и проверяет, что
 * нажатие «−/+» меняет --zm, подпись и запись в localStorage. Живой размер в пикселях мерит
 * прибор 01-CyberChess/2026-10-14-ДОСКА/priemka-doski.mjs (7 пар окон) — jsdom не считает CSS.
 */
const ROUTE = readFileSync(join(process.cwd(), "src/app/cyberchess/p/[id]/route.ts"), "utf8");

describe("сторона доски считается от окна пользователя", () => {
  it("формула --side: телефон от ширины и высоты, desktop — от высоты и панели; потолка 480px нет", () => {
    expect(ROUTE).toContain("--side:min(92vw,100dvh - 150px)");
    expect(ROUTE).toContain("--side:min(100dvh - 120px,100vw - 360px)"); // ≥1024
    expect(ROUTE).toContain("--side:min(100dvh - 120px,100vw - 440px)"); // ≥1280
    expect(ROUTE).toContain("width:calc(var(--zm)*var(--side))");
    expect(ROUTE).not.toMatch(/\.wd\{width:min\(92vw,60vh,480px\)\}/);
  });
  it("фигуры масштабируются с клеткой, а не фиксированным clamp", () => {
    expect(ROUTE).toContain("font-size:calc(var(--zm)*var(--side)/8*.78)");
    expect(ROUTE).not.toContain("font-size:clamp(22px,7.5vmin,46px)");
  });
  it("кнопки масштаба есть в HTML с подписями на трёх языках", () => {
    expect(ROUTE).toContain('data-zm="-"');
    expect(ROUTE).toContain('data-zm="+"');
    expect(ROUTE).toContain("data-zm-v");
    for (const y of ["ru", "en", "kk"] as const) {
      expect(PZ_SLOVA[y]["pz.zoomIn"], y).toBeTruthy();
      expect(PZ_SLOVA[y]["pz.zoomOut"], y).toBeTruthy();
      expect(PZ_SLOVA[y]["pz.zoomLabel"], y).toBeTruthy();
    }
    expect(PZ_SLOVA.en["pz.zoomIn"] + PZ_SLOVA.en["pz.zoomOut"] + PZ_SLOVA.en["pz.zoomLabel"]).not.toMatch(/[А-Яа-яЁё]/);
  });
});

function собратьСтраницу() {
  const cfg = { id: "li_test", fen: "8/5kp1/7p/3PRK2/r5PP/8/8/8 b - - 0 52", i: 0, storona: "b", movable: ["g7"], texts: { wrong: "x", yourMove: "y", hint: "h", solved: "s" }, ev: { channel: "youtube", post: "chess-1", path: "/cyberchess/p/li_test?c=yt-chess-1", rating: 1000, theme: "t", fen: "f" } };
  document.body.innerHTML = `<main data-cc-light-puzzle="li_test"><div data-cc-board="1" data-cc-puzzle="li_test"><button type="button" data-sq="g7" class="l"></button></div><div data-cc-status class="wd s"></div><div class="wd zm" data-cc-zoom><button type="button" data-zm="-">−</button><span data-zm-v>100%</span><button type="button" data-zm="+">+</button></div><div class="wd r" data-cc-resheno></div></main><script id="cc-cfg" type="application/json">${JSON.stringify(cfg)}</script>`;
}

const отправлено: Array<{ type: string; meta?: Record<string, unknown> }> = [];
beforeEach(() => {
  отправлено.length = 0;
  localStorage.clear();
  собратьСтраницу();
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: (_u: string, d: Blob) => { d.text().then((t) => отправлено.push(JSON.parse(t))); return true; } });
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({}) }) as unknown as Response));
  new Function(КЛИЕНТ)();
});

const тик = () => new Promise((r) => setTimeout(r, 20));
const zm = () => document.documentElement.style.getPropertyValue("--zm");
const подпись = () => document.querySelector("[data-zm-v]")!.textContent;
const нажать = (k: "-" | "+") => (document.querySelector(`[data-zm="${k}"]`) as HTMLButtonElement).click();

describe("кнопки −/+ меняют масштаб доски и помнят его", () => {
  it("старт 100 %, «−» → 90 %, ещё «−» → 80 %, «+» → 90 %; значение в localStorage; событие board_zoom", async () => {
    expect(zm()).toBe("1");
    expect(подпись()).toBe("100%");
    нажать("-");
    expect(zm()).toBe("0.9");
    expect(подпись()).toBe("90%");
    нажать("-");
    expect(zm()).toBe("0.8");
    нажать("+");
    expect(zm()).toBe("0.9");
    expect(localStorage.getItem("cc_light_zoom")).toBe("0.9");
    await тик();
    const z = отправлено.filter((e) => e.type === "feature_use" && e.meta?.feature === "board_zoom");
    expect(z.length).toBe(3);
    expect(z[0].meta?.channel).toBe("youtube");
    expect(z[0].meta?.surface).toBe("light");
  });
  it("пределы: ниже 60 % и выше 100 % не уходит", () => {
    for (let i = 0; i < 8; i++) нажать("-");
    expect(zm()).toBe("0.6");
    for (let i = 0; i < 8; i++) нажать("+");
    expect(zm()).toBe("1");
  });
  it("сохранённый масштаб применяется при загрузке", () => {
    localStorage.setItem("cc_light_zoom", "0.7");
    собратьСтраницу();
    new Function(КЛИЕНТ)();
    expect(zm()).toBe("0.7");
    expect(подпись()).toBe("70%");
  });
  it("мусор в localStorage игнорируется → 100 %", () => {
    localStorage.setItem("cc_light_zoom", "5");
    собратьСтраницу();
    new Function(КЛИЕНТ)();
    expect(zm()).toBe("1");
  });
});
