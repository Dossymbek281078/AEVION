// 5.11.2026, замер прода fc6614f1c (kk, 1463, ?c=probe-prilozheniya&autotranslate=live, как у живого человека):
// ссылки внизу /multichat-engine из словаря («📊 Аналитика», «🕐 Кесте бойынша топтар») не содержат казахских букв,
// AutoTranslate принимал их за русский и превращал в английский («📊 Analytics», «🕐 Scheduled groups»).
// Словарь tm() уже даёт ru/kk/en — переводчику эти ссылки не отдаём: translate="no".
import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ isAuthenticated: () => false, getAuthHeaders: () => ({}) }));
const язык = vi.hoisted(() => ({ lang: "kk" }));
vi.mock("@/lib/i18n", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useI18nOptional: () => ({ lang: язык.lang, t: (k: string) => k }),
}));
vi.mock("../CouncilConsole", () => ({ CouncilConsole: () => null }));
vi.mock("@/components/Wave1Nav", () => ({ Wave1Nav: () => null }));
vi.mock("@/components/ModulePricingChip", () => ({ default: () => null }));
vi.mock("@/components/FooterWaitlist", () => ({ WaitlistIfMissing: () => null }));

import MultichatEnginePage from "../MultichatEngineClient";

describe("ссылки-инструменты внизу страницы не уходят в живой переводчик", () => {
  for (const [lang, analytics] of [["kk", "📊 Аналитика"], ["ru", "📊 Аналитика"], ["en", "📊 Analytics"]] as const) {
    test(`${lang}: «${analytics}» и «Scheduled» — translate="no", текст из словаря`, () => {
      язык.lang = lang;
      const { container } = render(<MultichatEnginePage />);
      const links = [...container.querySelectorAll('a[href^="/qcoreai/"]')].filter((a) => /analytics|schedule/.test(a.getAttribute("href") ?? ""));
      expect(links.length).toBe(2);
      for (const a of links) expect(a.getAttribute("translate"), a.textContent ?? "").toBe("no");
      expect(links[0].textContent).toBe(analytics);
    });
  }
});
