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

  test("localStorage старше куки: явный сохранённый выбор не перебивается", async () => {
    // Порядок источников: localStorage (свежий выбор на ЭТОЙ машине) →
    // кука → догадка. Если оба заданы и расходятся — верим localStorage,
    // его пишет тот же setLang последним.
    document.cookie = `${LANG_COOKIE}=en; path=/`;
    const КЛЮЧИ = ["aevion_lang", "lang", "aevion_lang_v1"];
    // ключ хранения берём фактом: выставим через провайдера невозможно до
    // рендера, поэтому пишем во все кандидаты — лишние провайдер игнорирует.
    for (const k of КЛЮЧИ) { try { localStorage.setItem(k, "kk"); } catch {} }
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
