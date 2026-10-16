// 🔴 Волна 140 (16.10.2026): подсказка первого хода на доске задачи и тост под доской.
//
// Повод: воронка за 48 ч (api/pricing/events/funnel?days=2, 16.10 11:2x) — живых заходов
// по ссылке на задачу 4, живых первых ходов 0. Кадр прода 390×844 на 5-й секунде:
// доска видна, строка «Ход чёрных · Мат в 1» и верхний ряд доски накрыты тостом
// «Задача по ссылке · 1053», призыва нажать фигуру нет нигде.
//
// Что охраняется:
//  1) pervyyHodSdelan — та же память, что у события first_move: до хода false, после true,
//     другая задача — снова false (подсказка возвращается).
//  2) verhTostaNaTelefone — тост идёт ПОД доску, когда она в кадре и под ней есть место;
//     иначе под шапку, как решено 20.09.
//  3) Страница подключает и то и другое там, где надо (текстовые якоря — по одному на место).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { otmetitPervyyHod, pervyyHodSdelan } from "../pervyyHod";
import { verhTostaNaTelefone, МЕСТО_ПОД_ТОСТ, ОТСТУП_ТОСТА } from "../tostPodDoskoy";

const СТРАНИЦА = readFileSync(join(process.cwd(), "src/app/cyberchess/page.tsx"), "utf8");
const CSS = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const тихо = (() => undefined) as unknown as Parameters<typeof otmetitPervyyHod>[3];

describe("первый ход сделан — по памяти события", () => {
  it("🔴 до хода — не сделан; после — сделан; та же задача повторно — всё ещё сделан", () => {
    const pamyat = { current: "" };
    expect(pervyyHodSdelan(pamyat, "li_3omqR")).toBe(false);
    otmetitPervyyHod(pamyat, "puzzle", "li_3omqR", тихо);
    expect(pervyyHodSdelan(pamyat, "li_3omqR")).toBe(true);
    otmetitPervyyHod(pamyat, "puzzle", "li_3omqR", тихо);
    expect(pervyyHodSdelan(pamyat, "li_3omqR")).toBe(true);
  });

  it("другая задача после хода в первой — подсказка возвращается", () => {
    const pamyat = { current: "" };
    otmetitPervyyHod(pamyat, "puzzle", "a", тихо);
    expect(pervyyHodSdelan(pamyat, "b")).toBe(false);
    expect(pervyyHodSdelan(pamyat, "a")).toBe(true);
  });

  it("ход в партии не гасит подсказку задачи (ключи разные)", () => {
    const pamyat = { current: "" };
    otmetitPervyyHod(pamyat, "game", null, тихо);
    expect(pervyyHodSdelan(pamyat, "li_3omqR")).toBe(false);
  });
});

describe("тост на телефоне — под доску, когда она в кадре", () => {
  // Числа — с кадра прода 390×844 16.10: низ шапки 56, низ доски 448.
  it("🔴 кадр 390×844: доска в кадре, под ней место — тост под доской, а не под шапкой", () => {
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: 448, vh: 844 })).toBe(448 + ОТСТУП_ТОСТА);
  });

  it("доски нет (экран настройки) — под шапку, как 20.09", () => {
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: null, vh: 844 })).toBe(64);
    expect(verhTostaNaTelefone({ shapkaNiz: 40, doskaNiz: null, vh: 844 })).toBe(64); // минимум 56
  });

  it("доска прокручена выше шапки — под шапку", () => {
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: 30, vh: 844 })).toBe(64);
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: -300, vh: 844 })).toBe(64);
  });

  it("под доской нет места для тоста и нижней навигации — под шапку (граница ровно по МЕСТО_ПОД_ТОСТ)", () => {
    const vh = 640;
    const помещается = vh - МЕСТО_ПОД_ТОСТ - ОТСТУП_ТОСТА; // низ доски, при котором ещё влезает
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: помещается, vh })).toBe(помещается + ОТСТУП_ТОСТА);
    expect(verhTostaNaTelefone({ shapkaNiz: 56, doskaNiz: помещается + 1, vh })).toBe(64);
  });
});

describe("страница подключает подсказку и размещение тоста", () => {
  it("🔴 сторона подсказки гаснет по pervyyHodSdelan и только в задаче до первой попытки", () => {
    const i = СТРАНИЦА.indexOf("const nudgeSide");
    expect(i, "nudgeSide объявлен").toBeGreaterThan(0);
    const строка = СТРАНИЦА.slice(i, СТРАНИЦА.indexOf("\n", i));
    for (const часть of ['tab==="puzzles"', 'pzAttempt==="idle"', "!pervyyHodSdelan(pervyyHodOtpravlenRef,pzCurrent.id)", "game.turn()"]) {
      expect(строка, часть).toContain(часть);
    }
  });

  it("клетка получает iNudge по цвету фигуры, кольцо и текст-призыв есть в разметке", () => {
    expect(СТРАНИЦА.split("iNudge={nudgeSide!==null&&p?.color===nudgeSide}").length - 1).toBe(1);
    expect(СТРАНИЦА.split('className="cc-nudge-ring"').length - 1).toBe(1);
    // призыв — рядом со строкой задания и той же фразой, что в лёгкой задаче /p (pz.hint)
    const i = СТРАНИЦА.indexOf("zadanieNadDoskoy(pzCurrent,cc.locale)");
    expect(СТРАНИЦА.slice(i, i + 400)).toContain('nudgeSide!==null&&<span data-cc-nudge-text="1"');
    expect(СТРАНИЦА.slice(i, i + 400)).toContain('cc.t("pz.hint")');
  });

  it("CSS: кольцо дышит, при reduced-motion стоит, но видно", () => {
    expect(CSS).toContain("@keyframes cc-nudge-ring");
    // Тень — статичная в классе (box-shadow с clamp() в keyframes не интерполируется: замер 16.10,
    // animationName был, boxShadow «none»), дышит прозрачность.
    const k = CSS.indexOf(".cc-nudge-ring {");
    expect(k, "класс кольца").toBeGreaterThan(0);
    expect(CSS.slice(k, CSS.indexOf("}", k))).toContain("box-shadow: inset 0 0 0 clamp(3px, 0.4vw, 4px) rgba(37, 99, 235"); // не %: box-shadow их не принимает
    const i = CSS.indexOf("prefers-reduced-motion: reduce) {\n  .cc-nudge-ring");
    expect(i, "reduced-motion правило для кольца").toBeGreaterThan(0);
    expect(CSS.slice(i, i + 200)).toContain("animation: none");
    expect(CSS.slice(i, i + 200)).toContain("opacity: 1");
  });

  it("тост пересчитывается, когда доска появляется (первый экран — настройка, доска монтируется позже)", () => {
    expect(СТРАНИЦА.split("toastApplyRef.current=apply;").length - 1).toBe(1);
    const i = СТРАНИЦА.indexOf("useEffect(()=>{toastApplyRef.current();const b=document.querySelector(\"[data-cc-board]\");");
    expect(i, "второй эффект зовёт apply по смене доски").toBeGreaterThan(0);
    expect(СТРАНИЦА.slice(i, i + 400)).toContain("new ResizeObserver(()=>toastApplyRef.current())");
    expect(СТРАНИЦА.slice(i, i + 400)).toContain("boardPx");
  });

  it("тост на телефоне считается через verhTostaNaTelefone с низом доски", () => {
    expect(СТРАНИЦА).toContain('querySelector("[data-cc-board]")?.getBoundingClientRect();\n        r.setProperty("--aevion-toast-top",`${verhTostaNaTelefone({shapkaNiz:h,doskaNiz:bd?bd.bottom:null,vh:window.innerHeight})}px`)');
  });
});
