import { describe, test, expect, vi, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n";
import Client from "./_client";
import cityMinimal from "./__fixtures__/cityMinimal.json";

/**
 * Подсказка городского запрета обязана говорить на языке посетителя.
 *
 * ПОВОД (01.09.2026). Английское правило лежало в данных давно, и основной
 * текст карточки его брал (`regimeEn ?? regime`). А подсказка строки шла
 * мимо: `padProhibition` возвращала только русское поле, и англоязычный
 * посетитель читал «Запретная зона UAP28…» в модуле, который сам же
 * проверяет, не выдаёт ли кто чужие данные за свои.
 *
 * ПОЧЕМУ НЕ НАШЛОСЬ РАНЬШЕ. Сторож языка сравнивает ВИДИМЫЙ текст, а
 * подсказка живёт в атрибуте `title` и попадает на экран только при
 * наведении. Это граница охвата сторожа, а не его дефект — и закрывается
 * она не расширением того сторожа, а вот этой отрисовкой.
 *
 * ЗАЧЕМ ОТРИСОВКА, КОГДА ЕСТЬ ПРОВЕРКА ФУНКЦИИ. `padPermission.test.ts`
 * доказывает, что функция ОТДАЁТ обе версии. Он ничего не говорит о том,
 * ЧИТАЕТ ли их страница: верни кто-нибудь `title={padBan.rule}` — оба
 * прогона останутся зелёными, а посетитель снова увидит русский.
 */

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonOk(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) } as Response);
}

function mountWithCity(city: unknown) {
  globalThis.fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/qskyway/city")) return jsonOk(city);
    if (url.includes("/api/qskyway/cities")) {
      return jsonOk({ default: "astana", cities: [{ id: "astana", name: "Astana" }] });
    }
    if (url.includes("/api/qskyway/route")) return Promise.reject(new Error("route unavailable"));
    return jsonOk({});
  }) as unknown as typeof fetch;
  return render(
    <I18nProvider>
      <Client />
    </I18nProvider>,
  );
}

const RU = "Запретная зона UAP28: полёты запрещены от земли до 450 м";
const EN = "Prohibited area UAP28: flights banned from ground to 450 m";

const banned = {
  ...cityMinimal,
  airspace: {
    available: true,
    permission: {
      available: true,
      authority: "Kazaeronavigatsia / AIP KZ",
      kind: "prohibition",
      regime: RU,
      regimeEn: EN,
      coveragePct: 100,
    },
  },
};

function banTitles(root: HTMLElement): string[] {
  return Array.from(root.querySelectorAll("[title]"))
    .map((n) => n.getAttribute("title") ?? "")
    .filter((s) => s.includes("UAP28"));
}

describe("подсказка городского запрета", () => {
  test("на английской странице показывает английское правило", async () => {
    const r = mountWithCity(banned);

    // Ждём ИМЕННО подсказку запрета. Ожидание «что-нибудь отрисовалось»
    // наступает раньше и на пустой странице — 01.09.2026 такой слабой
    // формулировкой я уже получил зелёный тест на неверном языке.
    await waitFor(
      () => expect(banTitles(r.container).length, "подсказки запрета нет вовсе").toBeGreaterThan(0),
      { timeout: 10000 },
    );

    for (const s of banTitles(r.container)) {
      expect(s, "подсказка осталась русской: " + s.slice(0, 70)).toContain(EN);
      expect(s, "русское правило доехало до английской страницы: " + s.slice(0, 70)).not.toContain("Запретная");
    }
  });
});
