/**
 * Публичная страница /pricing/for/<отрасль>: два разных дефекта в одном месте.
 *
 * 1) Падение. INDUSTRIES["constructor"] возвращает функцию-конструктор из
 *    Object.prototype. Она истинна, поэтому ветка «не найдено» её пропускала,
 *    и ниже industry.recommendedModules оказывалось undefined — .includes на
 *    undefined ронял рендер. Прод 05.08.2026 отвечал HTTP 500 на constructor,
 *    __proto__ и toString.
 *
 * 2) Код ответа. Даже когда «не найдено» отрабатывало правильно, страница
 *    отдавалась с кодом 200: под любой выдуманный адрес получалась
 *    индексируемая страница. Теперь вызывается notFound() — прод отдаёт 404.
 *    Приём проверен на нашей же /smeta-trainer/certificate-exam/<hash>: она
 *    тоже клиентская и тоже отвечает 404.
 *
 * Рендерим через react-dom/server, а не через @testing-library/react: пакет
 * @testing-library/dom в node_modules отсутствует, из-за чего рендер-тесты
 * репозитория локально не стартуют вообще.
 */
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockParams: Record<string, string> | null = { industry: "banks" };

// notFound() в настоящем Next выбрасывает исключение, которое перехватывает
// сам фреймворк. В тесте подменяем его на метку: так видно, что страница
// именно ОТКАЗАЛАСЬ отдавать контент, а не нарисовала что-то своё.
const notFoundCalled = vi.fn();
class NotFoundSignal extends Error {}

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  notFound: () => {
    notFoundCalled();
    throw new NotFoundSignal("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/track", () => ({
  track: vi.fn(),
}));

vi.mock("@/lib/apiBase", () => ({
  apiUrl: (path: string) => path,
}));

vi.mock("@/components/ProductPageShell", () => ({
  ProductPageShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import IndustryLandingPage from "../page";

/** Рендерит страницу и говорит, ушла ли она в 404. */
function render(industry: string | null): { notFound: boolean; html: string } {
  mockParams = industry === null ? null : { industry };
  notFoundCalled.mockClear();
  try {
    const html = renderToString(<IndustryLandingPage />);
    return { notFound: false, html };
  } catch (e) {
    if (e instanceof NotFoundSignal) return { notFound: true, html: "" };
    throw e;
  }
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ json: () => Promise.resolve({ tiers: [], modules: [] }) })),
  );
});

describe("/pricing/for/[industry] — ключ отрасли приходит из адреса", () => {
  // constructor, __proto__ и toString роняли прод. valueOf и hasOwnProperty
  // добавлены как соседи по цепочке прототипов: правка обязана закрывать
  // класс целиком, а не три известных имени.
  it.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "ключ прототипа %s не роняет страницу и уходит в 404",
    (key) => {
      expect(() => render(key)).not.toThrow();
      expect(render(key).notFound).toBe(true);
      expect(notFoundCalled).toHaveBeenCalled();
    },
  );

  it("обычная несуществующая отрасль тоже даёт 404, а не страницу с кодом 200", () => {
    expect(render("nesushestvuyushaya").notFound).toBe(true);
  });

  it("отсутствие параметра не роняет страницу", () => {
    expect(() => render(null)).not.toThrow();
    expect(render(null).notFound).toBe(true);
  });

  // Обратная проверка: без неё зелёным было бы и «всегда notFound()», то есть
  // правка, которая закрывает вообще все отрасли.
  // Адрес и ключ перевода расходятся: /pricing/for/law-firms → lawFirms.
  it.each([
    ["banks", "banks"],
    ["startups", "startups"],
    ["government", "government"],
    ["creators", "creators"],
    ["law-firms", "lawFirms"],
  ])("настоящая отрасль %s продолжает открываться", (key, i18nKey) => {
    const r = render(key);

    expect(r.notFound).toBe(false);
    expect(r.html).toContain(`pricing.forIndustry.${i18nKey}.hero`);
  });
});
