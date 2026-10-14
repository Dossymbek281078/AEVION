// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { КЛИЕНТ } from "../klientSkript";

/*
 * 🔴 Очередь 14.10 п.1: после верного хода «Следующая задача» — одним тапом БЕЗ перезагрузки.
 * Исполняется тот же инлайн-скрипт, что уходит в HTML: клик по ссылке «следующая» после решения
 * шлёт POST akt=next на текущий адрес С меткой (?c=), подменяет доску, задание, адрес (pushState),
 * прячет панель «решено», и следующую задачу можно решать (ход идёт с новым id/fen).
 */
type Telo = { type: string; meta?: Record<string, unknown>; path?: string };

function собратьСтраницу() {
  const cfg = { id: "li_a", fen: "8/5kp1/7p/3PRK2/r5PP/8/8/8 b - - 0 52", i: 0, storona: "b", movable: ["g7"], texts: { wrong: "Не то", yourMove: "Ваш ход", hint: "", solved: "✓ Решено!", hintShown: "", copied: "", shareTitle: "A", solution: "Решение" }, ev: { channel: "youtube", post: "chess-zadacha", path: "/cyberchess/p/li_a?c=yt-chess-zadacha", rating: 1200, theme: "", fen: "x", daily: false } };
  const клетки = ["g7", "g6", "g5"].map((sq) => `<button type="button" data-sq="${sq}" class="l"></button>`).join("");
  document.body.innerHTML = `<main data-cc-light-puzzle="li_a"><b data-cc-streak>0</b><div data-cc-zadanie>Ход чёрных · Мат в 1</div><div data-cc-board="1" data-cc-puzzle="li_a">${клетки}</div><div data-cc-status class="wd s"></div><div data-cc-resheno style="display:none"><a data-cc-next href="/cyberchess/p/li_b?c=yt-chess-zadacha">next</a></div><a data-cc-full href="/cyberchess?puzzle=li_a">full</a></main><script id="cc-cfg" type="application/json">${JSON.stringify(cfg)}</script>`;
}

const отправлено: Telo[] = [];
const запросы: Array<{ url: string; body: Record<string, unknown> }> = [];
const СЛЕДУЮЩАЯ = { id: "li_b", url: "/cyberchess/p/li_b?c=yt-chess-zadacha", html: `<button type="button" data-sq="e2" class="l m"></button><button type="button" data-sq="e4" class="d"></button>`, cfg: { id: "li_b", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1", i: 0, storona: "w", movable: ["e2"], texts: { solved: "✓ Решено! B", shareTitle: "B" }, ev: { path: "/cyberchess/p/li_b?c=yt-chess-zadacha", rating: 1210, theme: "mateIn1", fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1" } }, zadanie: "Ход белых · Мат в 1", title: "Ход белых · Мат в 1 · CyberChess", next: "/cyberchess/p/li_c?c=yt-chess-zadacha", polnaya: "/cyberchess?puzzle=li_b&c=yt-chess-zadacha" };

beforeEach(() => {
  try { localStorage.clear(); } catch { /* jsdom без хранилища — серия начнётся с 0 сама */ }
  отправлено.length = 0; запросы.length = 0;
  history.replaceState(null, "", "/cyberchess/p/li_a?c=yt-chess-zadacha");
  собратьСтраницу();
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: (_u: string, d: Blob) => { d.text().then((t) => отправлено.push(JSON.parse(t))); return true; } });
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body ?? "{}"));
    запросы.push({ url: u, body: b });
    if (b.akt === "next") return { ok: true, json: async () => СЛЕДУЮЩАЯ } as Response;
    const json = b.akt === "targets" ? { targets: b.from === "e2" ? ["e4"] : ["g6"] } : { vid: "ok", fen: "8/8/8/8/8/8/8/8 w - - 0 1", i: 1, reshena: true, otvet: null, movable: [] };
    return { ok: true, json: async () => json } as Response;
  }));
});

const тик = () => new Promise((r) => setTimeout(r, 20));
const клик = (sel: string) => (document.querySelector(sel) as HTMLElement).click();

describe("следующая задача одним тапом без перезагрузки", () => {
  it("🔴 после решения: POST akt=next с меткой, доска/задание/адрес новой задачи, панель «решено» скрыта, серия 1", async () => {
    new Function(КЛИЕНТ)();
    await тик();
    клик('[data-sq="g7"]'); await тик(); клик('[data-sq="g6"]'); await тик();
    expect((document.querySelector("[data-cc-resheno]") as HTMLElement).style.display).toBe("flex");
    клик("[data-cc-next]"); await тик(); await тик();
    const next = запросы.find((z) => z.body.akt === "next");
    expect(next, "akt=next не отправлен").toBeTruthy();
    expect(next!.url).toBe("/cyberchess/p/li_a?c=yt-chess-zadacha");
    expect(location.pathname + location.search).toBe("/cyberchess/p/li_b?c=yt-chess-zadacha");
    expect(document.querySelector("[data-cc-light-puzzle]")?.getAttribute("data-cc-light-puzzle")).toBe("li_b");
    expect(document.querySelector('[data-sq="e2"]')).toBeTruthy();
    expect(document.querySelector('[data-sq="g7"]')).toBeNull();
    expect(document.querySelector("[data-cc-zadanie]")?.textContent).toBe("Ход белых · Мат в 1");
    expect(document.title).toBe("Ход белых · Мат в 1 · CyberChess");
    expect((document.querySelector("[data-cc-resheno]") as HTMLElement).style.display).toBe("none");
    expect(document.querySelector("[data-cc-next]")?.getAttribute("href")).toBe("/cyberchess/p/li_c?c=yt-chess-zadacha");
    expect(document.querySelector("[data-cc-streak]")?.textContent).toBe("1");
    expect(отправлено.some((e) => e.type === "feature_use" && e.meta?.feature === "puzzle_next" && e.meta?.puzzle === "li_b" && e.meta?.channel === "youtube")).toBe(true);
  });

  it("новую задачу можно решать: ход уходит с id/fen новой, i=0, и снова шлёт first_move и puzzle_solved", async () => {
    new Function(КЛИЕНТ)();
    await тик();
    клик('[data-sq="g7"]'); await тик(); клик('[data-sq="g6"]'); await тик();
    клик("[data-cc-next]"); await тик(); await тик();
    отправлено.length = 0; запросы.length = 0;
    клик('[data-sq="e2"]'); await тик(); клик('[data-sq="e4"]'); await тик(); await тик();
    const hod = запросы.find((z) => z.body.akt === "move");
    expect(hod?.body.fen).toBe("4k3/8/8/8/8/8/4P3/4K3 w - - 0 1");
    expect(hod?.body.i).toBe(0);
    expect(hod?.url).toBe("/cyberchess/p/li_b?c=yt-chess-zadacha");
    const типы = отправлено.map((e) => e.type + ":" + String(e.meta?.feature ?? ""));
    expect(типы).toContain("feature_use:first_move");
    expect(типы).toContain("puzzle_solved:");
    expect(отправлено.find((e) => e.type === "puzzle_solved")?.meta?.id).toBe("li_b");
    expect(отправлено.find((e) => e.type === "puzzle_solved")?.meta?.streak).toBe(2);
  });
});
