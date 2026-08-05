/**
 * Публичная страница /pricing/for/<отрасль> падала с 500 на ключах прототипа.
 *
 * INDUSTRIES["constructor"] возвращает функцию-конструктор из Object.prototype.
 * Она истинна, поэтому ветка `if (!industry)` её пропускала, и ниже
 * industry.recommendedModules оказывалось undefined — .includes на undefined
 * ронял рендер. Проверено на живом проде 05.08.2026:
 * /pricing/for/constructor, /__proto__, /toString отдавали HTTP 500,
 * а контрольный несуществующий /nesushestvuyushaya — 200.
 *
 * Рендерим через react-dom/server, а не через @testing-library/react:
 * пакет @testing-library/dom в node_modules отсутствует, из-за чего четыре
 * существующих рендер-теста репозитория локально не стартуют вообще. Тело
 * компонента (где и было падение) при renderToString выполняется полностью,
 * так что для этого дефекта серверного рендера достаточно.
 */
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

let mockParams: Record<string, string> | null = { industry: "banks" };

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
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

const NOT_FOUND_TITLE = "pricing.forIndustry.notFound.title";

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
    "не падает и показывает «не найдено» для ключа %s",
    (key) => {
      mockParams = { industry: key };

      const html = renderToString(<IndustryLandingPage />);

      expect(html).toContain(NOT_FOUND_TITLE);
    },
  );

  it("обычная несуществующая отрасль по-прежнему даёт «не найдено»", () => {
    mockParams = { industry: "nesushestvuyushaya" };

    expect(renderToString(<IndustryLandingPage />)).toContain(NOT_FOUND_TITLE);
  });

  it("отсутствие параметра не роняет страницу", () => {
    mockParams = null;

    expect(renderToString(<IndustryLandingPage />)).toContain(NOT_FOUND_TITLE);
  });

  // Обратная проверка: без неё тест зеленел бы и на `const industry = undefined`,
  // то есть на правке, которая ломает все настоящие отрасли разом.
  // Адрес и ключ перевода расходятся: /pricing/for/law-firms → lawFirms.
  it.each([
    ["banks", "banks"],
    ["startups", "startups"],
    ["government", "government"],
    ["creators", "creators"],
    ["law-firms", "lawFirms"],
  ])("настоящая отрасль %s продолжает открываться", (key, i18nKey) => {
    mockParams = { industry: key };

    const html = renderToString(<IndustryLandingPage />);

    expect(html).not.toContain(NOT_FOUND_TITLE);
    expect(html).toContain(`pricing.forIndustry.${i18nKey}.hero`);
  });
});
