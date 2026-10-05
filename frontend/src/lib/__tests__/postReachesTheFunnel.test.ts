import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Подметка поста обязана доезжать до учёта ВМЕСТЕ с каналом.
 *
 * Замер 05.10.2026: разрез `byPost` пуст за 1/7/14/30 дней, хотя три ролика с
 * подметками (`?c=yt-chess-level` и соседние) собрали 457 просмотров с 01.10.
 * Канал при этом доезжал верно — проба заходом легла в `youtube`.
 *
 * Причина была в одной строке `track()`: если отправитель передал свой
 * `channel`, meta возвращалась КАК ЕСТЬ, и пост терялся вместе с нашей веткой.
 * А `channel` передают все: `PageTracking` вычисляет его сам на каждой
 * странице. То есть ветка «приложить пост» не исполнялась практически никогда.
 *
 * Цена: на вопрос «какой ролик привёл человека» ответа нет, а это единственное,
 * чем решается, снимать ли следующий такой ролик.
 */
async function свежийТрекер() {
  vi.resetModules();
  return (await import("../track")).track;
}

function адрес(search: string, pathname = "/cyberchess") {
  Object.defineProperty(window, "location", {
    value: { search, pathname, href: `https://aevion.app${pathname}${search}` },
    writable: true,
  });
}

let отправлено: Array<Record<string, unknown>>;

beforeEach(() => {
  sessionStorage.clear();
  отправлено = [];
  vi.stubGlobal("navigator", { sendBeacon: () => false });
  vi.stubGlobal(
    "fetch",
    vi.fn((_u: string, init: RequestInit) => {
      отправлено.push(JSON.parse(String(init.body)));
      return Promise.resolve({ ok: true } as Response);
    }),
  );
});

const мета = (i = 0) => (отправлено[i]?.meta ?? {}) as Record<string, unknown>;

describe("подметка поста доезжает до учёта", () => {
  it("🔴 отправитель передал канал — пост всё равно приложен", async () => {
    // Ровно случай PageTracking: он ВСЕГДА кладёт свой channel.
    адрес("?c=yt-chess-level");
    const track = await свежийТрекер();
    track({ type: "page_view", source: "cyberchess", meta: { channel: "youtube" } });
    expect(мета().channel, "канал отправителя обязан остаться старше").toBe("youtube");
    expect(мета().post, "пост потерян — ради него вся подметка и придумана").toBe("chess-level");
  });

  it("канал определяем мы — пост тоже на месте (прежнее поведение не сломано)", async () => {
    адрес("?c=ig-post3");
    const track = await свежийТрекер();
    track({ type: "page_view", source: "cyberchess" });
    expect(мета().channel).toBe("instagram");
    expect(мета().post).toBe("post3");
  });

  it("КОНТРОЛЬ: выдуманный префикс не даёт ни канала, ни поста", async () => {
    адрес("?c=совсемчужое-хвост");
    const track = await свежийТрекер();
    track({ type: "page_view", source: "cyberchess" });
    expect(мета().channel, "неизвестная метка стала каналом").toBeUndefined();
    expect(мета().post, "неизвестная метка дала пост").toBeUndefined();
  });

  it("КОНТРОЛЬ: отправитель передал свой пост — свой и остаётся", async () => {
    адрес("?c=ig-post3");
    const track = await свежийТрекер();
    track({ type: "page_view", source: "cyberchess", meta: { post: "своё" } });
    expect(мета().post).toBe("своё");
  });

  it("КОНТРОЛЬ: метки нет вовсе — поля поста нет, пустышка не уезжает", async () => {
    адрес("");
    const track = await свежийТрекер();
    track({ type: "page_view", source: "cyberchess", meta: { channel: "direct" } });
    expect(мета().channel).toBe("direct");
    expect("post" in мета(), "в событие уехало пустое поле поста").toBe(false);
  });
});
