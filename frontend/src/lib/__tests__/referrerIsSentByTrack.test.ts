import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Хост источника перехода уходит В ТЕЛЕ события — проверяется перехватом
 * отправки, а не чтением исходника.
 *
 * 🔴 Повод 06.10.2026: канал `direct` дал 226 живых заходов за 14 дней, из них
 * 212 неопознанных. Причина оказалась не в качестве разбора, а в том, что
 * `document.referrer` не писался НИГДЕ — ни здесь, ни на сервере. Поэтому
 * сторож ставится на оба конца: здесь на отправку, в
 * `referrerSurvivesThePost.guard.test.ts` — на приём и на разрез.
 */
const отправленное: string[] = [];

beforeEach(() => {
  отправленное.length = 0;
  vi.resetModules();
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: (_url: string, blob: Blob) => {
      // Blob в jsdom читается асинхронно, поэтому берём текст из замыкания:
      // тело уже строка, и `track` кладёт её в Blob единственным куском.
      void blob;
      return true;
    },
  });
  vi.stubGlobal("fetch", (_u: string, init?: RequestInit) => {
    отправленное.push(String(init?.body ?? ""));
    return Promise.resolve({ ok: true } as Response);
  });
});

/** Отключаем sendBeacon, чтобы тело пошло через fetch и его можно было прочесть. */
function безБикона() {
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    value: undefined,
  });
}

function приРеферере(ref: string) {
  Object.defineProperty(document, "referrer", { configurable: true, value: ref });
}

async function послать() {
  const { track } = await import("../track");
  track({ type: "page_view" });
  return отправленное[0] ? JSON.parse(отправленное[0]) : null;
}

describe("хост источника уходит вместе с событием", () => {
  it("🔴 переход с чужой площадки называет её хост", async () => {
    безБикона();
    приРеферере("https://news.ycombinator.com/item?id=12345&user=someone");
    const тело = await послать();
    expect(тело.refHost).toBe("news.ycombinator.com");
  });

  it("путь и запрос источника НЕ уходят — там чужие идентификаторы", async () => {
    безБикона();
    приРеферере("https://www.google.com/search?q=как+подтвердить+авторство+текста");
    const тело = await послать();
    // Контроль приватности: в теле не должно быть ни пути, ни поисковой фразы.
    expect(тело.refHost).toBe("google.com");
    expect(отправленное[0]).not.toContain("search");
    expect(отправленное[0]).not.toContain("авторство");
  });

  it("пустой referrer поля не создаёт — «нет источника» отличимо от «не записали»", async () => {
    безБикона();
    приРеферере("");
    const тело = await послать();
    expect(тело.refHost).toBeUndefined();
  });

  it("мусор вместо адреса не ломает отправку события", async () => {
    безБикона();
    приРеферере("не-адрес-вовсе");
    const тело = await послать();
    expect(тело.type).toBe("page_view");
    expect(тело.refHost).toBeUndefined();
  });
});
