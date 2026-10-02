import { describe, test, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { I18nProvider, useI18n } from "../i18n";
import { LANG_COOKIE } from "../i18n-data";

/**
 * Сторож: адрес из личного письма открывается ПО-АНГЛИЙСКИ.
 *
 * 🔴 Замер окна 2b 02.10.2026, перед рассылкой семи писем лабораториям ИИ. Письма
 * англоязычные и ведут на /bureau?c=mail-ai1..5, а страница открывалась ПО-РУССКИ:
 * язык выбирался по сохранённому выбору, куке и языку браузера — ни одно из этих
 * хранилищ про нового получателя ничего не знает. Человек, которому мы написали
 * лично, видел чужой язык в первую секунду.
 *
 * Порядок источников теперь: ЗАПРОС (?lang= и ?c=mail-*) → путь (/en/...) →
 * сохранённый выбор → кука → язык браузера. Проверяем первый шаг и то, что он НЕ
 * ломает остальные.
 */

function Показ() {
  const { lang } = useI18n();
  return <span data-testid="lang">{lang}</span>;
}

function открыть(адрес: string) {
  window.history.replaceState({}, "", адрес);
}

afterEach(() => {
  cleanup();
  document.cookie = `${LANG_COOKIE}=; path=/; max-age=0`;
  try { localStorage.clear(); } catch {}
  открыть("/");
});

describe("язык по адресу письма", () => {
  test("метка mail-* даёт английский, даже если кука говорит ru", async () => {
    // Кука ru — это самый враждебный случай: по прежнему порядку она побеждала.
    document.cookie = `${LANG_COOKIE}=ru; path=/`;
    открыть("/bureau?c=mail-ai1");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("en"));
  });

  test("явный ?lang=ru сильнее метки: просьба человека старше нашей рассылки", async () => {
    открыть("/bureau?c=mail-ai1&lang=ru");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("ru"));
  });

  test("КОНТРОЛЬ: без метки кука ru по-прежнему решает", async () => {
    // Без этого контроля правка могла бы тихо сделать английский языком по умолчанию
    // для всех — то есть починить письмо и сломать русскую витрину.
    document.cookie = `${LANG_COOKIE}=ru; path=/`;
    открыть("/bureau");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("ru"));
  });

  test("КОНТРОЛЬ: чужая метка канала язык не меняет", async () => {
    document.cookie = `${LANG_COOKIE}=ru; path=/`;
    открыть("/bureau?c=ig");
    const { getByTestId } = render(<I18nProvider><Показ /></I18nProvider>);
    await waitFor(() => expect(getByTestId("lang").textContent).toBe("ru"));
  });
});
