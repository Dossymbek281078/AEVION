import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Плашка кассы (upgradeNudge) и кнопка ИИ-помощника (AgentDock) обе прижаты к
 * низу экрана. Замер прода 23.10.2026 (390×844 и 540×900): при bottom 18 кнопка
 * (z-index 9998, bottom 16, высота ~50) лежала поверх правого хвоста плашки —
 * перекрытие 39×48 px, под ней «Подключить покупку» и крестик. В момент, когда
 * человек готов платить или хочет закрыть плашку, нажать было некуда.
 *
 * Сторож: низ плашки выше верха кнопки помощника с запасом, и оба учитывают
 * баннер установки одной и той же переменной.
 */
const IDE = fs.readFileSync(path.resolve(__dirname, "..", "[id]", "page.tsx"), "utf8");
const DOCK = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "components", "AgentDock.tsx"), "utf8");

const DOCK_HEIGHT_PX = 50; // кнопка 39×50 на 390 — замер 23.10

function nudgeBlock(): string {
  const i = IDE.indexOf("{upgradeNudge && (");
  expect(i, "блок плашки upgradeNudge не найден").toBeGreaterThan(-1);
  return IDE.slice(i, i + 1500);
}

describe("плашка кассы не прячется под кнопкой ИИ-помощника", () => {
  test("низ плашки выше верха кнопки помощника", () => {
    const dock = DOCK.match(/className="aev-agent-launcher"[\s\S]*?bottom: "calc\((\d+)px \+ var\(--aevion-install-h, 0px\)\)"/);
    expect(dock, "отступ кнопки помощника не найден").not.toBeNull();
    const nudge = nudgeBlock().match(/bottom: "calc\((\d+)px \+ var\(--aevion-install-h, 0px\)\)"/);
    expect(nudge, "плашка не учитывает баннер установки или отступ числом").not.toBeNull();
    const dockTop = Number(dock![1]) + DOCK_HEIGHT_PX;
    expect(Number(nudge![1]), `низ плашки ${nudge![1]} px, верх кнопки ${dockTop} px`).toBeGreaterThanOrEqual(dockTop + 8);
  });

  test("прежнего bottom: 18 у плашки нет", () => {
    expect(nudgeBlock()).not.toMatch(/bottom: 18,/);
  });
});
