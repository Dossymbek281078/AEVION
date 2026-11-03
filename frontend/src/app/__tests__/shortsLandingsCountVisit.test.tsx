import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";

/**
 * Посадочные роликов считают заход.
 *
 * Повод 3.11.2026 (замер Приложений перед четырьмя Shorts, [Точно — /events/recent]):
 * ~20 заходов браузером на /cyberchess/traps и /devhub/guide с 03:33Z — 0 событий
 * page_view, на /verify за то же время — 6. Ролики ведут именно на эти адреса, то есть
 * люди с них в «люди за день» не попадали вовсе. Причина та же, что у /verify 21.10:
 * PageTracking не стоял на странице.
 *
 * Подменён только транспорт (sendBeacon) — проверяем тело, которое уходит в ручку.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, "..");

/** Адрес → имя источника. Все входы роликов и разборов, куда ведут ссылки из постов. */
const ПОСАДОЧНЫЕ: Array<[string, string]> = [
  ["cyberchess/traps", "cyberchess-traps"],
  ["en/cyberchess/traps", "en-cyberchess-traps"],
  ["kk/cyberchess/traps", "kk-cyberchess-traps"],
  ["cyberchess/guide", "cyberchess-guide"],
  ["en/cyberchess/guide", "en-cyberchess-guide"],
  ["kk/cyberchess/guide", "kk-cyberchess-guide"],
  ["devhub/guide", "devhub-guide"],
  ["bureau/guide", "bureau-guide"],
];

describe("посадочные роликов объявляют учёт ровно один раз", () => {
  test.each(ПОСАДОЧНЫЕ)("%s → %s", (путь, имя) => {
    const код = readFileSync(join(APP, путь, "page.tsx"), "utf8");
    const найдено = код.match(/<PageTracking\s+page="([^"]+)"/g) ?? [];
    expect(найдено).toHaveLength(1);
    expect(найдено[0]).toContain(`"${имя}"`);
  });
});

type Ушло = { url: string; body: Record<string, unknown> };
let ушло: Ушло[] = [];
let ждать: Promise<void>[] = [];

async function тело(b: BodyInit): Promise<Record<string, unknown>> {
  const text = typeof b === "string" ? b : await (b as Blob).text();
  return JSON.parse(text);
}

beforeEach(() => {
  try {
    sessionStorage.clear();
  } catch {
    // приватный режим — хранилища нет
  }
  ушло = [];
  ждать = [];
  Object.defineProperty(navigator, "sendBeacon", {
    configurable: true,
    value: (url: string, b: BodyInit) => {
      ждать.push(тело(b).then((body) => void ушло.push({ url, body })));
      return true;
    },
  });
});

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

async function визиты() {
  await Promise.all(ждать);
  return ушло.filter((e) => e.body.type === "page_view");
}

describe("заход по ссылке из ролика уходит в воронку", () => {
  test("/cyberchess/traps?c=yt-0311-1 — один page_view, канал youtube, пост ролика", async () => {
    const { default: TrapsPageRu } = await import("../cyberchess/traps/page");
    window.history.replaceState({}, "", "/cyberchess/traps?c=yt-0311-1");
    render(<TrapsPageRu />);
    const v = await визиты();
    expect(v).toHaveLength(1);
    expect(v[0].url).toMatch(/\/api\/pricing\/events$/);
    expect(v[0].body.source).toBe("cyberchess-traps");
    const meta = v[0].body.meta as Record<string, unknown>;
    expect(meta.channel).toBe("youtube");
    expect(meta.post).toBeTruthy();
  });

  test("контроль: адрес из кадра без метки — визит есть, канал direct", async () => {
    const { default: TrapsPageRu } = await import("../cyberchess/traps/page");
    window.history.replaceState({}, "", "/cyberchess/traps");
    render(<TrapsPageRu />);
    const v = await визиты();
    expect(v).toHaveLength(1);
    expect((v[0].body.meta as Record<string, unknown>).channel).toBe("direct");
  });
});

describe("английский браузер на /cyberchess/traps получает ссылку на перевод", () => {
  afterEach(() => {
    vi.doUnmock("next/navigation");
    vi.doUnmock("../cyberchess/i18n");
    vi.resetModules();
  });

  async function полоса(путь: string, запрос: string, язык: "en" | "kk" | "ru") {
    vi.resetModules();
    vi.doMock("next/navigation", () => ({ usePathname: () => путь }));
    vi.doMock("../cyberchess/i18n", () => ({ loadLocale: () => язык }));
    window.history.replaceState({}, "", путь + запрос);
    const { default: RussianOnlyNotice } = await import("../cyberchess/RussianOnlyNotice");
    return render(<RussianOnlyNotice />);
  }

  test("en: ссылка на /en/cyberchess/traps с меткой ролика, без «Russian only»", async () => {
    const { container, findByRole } = await полоса("/cyberchess/traps", "?c=yt-0311-1", "en");
    const a = await findByRole("link");
    expect(a.getAttribute("href")).toBe("/en/cyberchess/traps?c=yt-0311-1");
    expect(container.textContent).not.toContain("Russian only");
  });

  test("kk: ссылка на казахскую версию", async () => {
    const { findByRole } = await полоса("/cyberchess/guide", "", "kk");
    expect((await findByRole("link")).getAttribute("href")).toBe("/kk/cyberchess/guide");
  });

  test("контроль: страница без перевода по-прежнему честно говорит «Russian only»", async () => {
    const { findByRole } = await полоса("/cyberchess/daily", "", "en");
    const полосаЭл = await findByRole("status");
    expect(полосаЭл.textContent).toContain("Russian only");
    expect(полосаЭл.querySelector("a")).toBeNull();
  });

  test("контроль: русский браузер полосы не видит", async () => {
    const { container } = await полоса("/cyberchess/traps", "", "ru");
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
