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
  const cfg = { id: "li_test", fen: "8/5kp1/7p/3PRK2/r5PP/8/8/8 b - - 0 52", i: 0, storona: "b", movable: ["g7"], texts: { wrong: "x", yourMove: "y", hint: "h", solved: "s", hintShown: "hs", copied: "copied!", shareTitle: "t", solution: "Solution" }, ev: { channel: "youtube", post: "chess-1", path: "/cyberchess/p/li_test?c=yt-chess-1", rating: 1000, theme: "t", fen: "f" } };
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

describe("после решения — следующая ЛЁГКАЯ задача, не монолит", () => {
  it("ссылка data-cc-next строится из sleduyushchayaZadacha (случайная, близкий рейтинг, с метками)", () => {
    expect(ROUTE).toContain('data-cc-next href="${esc(p.sleduyushchaya)}"');
    expect(ROUTE).not.toContain('data-cc-resheno><a href="${esc(p.polnaya)}"');
    expect(ROUTE).toMatch(/shuffle: "1"/);
    expect(ROUTE).toMatch(/minRating: String\(Math\.max\(0, rating - 150\)\)/);
    expect(ROUTE).toContain("find((x) => x && x !== tekId)");
    expect(ROUTE).toContain("return `/cyberchess/p/${encodeURIComponent(next)}${keep.toString()");
  });
});

describe("перетаскивание фигуры (как lichess) и координаты", () => {
  it("координаты: буквы на нижнем ряду, цифры в левом столбце; draw() их не стирает", () => {
    expect(ROUTE).toContain('data-cf="${k.sq[0]}"');
    expect(ROUTE).toContain('<i class="c f">${k.sq[0]}</i>');
    expect(ROUTE).toContain('<i class="c r">${k.sq[1]}</i>');
    expect(КЛИЕНТ).toContain('b.getAttribute("data-cf")');
    expect(ROUTE).toContain("touch-action:none"); // иначе палец прокручивает страницу вместо фигуры
  });
  it("pointerdown на своей фигуре + pointerup над целью = ход (без клика)", async () => {
    собратьСтраницу();
    document.body.insertAdjacentHTML("beforeend", "");
    const g7 = document.querySelector('[data-sq="g7"]') as HTMLButtonElement;
    // цель g6 — добавим клетку
    g7.insertAdjacentHTML("afterend", '<button type="button" data-sq="g6" class="d"></button>');
    const g6 = document.querySelector('[data-sq="g6"]') as HTMLButtonElement;
    (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = () => g6;
    // сервер ходов: цели g7 → g6; ход g7→g6 — верный и решает задачу
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body ?? "{}"));
      const json = b.akt === "targets" ? { targets: ["g6"] } : { vid: "ok", fen: "8/5k2/6pp/3PRK2/r5PP/8/8/8 w - - 0 53", i: 1, reshena: true, otvet: null, movable: [] };
      return { json: async () => json } as Response;
    }));
    new Function(КЛИЕНТ)();
    const board = document.querySelector("[data-cc-board]")!;
    g7.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, clientX: 10, clientY: 10 }));
    await тик(); // цели для g7 пришли (fetch-заглушка)
    board.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, clientX: 50, clientY: 50 }));
    await тик();
    const calls = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")));
    expect(calls.some((b) => b.akt === "targets" && b.from === "g7")).toBe(true);
    expect(calls.some((b) => b.akt === "move" && b.from === "g7" && b.to === "g6")).toBe(true);
    expect(document.querySelector(".ghost")).toBeNull();
  });
  it("pointerup на той же клетке — хода нет (это тап, его ведёт click)", async () => {
    собратьСтраницу();
    const g7 = document.querySelector('[data-sq="g7"]') as HTMLButtonElement;
    (document as unknown as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint = () => g7;
    new Function(КЛИЕНТ)();
    g7.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    await тик();
    g7.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    await тик();
    const calls = (fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } }).mock.calls.map((c) => JSON.parse(String(c[1]?.body ?? "{}")));
    expect(calls.some((b) => b.akt === "move")).toBe(false);
  });
});

function собратьСтраницуСПодсказкой() {
  собратьСтраницу();
  const g7 = document.querySelector('[data-sq="g7"]') as HTMLButtonElement;
  g7.insertAdjacentHTML("afterend", '<button type="button" data-sq="g6" class="d"></button><button type="button" data-sq="g5" class="l"></button>');
  document.querySelector("[data-cc-status]")!.insertAdjacentHTML("afterend", '<div class="wd hb"><button type="button" data-cc-podskazka>Hint</button></div><div class="wd hdr"><small>🔥 <b data-cc-streak>0</b></small></div>');
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body ?? "{}"));
    const json = b.akt === "hint" ? { from: "g7" } : b.akt === "targets" ? { targets: ["g6", "g5"] } : b.to === "g6"
      ? { vid: "ok", fen: "8/5k2/6pp/3PRK2/r5PP/8/8/8 w - - 0 53", i: 1, reshena: true, otvet: null, movable: [] }
      : { vid: "wrong" };
    return { json: async () => json } as Response;
  }));
}
const клик2 = (sq: string) => (document.querySelector(`[data-sq="${sq}"]`) as HTMLButtonElement).click();

describe("подсказка и серия решённых подряд", () => {
  it("кнопка подсказки: сервер отдаёт клетку фигуры, она подсвечена, событие puzzle_hint с surface:light; ход снимает подсветку", async () => {
    собратьСтраницуСПодсказкой();
    new Function(КЛИЕНТ)();
    (document.querySelector("[data-cc-podskazka]") as HTMLButtonElement).click();
    await тик();
    expect(document.querySelector('[data-sq="g7"]')!.classList.contains("h")).toBe(true);
    const h = отправлено.find((e) => e.type === "feature_use" && e.meta?.feature === "puzzle_hint");
    expect(h?.meta?.surface).toBe("light");
    expect(h?.meta?.hints).toBe(1);
    клик2("g7"); await тик(); клик2("g6"); await тик();
    expect(document.querySelector('[data-sq="g7"]')!.classList.contains("h")).toBe(false);
  });
  it("ROUTE: POST akt=hint отдаёт клетку ожидаемого хода, null после решения", () => {
    expect(ROUTE).toContain('if (b.akt === "hint") return Response.json({ from: s.reshena || s.i >= s.sol.length ? null : s.sol[s.i].slice(0, 2) });');
    expect(ROUTE).not.toContain("data-cc-hint"); // прежний сторож: отдельной строки «как ходить» нет
  });
  it("серия: решено → +1 и в localStorage; неверный ход → 0; puzzle_solved несёт streak", async () => {
    localStorage.setItem("cc_light_streak", "4");
    собратьСтраницуСПодсказкой();
    new Function(КЛИЕНТ)();
    expect(document.querySelector("[data-cc-streak]")!.textContent).toBe("4");
    клик2("g7"); await тик(); клик2("g6"); await тик();
    expect(document.querySelector("[data-cc-streak]")!.textContent).toBe("5");
    expect(localStorage.getItem("cc_light_streak")).toBe("5");
    const solved = отправлено.find((e) => e.type === "puzzle_solved");
    expect(solved?.meta?.streak).toBe(5);
    // новая страница, неверный ход
    собратьСтраницуСПодсказкой();
    new Function(КЛИЕНТ)();
    клик2("g7"); await тик(); клик2("g5"); await тик();
    expect(document.querySelector("[data-cc-streak]")!.textContent).toBe("0");
    expect(localStorage.getItem("cc_light_streak")).toBe("0");
  });
  it("слова подсказки и серии есть на трёх языках, en без кириллицы", () => {
    for (const y of ["ru", "en", "kk"] as const) for (const k of ["pz.hintBtn", "pz.hintShown", "pz.streak"]) expect(PZ_SLOVA[y][k], y + k).toBeTruthy();
    expect(PZ_SLOVA.en["pz.hintBtn"] + PZ_SLOVA.en["pz.hintShown"] + PZ_SLOVA.en["pz.streak"]).not.toMatch(/[А-Яа-яЁё]/);
  });
});

describe("задача дня по стабильному адресу /cyberchess/p/daily", () => {
  it("id «daily» грузится из /api/cyberchess-daily/puzzle, рейтинг берётся из rating, полная версия — /cyberchess/daily, в заголовке «Задача дня»", () => {
    expect(ROUTE).toContain('id === "daily" ? "/api/cyberchess-daily/puzzle" : `/api/cyberchess-puzzles/${encodeURIComponent(id)}`');
    expect(ROUTE).toContain("r: raw.r ?? raw.rating");
    expect(ROUTE).toContain('const polnaya = daily ? `/cyberchess/daily${keep.toString() ? "?" + keep.toString() : ""}`');
    expect(ROUTE).toContain('${daily ? pzT(locale, "pz.daily") + " · " : ""}${zadanie} · CyberChess');
    expect(ROUTE).toContain('fen: p.fen, daily: p.daily }');
    expect(КЛИЕНТ).toContain("daily:!!C.ev.daily");
    for (const y of ["ru", "en", "kk"] as const) expect(PZ_SLOVA[y]["pz.daily"], y).toBeTruthy();
    expect(PZ_SLOVA.en["pz.daily"]).not.toMatch(/[А-Яа-яЁё]/);
  });
});

describe("поделиться задачей", () => {
  it("кнопка в блоке «решено»; без navigator.share — копирует ссылку с ?c=tg-share, статус «скопировано», событие puzzle_share", async () => {
    собратьСтраницуСПодсказкой();
    document.querySelector("[data-cc-resheno]")!.insertAdjacentHTML("beforeend", '<button type="button" data-cc-share>Share</button>');
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => { written.push(t); } } });
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    new Function(КЛИЕНТ)();
    (document.querySelector("[data-cc-share]") as HTMLButtonElement).click();
    await тик();
    expect(written.length).toBe(1);
    expect(written[0]).toBe(location.origin + location.pathname + "?c=tg-share"); // jsdom: localhost/, в браузере — /cyberchess/p/<id> (проверено Playwright)
    expect(document.querySelector("[data-cc-status]")!.textContent).toBe("copied!");
    const sh = отправлено.find((e) => e.type === "feature_use" && e.meta?.feature === "puzzle_share");
    expect(sh?.meta?.how).toBe("copy");
    expect(sh?.meta?.surface).toBe("light");
  });
  it("слова на трёх языках, en без кириллицы; кнопка в HTML маршрута", () => {
    expect(ROUTE).toContain('<button type="button" data-cc-share>${esc(t("pz.share"))}</button>');
    for (const y of ["ru", "en", "kk"] as const) for (const k of ["pz.share", "pz.copied"]) expect(PZ_SLOVA[y][k], y + k).toBeTruthy();
    expect(PZ_SLOVA.en["pz.share"] + PZ_SLOVA.en["pz.copied"]).not.toMatch(/[А-Яа-яЁё]/);
  });
});

import { resheniyeSan } from "../logikaZadachi";

describe("после решения показывается линия решения в SAN", () => {
  it("resheniyeSan: мат в 1 за чёрных → «25... Qh1#»; серия из двух ходов нумеруется верно; мусор → []", () => {
    // li_3omqR после хода белых d4f2 (нормализованная позиция: ход чёрных)
    expect(resheniyeSan("7r/1kp2ppp/1pb5/p1B5/P7/5qP1/1P3Q1P/R3R1K1 b - - 1 25", ["f3h1"])).toEqual(["25... Qh1#"]);
    expect(resheniyeSan("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", ["e2e4", "e7e5", "g1f3"])).toEqual(["1. e4", "1... e5", "2. Nf3"]);
    expect(resheniyeSan("8/8/8/8/8/8/8/8 w - - 0 1", ["e2e4"])).toEqual([]);
  });
  it("ROUTE отдаёт san только при решении; клиент дописывает «Решение: …» к статусу", () => {
    expect(ROUTE).toContain("san: r.reshena ? resheniyeSan(pz.fen, pz.sol) : undefined");
    expect(КЛИЕНТ).toContain('C.texts.solution+": "+r.san.join(" ")');
    for (const y of ["ru", "en", "kk"] as const) expect(PZ_SLOVA[y]["pz.solution"], y).toBeTruthy();
    expect(PZ_SLOVA.en["pz.solution"]).not.toMatch(/[А-Яа-яЁё]/);
  });
  it("клиент: решено с san → статус содержит линию", async () => {
    собратьСтраницуСПодсказкой();
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const b = JSON.parse(String(init?.body ?? "{}"));
      const json = b.akt === "targets" ? { targets: ["g6"] } : { vid: "ok", fen: "8/5k2/6pp/3PRK2/r5PP/8/8/8 w - - 0 53", i: 1, reshena: true, otvet: null, movable: [], san: ["52... Kg6", "53. Rh5"] };
      return { json: async () => json } as Response;
    }));
    new Function(КЛИЕНТ)();
    клик2("g7"); await тик(); клик2("g6"); await тик();
    expect(document.querySelector("[data-cc-status]")!.textContent).toContain("52... Kg6 53. Rh5");
  });
});
