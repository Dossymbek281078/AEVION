import { describe, it, expect, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { InstallPrompt } from "../InstallPrompt";

/**
 * Баннер установки не должен накрывать кнопку AI-агента.
 *
 * Найдено 28.08.2026 проходом сайта браузером, а не тестом: у обоих элементов
 * стоял `position: fixed; bottom: 16; right: 16`, а слои соседние — 9999 у
 * баннера и 9998 у кнопки. Замер по 70 точкам внутри кнопки:
 *
 *     пока баннер виден      -> доступно 0 точек из 70 (0%)
 *     баннер скрыт           -> доступно 96%
 *
 * И на телефоне (390px), и на десктопе (1280px) — то есть кнопку не мог нажать
 * НИКТО, пока не закроет баннер. Тесты этого не видели: оба компонента
 * отрисовываются, оба «работают», перекрытие возникает только вместе.
 *
 * Починка без связывания компонентов: баннер публикует свою высоту в
 * `--aevion-install-h`, кнопка на неё отступает. Нет баннера — нет переменной,
 * отступ обычный.
 */

const here = dirname(fileURLToPath(import.meta.url));

function fireInstallPrompt() {
  const event: Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: "accepted" | "dismissed" }> } =
    new Event("beforeinstallprompt", { cancelable: true });
  event.prompt = async () => {};
  event.userChoice = Promise.resolve({ outcome: "accepted" as const });
  act(() => {
    window.dispatchEvent(event);
  });
}

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty("--aevion-install-h");
  localStorage.clear();
});

describe("баннер установки не накрывает кнопку агента", () => {
  it("пока баннера нет, переменная отступа не задана", () => {
    render(<InstallPrompt />);
    expect(document.documentElement.style.getPropertyValue("--aevion-install-h")).toBe("");
  });

  it("показанный баннер публикует свою высоту", () => {
    // После мержа 05.09 баннер выходит не сразу: 20 секунд на осмотреться
    // и только без открытого диалога на странице. Проматываем это время.
    vi.useFakeTimers();
    render(<InstallPrompt />);
    fireInstallPrompt();
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    vi.useRealTimers();
    const v = document.documentElement.style.getPropertyValue("--aevion-install-h");
    // В jsdom высота элемента равна нулю, поэтому проверяем не число, а САМ
    // ФАКТ публикации: переменная задана и в пикселях. Величину проверяет
    // браузер, а не эта среда.
    expect(v, "баннер показан, а высота не опубликована").toMatch(/px$/);
  });

  it("кнопка агента отступает на эту переменную, а не на голые 16px", () => {
    // Читаем ИСХОДНИК: в jsdom нет раскладки, и «перекрывает или нет» здесь не
    // проверить. Но можно проверить то, из-за чего перекрытие возникало — что
    // обе позиции больше не жёстко одинаковы.
    const dock = readFileSync(join(here, "..", "AgentDock.tsx"), "utf8");
    expect(dock, "кнопка снова прибита к bottom: 16 — баннер её накроет")
      .toContain("var(--aevion-install-h");
  });

  it("страница резервирует место под баннер, иначе подвал не достать", () => {
    // Замер 28.08.2026 на 390px, ВНИЗУ главной (прокручивать некуда):
    //   с баннером  -> недостижимы 12 элементов
    //   без баннера -> недостижимы 8
    // Разница — ровно 5: /terms, /privacy, /help, /qnews и кнопка агента.
    // Поднять одну кнопку мало: подвал накрыт целиком, поэтому страница
    // отступает снизу на ту же опубликованную высоту.
    const css = readFileSync(join(here, "..", "..", "app", "globals.css"), "utf8");
    const body = css.slice(css.indexOf("body {"), css.indexOf("body {") + 900);
    expect(body, "у body убрали отступ под баннер — подвал снова будет закрыт")
      .toContain("padding-bottom: calc(var(--aevion-install-h");
  });

  it("кнопка агента тоже резервирует место — она закрывала «Помощь»", () => {
    // Замер ЖИВОГО прода 28.08.2026 зондом aevion-overlay-probe, десктоп
    // 1280px: ссылка «Помощь» (/help) в подвале недостижима, накрыта
    // закреплённой кнопкой «Открыть AEVION AI Agent». Прокрутка не спасает —
    // внизу страницы уехать некуда. Проверено отдельно: элемент остаётся
    // недостижим и когда его выводят в середину экрана.
    const dock = readFileSync(join(here, "..", "AgentDock.tsx"), "utf8");
    expect(dock, "кнопка перестала публиковать свой след — подвал снова закроется")
      .toContain("--aevion-dock-h");
    const css = readFileSync(join(here, "..", "..", "app", "globals.css"), "utf8");
    expect(css, "страница не учитывает след кнопки агента")
      .toContain("var(--aevion-dock-h");
  });
});
