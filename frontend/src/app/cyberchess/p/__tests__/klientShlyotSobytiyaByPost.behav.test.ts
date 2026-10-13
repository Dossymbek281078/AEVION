// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { КЛИЕНТ } from "../klientSkript";

/*
 * 🔴 Поведенческий сторож клиента лёгкой задачи: исполняет ТОТ ЖЕ инлайн-скрипт,
 * что уходит в HTML, и читает тела событий, которые он шлёт.
 *
 * Повод 13.10.2026: текстовый сторож пропустил мутацию `if(false)` — ветка стала
 * мёртвой, а строки с нужными словами остались. Здесь проверяется поведение:
 * неверный ход → puzzle_wrong_move + game_progress{отПопытки:true};
 * верный ход → game_progress{отПопытки:false}, first_move, puzzle_solved;
 * каждое тело — с channel/post из конфигурации и surface:light.
 */
type Telo = { type: string; source?: string; meta?: Record<string, unknown>; sid?: string; path?: string };

function собратьСтраницу() {
  const cfg = { id: "li_test", fen: "8/5kp1/7p/3PRK2/r5PP/8/8/8 b - - 0 52", i: 0, storona: "b", movable: ["g7"], texts: { wrong: "Не то", yourMove: "Ваш ход", hint: "Нажмите", solved: "✓ Решено! Мат в 1" }, ev: { channel: "youtube", post: "chess-1", path: "/cyberchess/p/li_test?c=yt-chess-1", rating: 877, theme: "Эндшпиль", fen: "8/5kp1/7p/3PRK2/r5PP/8/8/8 b - - 0 52" } };
  const клетки = ["g7", "g6", "g5", "e1"].map((sq) => `<button type="button" data-sq="${sq}" class="l"></button>`).join("");
  document.body.innerHTML = `<main data-cc-light-puzzle="li_test"><div data-cc-board="1" data-cc-puzzle="li_test">${клетки}</div><div data-cc-status class="wd s"></div><div data-cc-resheno style="display:none"></div></main><script id="cc-cfg" type="application/json">${JSON.stringify(cfg)}</script>`;
}

const отправлено: Telo[] = [];
beforeEach(() => {
  отправлено.length = 0;
  собратьСтраницу();
  // sendBeacon в jsdom нет — подменяем и читаем тело
  Object.defineProperty(navigator, "sendBeacon", { configurable: true, value: (_u: string, d: Blob) => { d.text().then((t) => отправлено.push(JSON.parse(t))); return true; } });
  // сервер ходов: цели для g7 — g6/g5; g5 — неверно; g6 — решено
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    const b = JSON.parse(String(init?.body ?? "{}"));
    const json = b.akt === "targets" ? { targets: ["g6", "g5"] } : b.to === "g6" ? { vid: "ok", fen: "8/5k2/6pp/3PRK2/r5PP/8/8/8 w - - 0 53", i: 1, reshena: true, otvet: null, movable: [] } : { vid: "wrong" };
    return { json: async () => json } as Response;
  }));
});

const тик = () => new Promise((r) => setTimeout(r, 20));
const клик = (sq: string) => (document.querySelector(`[data-sq="${sq}"]`) as HTMLButtonElement).click();

describe("клиент лёгкой задачи шлёт события byPost той же формы", () => {
  it("🔴 неверный ход: puzzle_wrong_move и game_progress{отПопытки:true}; затем верный: game_progress{отПопытки:false}, first_move, puzzle_solved", async () => {
    new Function(КЛИЕНТ)();
    await тик();
    expect(document.querySelector("[data-cc-light-puzzle]")?.getAttribute("data-hydrated")).toBe("1");
    клик("g7"); await тик(); клик("g5"); await тик(); await тик();
    expect((document.querySelector("[data-cc-status]") as HTMLElement).textContent).toBe("Не то");
    const послеОшибки = отправлено.map((e) => e.type + ":" + (e.meta?.feature ?? ""));
    expect(послеОшибки).toContain("puzzle_wrong_move:");
    const gpПопытка = отправлено.find((e) => e.type === "game_progress");
    expect(gpПопытка?.meta?.["отПопытки"]).toBe(true);
    expect(gpПопытка?.meta?.plies).toBe(1);
    expect(отправлено.find((e) => e.type === "puzzle_wrong_move")?.meta?.["попытка"]).toBe(1);

    клик("g7"); await тик(); клик("g6"); await тик(); await тик();
    const типы = отправлено.map((e) => e.type + ":" + (e.meta?.feature ?? "") + ":" + String(e.meta?.["отПопытки"] ?? ""));
    expect(типы).toContain("game_progress::false");
    expect(типы).toContain("feature_use:first_move:");
    expect(типы).toContain("puzzle_solved::");
    expect((document.querySelector("[data-cc-resheno]") as HTMLElement).style.display).toBe("flex");
  });

  it("каждое тело несёт channel/post из конфигурации, surface:light и path с меткой", async () => {
    new Function(КЛИЕНТ)();
    await тик(); клик("g7"); await тик(); клик("g6"); await тик(); await тик();
    expect(отправлено.length).toBeGreaterThanOrEqual(5);
    for (const e of отправлено) {
      expect(e.meta?.channel, e.type).toBe("youtube");
      expect(e.meta?.post, e.type).toBe("chess-1");
      expect(e.meta?.surface, e.type).toBe("light");
      expect(e.path).toBe("/cyberchess/p/li_test?c=yt-chess-1");
      expect(String(e.sid)).toMatch(/^s_/);
    }
    expect(отправлено.map((e) => e.type)).toEqual(expect.arrayContaining(["page_view", "feature_use", "game_progress", "puzzle_solved"]));
  });
});
