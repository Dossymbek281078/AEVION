import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { I18nProvider, LangSwitch, loadDict } from "@/lib/i18n";
import { AutoTranslate } from "../AutoTranslate";

// Рендер React в jsdom при полном параллельном прогоне выходил за дефолтные
// 5с (замер: 5614 мс) и ронял файл ложной краснотой. Тяжёлому тесту — свой
// явный таймаут; на скорость одиночного прогона это не влияет.
vi.setConfig({ testTimeout: 20_000 });

/**
 * Регрессия, замеренная на живом проде 27.07.2026.
 *
 * `AutoTranslate` оборачивал детей в `<div key={lang}>`. `lang` стартует с "en"
 * (первый рендер обязан совпасть с сервером) и сразу после гидрации становится
 * сохранённым языком. Для КАЖДОГО не-английского пользователя это
 * перемонтировало всё поддерево: каждый fetch-на-mount уходил дважды, а
 * локальное состояние компонентов сбрасывалось.
 *
 * Замер на `/multichat-engine`: при `ru` — 2 запроса `presets`, при `en` — 1.
 *
 * `key` нужен только чтобы вернуть в DOM исходный текст вместо перевода
 * ПРЕДЫДУЩЕГО языка (перевод — прямая мутация текстовых узлов, React о ней не
 * знает). При первом определении языка возвращать нечего.
 */

function MountCounter({ onMount }: { onMount: () => void }) {
  const seen = useRef(false);
  useEffect(() => {
    // Считаем именно монтирования, а не рендеры.
    if (seen.current) return;
    seen.current = true;
    onMount();
  }, [onMount]);
  return <span data-testid="child">Open project</span>;
}

// Since 10.08.2026 only English is compiled into a page and the rest arrive as
// chunks, so the translating pass waits for the dictionary it seeds from.
// Awaiting it here makes that wait explicit instead of a race against waitFor.
beforeEach(async () => {
  await loadDict("ru");
  localStorage.clear();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ translations: [] }),
  }) as unknown as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe("AutoTranslate — перемонтирование поддерева", () => {
  it("сохранённый ru не перемонтирует детей на старте", async () => {
    localStorage.setItem("aevion_lang_v1", "ru");
    const onMount = vi.fn();
    await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <MountCounter onMount={onMount} />
          </AutoTranslate>
        </I18nProvider>
      )
    );
    await waitFor(() => expect(onMount).toHaveBeenCalled());
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("английский пользователь — тоже ровно одно монтирование (контроль)", async () => {
    localStorage.setItem("aevion_lang_v1", "en");
    const onMount = vi.fn();
    await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <MountCounter onMount={onMount} />
          </AutoTranslate>
        </I18nProvider>
      )
    );
    await waitFor(() => expect(onMount).toHaveBeenCalled());
    expect(onMount).toHaveBeenCalledTimes(1);
  });

  it("СМЕНА языка пользователем поддерево перемонтирует — иначе в DOM останется старый перевод", async () => {
    localStorage.setItem("aevion_lang_v1", "ru");
    const onMount = vi.fn();
    const { getByText } = await act(async () =>
      render(
        <I18nProvider>
          <LangSwitch />
          <AutoTranslate observe={false}>
            <MountCounter onMount={onMount} />
          </AutoTranslate>
        </I18nProvider>
      )
    );
    await waitFor(() => expect(onMount).toHaveBeenCalledTimes(1));

    await act(async () => {
      getByText("EN").click();
    });
    await waitFor(() => expect(onMount).toHaveBeenCalledTimes(2));
  });

  // Пойман на preview, тестами НЕ ловился: считать монтирования мало.
  // Перемонтирование происходит ПОСЛЕ того, как эффект перевода уже отработал
  // на старом DOM, — если не перезапустить его на новом, перевод не ляжет.
  // Вживую это выглядело так: RU → EN работал, EN → RU оставлял страницу
  // английской.
  it("после смены языка перевод ложится на перемонтированный DOM", async () => {
    localStorage.setItem("aevion_lang_v1", "en");
    localStorage.setItem(
      "aevion_tr_v1_ru",
      JSON.stringify({ "Open project": "Открыть проект" })
    );
    const { container, getByText } = await act(async () =>
      render(
        <I18nProvider>
          <LangSwitch />
          <AutoTranslate observe={false}>
            <span data-testid="phrase">Open project</span>
          </AutoTranslate>
        </I18nProvider>
      )
    );
    expect(container.querySelector('[data-testid="phrase"]')?.textContent).toBe("Open project");

    await act(async () => {
      getByText("RU").click();
    });
    await waitFor(() =>
      expect(container.querySelector('[data-testid="phrase"]')?.textContent).toBe("Открыть проект")
    );
  });

  it("не переводит, пока язык не определён: ни одного запроса с ?to=en у ru-пользователя", async () => {
    localStorage.setItem("aevion_lang_v1", "ru");
    await act(async () =>
      render(
        <I18nProvider>
          <AutoTranslate observe={false}>
            <span>Совершенно уникальная строка для перевода</span>
          </AutoTranslate>
        </I18nProvider>
      )
    );
    const calls = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls;
    const bodies = calls
      .map((c) => {
        try {
          return JSON.parse(String((c[1] as RequestInit | undefined)?.body ?? "{}"));
        } catch {
          return {};
        }
      })
      .filter((b) => b && typeof b === "object" && "to" in b);
    // Запрос перевода вообще может не понадобиться, но если ушёл — только в ru.
    expect(bodies.every((b) => b.to === "ru")).toBe(true);
  });
});
