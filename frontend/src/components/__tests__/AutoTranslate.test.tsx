import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { I18nProvider, loadDict } from "@/lib/i18n";
import { AutoTranslate } from "../AutoTranslate";

// JSX like `smart call{n === 1 ? "" : "s"}` renders ONE phrase as two sibling
// text nodes. Translating each fragment alone produced hybrids like
// "3 умный вызовs" (seen live on /pricing) — the walker must join sibling
// text nodes and translate the whole phrase.
describe("AutoTranslate — fragmented text nodes", () => {
  // Since 10.08.2026 only English is compiled into a page and the rest arrive
  // as chunks, so the translating pass waits for the dictionary it seeds from.
  // Awaiting it here makes that wait explicit instead of a race against waitFor.
  beforeEach(async () => {
    await loadDict("ru");
    localStorage.clear();
    localStorage.setItem("aevion_lang_v1", "ru");
    // Pre-seed the persisted translation cache so no network round-trip is
    // needed for the phrase under test.
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "3 smart calls": "3 умных вызова" })
    );
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [] }),
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("translates a phrase split across sibling text nodes as one unit", async () => {
    // Тип ЯВНЫЙ: без него TypeScript сужает n до литерала 3, и проверка
    // множественного числа ниже становится заведомо ложной (TS2367). Тест при
    // этом работает верно — жалоба на уровне типов, но она про настоящее:
    // в разметке остаётся мёртвая ветка, повторяющая логику продукта.
    const n: number = 3;
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="phrase">
              {`${n} smart call`}
              {n === 1 ? "" : "s"}
            </span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      const span = container.querySelector('[data-testid="phrase"]');
      expect(span?.textContent).toBe("3 умных вызова");
    });
  });

  it("still translates single text nodes exactly as before", async () => {
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "Open project": "Открыть проект" })
    );
    const { container } = await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span data-testid="single">Open project</span>
          </AutoTranslate>
        </I18nProvider>
      )
    );

    await waitFor(() => {
      expect(container.querySelector('[data-testid="single"]')?.textContent).toBe("Открыть проект");
    });
  });
});

/*
 * 🔴 Отказ перевода обязан быть ВИДЕН. Замер 07.10.2026: сервис возвращал
 * `degraded: true` и причину, а этот компонент — единственный, кто ручку
 * вызывает, — поля не читал вовсе. Посетитель английской страницы видел
 * русский текст, и об этом не говорило ничто.
 *
 * Канарейка рядом ловит ДРУГОЕ — службу, которая выдумывает текст. Честный
 * отказ она пропускает: исходная строка возвращается неизменной, а это
 * законный ответ для имён брендов.
 */
describe("AutoTranslate — отказ перевода не молчит", () => {
  beforeEach(async () => {
    await loadDict("ru");
    localStorage.clear();
    localStorage.setItem("aevion_lang_v1", "ru");
    // Отвечаем так, как отвечает ПРОД при отказе: исходные строки назад,
    // плюс признание. Канарейку возвращаем как есть, иначе сработает
    // другая защита и мы проверим не то.
    global.fetch = vi.fn().mockImplementation(async (_u: unknown, init: { body?: string }) => {
      const тело = JSON.parse(String(init?.body ?? "{}")) as { texts?: string[] };
      return {
        ok: true,
        json: async () => ({
          translations: тело.texts ?? [],
          degraded: true,
          reason: "DeepL quota exceeded; Claude failed",
        }),
      };
    }) as unknown as typeof fetch;
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("говорит об отказе один раз и называет, куда смотреть", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span>Untranslated phrase for the degraded guard</span>
          </AutoTranslate>
        </I18nProvider>,
      ),
    );

    await waitFor(() => {
      const про = warn.mock.calls.filter((c) => String(c[0]).includes("degraded"));
      expect(про.length, "об отказе перевода не сказано НИЧЕГО").toBeGreaterThan(0);
    });

    const про = warn.mock.calls.filter((c) => String(c[0]).includes("degraded"));
    // знаменатель — видно, сколько раз сказано и что именно
    process.stderr.write(
      `[сторож] сообщений об отказе: ${про.length}${String.fromCharCode(10)}`,
    );
    expect(про.length, "сказано больше одного раза — журнал забьётся и его перестанут читать").toBe(1);
    const текст = String(про[0][0]);
    expect(текст, "сообщение не называет причину").toContain("quota");
    expect(текст, "сообщение не говорит, куда смотреть").toContain("/api/i18n/health");
  });
});
