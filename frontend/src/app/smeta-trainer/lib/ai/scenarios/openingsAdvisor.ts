/**
 * Советник по проёмам — «живой» AI-сценарий P3.
 *
 * Детектор openings.ts ставит замечание «забыли вычесть проёмы». Этот модуль
 * превращает его в разбор: детальную раскладку (надёжный офлайн-результат) и
 * заготовку промпта для живого QCoreAI, чтобы тот объяснил на ИМЕННО ЭТИХ числах.
 *
 * Чистый, без React и сети — см. openingsAdvisor.test.ts. Сетевой вызов (streamLLM)
 * делает UI-компонент, передавая сюда геометрию и получая question + extraSystem.
 */

import type { RoomGeometry } from "../../types";
import { grossWallArea, totalOpeningsArea, netWallArea } from "../geometry";

export interface OpeningDetail {
  kind: "window" | "door";
  label: string;
  width: number;
  height: number;
  count: number;
  /** площадь всех штук этого типа = width × height × count */
  area: number;
}

export interface OpeningsAnalysis {
  length: number;
  width: number;
  height: number;
  perimeter: number;
  gross: number;
  openings: OpeningDetail[];
  openingsTotal: number;
  net: number;
  /** на сколько % завышен объём, если взять брутто вместо нетто */
  overstatePct: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Полная раскладка площади стен помещения с детализацией по каждому проёму. */
export function analyzeOpenings(g: RoomGeometry): OpeningsAnalysis {
  const perimeter = 2 * (g.length + g.width);
  const gross = grossWallArea(g);
  const openingsTotal = totalOpeningsArea(g);
  const net = netWallArea(g);
  const openings: OpeningDetail[] = g.openings.map((o) => ({
    kind: o.kind,
    label: `${o.kind === "window" ? "Окно" : "Дверь"} ${o.width}×${o.height}${o.count > 1 ? ` ×${o.count}` : ""}`,
    width: o.width,
    height: o.height,
    count: o.count,
    area: round2(o.width * o.height * o.count),
  }));
  return {
    length: g.length,
    width: g.width,
    height: g.height,
    perimeter: round2(perimeter),
    gross: round2(gross),
    openings,
    openingsTotal: round2(openingsTotal),
    net: round2(net),
    overstatePct: net > 0 ? round2(((gross - net) / net) * 100) : 0,
  };
}

/**
 * Детерминированный пошаговый разбор (надёжный офлайн-fallback, когда ИИ недоступен).
 * Если передан enteredVolume (в ед. «100 м²») — добавляет сверку с введённым студентом.
 */
export function explainOpeningsDeterministic(a: OpeningsAnalysis, enteredVolume?: number): string {
  const lines: string[] = [];
  lines.push(`**Площадь стен под отделку = периметр × высота − проёмы.**`);
  lines.push("");
  lines.push(`1. Периметр: 2 × (${a.length} + ${a.width}) = **${a.perimeter} м**`);
  lines.push(`2. Брутто стен: ${a.perimeter} × ${a.height} = **${a.gross} м²** (без вычета проёмов)`);
  if (a.openings.length > 0) {
    lines.push(`3. Проёмы:`);
    for (const o of a.openings) {
      lines.push(`   • ${o.label}: ${o.width} × ${o.height}${o.count > 1 ? ` × ${o.count}` : ""} = ${o.area} м²`);
    }
    lines.push(`   Итого проёмов: **${a.openingsTotal} м²**`);
  }
  lines.push(`4. Нетто стен: ${a.gross} − ${a.openingsTotal} = **${a.net} м²** ← это и есть объём отделки`);
  lines.push(`5. В единице «100 м²»: ${a.net} / 100 = **${round2(a.net / 100)}**`);
  if (enteredVolume != null) {
    const enteredArea = round2(enteredVolume * 100);
    lines.push("");
    if (Math.abs(enteredArea - a.gross) < Math.abs(enteredArea - a.net)) {
      lines.push(
        `⚠️ Вы ввели ${enteredVolume} (= ${enteredArea} м²) — это **брутто**. Завышение на ${a.overstatePct}%. ` +
          `Замените на ${round2(a.net / 100)} (нетто ${a.net} м²).`,
      );
    } else {
      lines.push(`✓ Ваш объём ${enteredVolume} (= ${enteredArea} м²) близок к нетто — проёмы учтены.`);
    }
  }
  lines.push("");
  lines.push(`Откосы окон и дверей — **отдельная позиция**, не часть площади стен (СН РК 8.02-01).`);
  return lines.join("\n");
}

export interface OpeningsPromptContext {
  positionTitle?: string;
  enteredVolume?: number;
}

/**
 * Готовит вход для живого QCoreAI: вопрос студента + system-блок с точными числами,
 * чтобы модель объясняла на реальных данных, а не выдумывала.
 */
export function buildOpeningsAIPrompt(
  a: OpeningsAnalysis,
  ctx: OpeningsPromptContext = {},
): { question: string; extraSystem: string } {
  const openingsList = a.openings.map((o) => `${o.label} = ${o.area} м²`).join("; ");
  const extraSystem = [
    `РАЗБОР ПРОЁМОВ ДЛЯ ТЕКУЩЕГО ПОМЕЩЕНИЯ (числа точные, не меняй их):`,
    `- Помещение ${a.length}×${a.width}×${a.height} м, периметр ${a.perimeter} м.`,
    `- Брутто стен: ${a.gross} м². Проёмы: ${openingsList || "нет"} (итого ${a.openingsTotal} м²).`,
    `- Нетто стен (правильный объём отделки): ${a.net} м² = ${round2(a.net / 100)} в ед. «100 м²».`,
    ctx.enteredVolume != null
      ? `- Студент ввёл объём ${ctx.enteredVolume} (= ${round2(ctx.enteredVolume * 100)} м²).`
      : ``,
    `Объясни КРАТКО (3-5 предложений), почему отделка идёт по нетто, на этих числах,`,
    `со ссылкой на СН РК 8.02-01. Не выдумывай других цифр.`,
  ]
    .filter(Boolean)
    .join("\n");

  const question = ctx.positionTitle
    ? `Почему в позиции «${ctx.positionTitle}» объём нужно считать с вычетом проёмов? Разбери на моих числах.`
    : `Почему площадь стен под отделку считается с вычетом проёмов? Разбери на моих числах.`;

  return { question, extraSystem };
}
