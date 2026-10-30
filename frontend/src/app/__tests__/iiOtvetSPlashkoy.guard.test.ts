import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { AI_BADGE_TEXT } from "@/components/AiBadge";

/*
 * 28.10.2026 (окно «Продукт», слово основателя через Оркестратора: «делай плашку»).
 * До этого дня ни одно место на сайте не говорило человеку, что текст написала модель:
 * «Создано с ИИ» — 0 вхождений на ru/en/kk (git grep -F по src, контроль «Создано» = 6).
 * Теперь плашка — ОДИН компонент <AiBadge /> (src/components/AiBadge.tsx), и этот сторож
 * держит реестр мест выдачи ИИ: каждое обязано рисовать плашку. Второй тест — контроль
 * прибора с другой стороны: любой файл, который различает сообщения assistant/user,
 * обязан быть в реестре, иначе новый чат появится без плашки и никто не заметит.
 *
 * Мутация 28.10: убрать «<AiBadge />» из одного файла реестра → тест 1 красный (проверено).
 */
const KOREN = process.cwd();
const файл = (п: string) => readFileSync(join(KOREN, п), "utf8");

/** Места, где человеку показывают текст модели. Путь относительно frontend. */
export const REESTR_MEST_II = [
  "src/app/qcoreai/QCoreAIClient.tsx",
  "src/app/qai/page.tsx",
  "src/app/agent/page.tsx",
  "src/components/AgentDock.tsx",
  "src/components/AskAi.tsx",
  "src/app/kids-ai-content/components/AskAi.tsx",
  "src/app/bank/_components/AdvisorChat.tsx",
  "src/app/cyberchess/AiCoach.tsx",
  "src/app/cyberchess/VoiceCoach.tsx",
  "src/app/cyberchess/WhatIfButton.tsx",
  "src/app/cyberchess/page.tsx",
  "src/app/multichat-engine/CouncilConsole.tsx",
  "src/app/multichat-engine/shared/[token]/page.tsx",
  "src/app/psyapp-deps/components/SupportChat.tsx",
  "src/app/qgood/components/AiChat.tsx",
  "src/app/smeta-trainer/components/AiChat.tsx",
  "src/app/smeta-trainer/exam/[id]/page.tsx",
  "src/app/healthai/plan/page.tsx",
  "src/app/devhub/[id]/page.tsx",
  "src/app/qcoreai/widget/[token]/page.tsx",
  "src/components/build/AiCoachChat.tsx",
  "src/components/build/AiResumeBuilder.tsx",
];

function* tsxФайлы(dir: string): Generator<string> {
  for (const имя of readdirSync(dir)) {
    const p = join(dir, имя);
    if (statSync(p).isDirectory()) { if (imя(имя)) yield* tsxФайлы(p); }
    else if (p.endsWith(".tsx") && !p.includes("__tests__") && !p.endsWith(".test.tsx")) yield p;
  }
}
const imя = (d: string) => d !== "node_modules" && d !== ".next";

// Файл различает реплики модели и человека — значит, показывает ответ модели.
const ПРИЗНАК_ЧАТА = /role *={2,3} *["']assistant["']|\.role *!={1,2} *["']user["']|role *={2,3} *["']user["'] *\?/;

describe("ответ ИИ на сайте — с плашкой «Создано с ИИ»", () => {
  test("🔴 каждое место реестра импортирует и рисует <AiBadge />", () => {
    const без: string[] = [];
    for (const п of REESTR_MEST_II) {
      const s = файл(п);
      if (!s.includes('from "@/components/AiBadge"') || !s.includes("<AiBadge")) без.push(п);
    }
    expect(REESTR_MEST_II.length).toBeGreaterThanOrEqual(22); // знаменатель (28.10: 22 места)
    expect(без).toEqual([]);
  });

  test("🔴 контроль прибора: каждый файл с разметкой assistant/user есть в реестре", () => {
    const найдено: string[] = [];
    for (const p of tsxФайлы(join(KOREN, "src"))) {
      if (ПРИЗНАК_ЧАТА.test(readFileSync(p, "utf8"))) найдено.push(relative(KOREN, p).split("\\").join("/"));
    }
    expect(найдено.length).toBeGreaterThanOrEqual(10); // прибор видит чаты (28.10: 10)
    const вне = найдено.filter((p) => !REESTR_MEST_II.includes(p));
    expect(вне).toEqual([]);
  });

  test("один текст на трёх языках, на en — без кириллицы", () => {
    const { ru, en, kk } = AI_BADGE_TEXT;
    for (const t of [ru, en, kk]) { expect(t.label.length).toBeGreaterThan(3); expect(t.hint.length).toBeGreaterThan(10); }
    expect(new Set([ru.label, en.label, kk.label]).size).toBe(3);
    expect(/[\u0400-\u04ff]/.test(en.label + en.hint)).toBe(false);
    expect(ru.label).toBe("Создано с ИИ");
  });

  test("плашка — один компонент: второго текста «Создано с ИИ» в src нет", () => {
    const чужие: string[] = [];
    for (const p of tsxФайлы(join(KOREN, "src"))) {
      if (p.endsWith("AiBadge.tsx")) continue;
      const s = readFileSync(p, "utf8");
      if (/Создано с ИИ|Created with AI|ЖИ арқылы жасалды/.test(s)) чужие.push(relative(KOREN, p));
    }
    expect(чужие).toEqual([]);
  });
});
