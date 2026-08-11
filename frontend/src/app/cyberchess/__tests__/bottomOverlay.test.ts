import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ABOVE_BOTTOM_NAV, bottomNavShown, bottomOffset } from "../bottomOverlay";

/* На телефоне внизу стоит `cc-bottom-nav` — пять кнопок, которыми и переключаются
 * разделы. Всё, что приклеено к низу через `position: fixed`, ложится поверх неё:
 * панель `sticky` и фиксированному элементу с большим z-index проигрывает.
 *
 * 11.08.2026 так вели себя сразу три элемента, и хуже всех — предупреждение «прогресс
 * перестал сохраняться»: оно висит до перезагрузки, то есть накрыло бы навигацию
 * навсегда. Единственный экран, сообщающий о потере прогресса, стал бы единственным,
 * с которого нельзя уйти.
 */

const DIR = join(__dirname, "..");
const page = readFileSync(join(DIR, "page.tsx"), "utf8");

describe("bottomNavShown", () => {
  it("панель есть только на узком экране и не в стрим-режиме", () => {
    expect(bottomNavShown(400, false)).toBe(true);
    expect(bottomNavShown(768, false)).toBe(true);
    expect(bottomNavShown(769, false)).toBe(false);
    expect(bottomNavShown(400, true)).toBe(false);
  });

  it("порог совпадает с тем, по которому рендерится сама панель", () => {
    /* Два места с одним порогом — типовой источник расхождения: поменяют одно,
       забудут другое, и отступ появится там, где панели нет. */
    expect(page).toMatch(/!streamerMode&&vwPx<769&&<BottomNav/);
  });
});

describe("bottomOffset", () => {
  it("на телефоне поднимает над панелью, на десктопе оставляет как было", () => {
    expect(bottomOffset(400, false, 20)).toBe(ABOVE_BOTTOM_NAV);
    expect(bottomOffset(1200, false, 20)).toBe(20);
    // в стрим-режиме панели нет — незачем и отступать
    expect(bottomOffset(400, true, 20)).toBe(20);
  });

  it("отступ учитывает безопасную зону, как и сама панель", () => {
    expect(ABOVE_BOTTOM_NAV).toMatch(/env\(safe-area-inset-bottom/);
    const nav = page.slice(page.indexOf('className="cc-bottom-nav"'), page.indexOf('className="cc-bottom-nav"') + 400);
    expect(nav).toMatch(/env\(safe-area-inset-bottom\)/);
  });
});

describe("плавающие элементы пользуются общим отступом", () => {
  const cases: [string, RegExp][] = [
    ["предупреждение о потере прогресса", /bottom:bottomOffset\(vwPx,streamerMode,12\)/],
    ["кнопка «вернуться к партии»", /bottom:bottomOffset\(vwPx,streamerMode,20\)/],
    ["свёрнутый голосовой коуч", /collapsedBottom=\{bottomOffset\(vwPx,streamerMode,16\)\}/],
  ];

  for (const [what, rx] of cases) {
    it(`${what} — через общий помощник, а не своим числом`, () => {
      expect(page, what).toMatch(rx);
    });
  }

  it("голосовой коуч не хранит своей копии условия", () => {
    /* Компонент про ширину экрана знать не должен — иначе появится второй порог,
       который разойдётся с первым. Значение считает страница и передаёт пропом. */
    const vc = readFileSync(join(DIR, "VoiceCoach.tsx"), "utf8");
    expect(vc).toMatch(/collapsedBottom/);
    expect(vc).not.toMatch(/vwPx|769/);
  });
});
