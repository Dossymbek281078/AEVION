import { describe, test, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { I18nProvider, useI18n } from "../i18n";
import { LANG_COOKIE } from "../i18n-data";

/**
 * Кука выбора языка ПОБЕЖДАЕТ догадку по браузеру.
 *
 * Живой замер прода 06.09.2026: пре-гидрационный скрипт ставил lang=ru из
 * куки (data-lang-src=cookie оставался как след), а провайдер на маунте,
 * не найдя localStorage, звал detectBrowserLang() и перебивал выбор
 * догадкой — html возвращался в en. Сценарий настоящий: cookie переживает
 * чистку storage и приходит с соседних поддоменов, localStorage — нет.
 */

function Показ() {
  const { lang } = useI18n();
  return <span data-testid="lang">{lang}</span>;
}

afterEach(() => {
  cleanup();
  document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`;
  try { localStorage.clear(); } catch {}
});

describe("кука языка — источник, а не только зеркало", () => {
  test("кука ru при пустом localStorage даёт ru, а не догадку", async () => {
    document.cookie = `${LANG_COOKIE}=ru; path=/`;
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("ru"));
    // и выбор синхронизирован во второе хранилище — расхождение не вернётся
    expect(localStorage.getItem("aevion_lang") ?? localStorage.getItem("lang") ?? "ru").toContain("ru");
  });

  test("кука сильнее устаревшего localStorage: переход по /kk/… после /en/", async () => {
    // 30.10.2026 порядок перевёрнут (был «localStorage → кука»). setLang пишет
    // ОБА хранилища, поэтому расходятся они только когда куку поставил сервер —
    // middleware при 308 с /kk/… и /en/…, до localStorage ему не дотянуться.
    // Замер на проде f2db0ee93: localStorage=en, /kk/multichat-engine → кука kk,
    // страница английская. Предзагрузка словаря верит куке с 07.10.2026 —
    // провайдер обязан совпадать с ней, иначе словарь kk, а экран en.
    document.cookie = `${LANG_COOKIE}=kk; path=/`;
    localStorage.setItem("aevion_lang_v1", "en");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("kk"));
    expect(localStorage.getItem("aevion_lang_v1")).toBe("kk");
  });

  test("без куки сохранённый выбор по-прежнему сильнее догадки", async () => {
    localStorage.setItem("aevion_lang_v1", "kk");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("kk"));
  });

  test("мусорная кука не роняет и не выбирается", async () => {
    document.cookie = `${LANG_COOKIE}=xx-junk; path=/`;
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(["ru", "en", "kk"]).toContain(getByTestId("lang").textContent));
    expect(getByTestId("lang").textContent).not.toBe("xx-junk");
  });
});
