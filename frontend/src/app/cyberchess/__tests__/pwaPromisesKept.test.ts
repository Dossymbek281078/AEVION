import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { stripComments } from "./_stripComments";

// Установщик обещает только то, что приложение делает. 19.08.2026.
//
// Прежний текст обещал «Ежедневные напоминания о пазле — держи серию», то есть
// ВОЗВРАТ в приложение. Напоминание крутится setInterval-ом на открытой
// странице, значит вернуть в приложение оно не может.
//
// ⚠️ Первая редакция этой проверки читала public/sw.js и не находила там push —
// и была права случайно: у шахмат СВОЙ worker, cyberchess-sw.js, и обработчик
// push в нём ЕСТЬ. Вывод устоял по другой причине: нет подписки на клиенте и
// нет рассылки со стороны сервера для шахмат, а без них обработчик мёртв.
//
// Поэтому проверяются все три условия, а не одно. Push для платформы уже есть
// (web-push + VAPID в routes/build/push.ts), то есть настоящая починка — это
// переиспользование готового, а не стройка с нуля.

const ROOT = path.join(__dirname, "..");
const UI = path.join(ROOT, "PwaInstall.tsx");
const PUBLIC = path.join(ROOT, "..", "..", "..", "public");

function естьПодписка(): boolean {
  const файлы: string[] = [];
  const обойти = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "__tests__") обойти(p); }
      else if (/\.tsx?$/.test(e.name)) файлы.push(p);
    }
  };
  обойти(ROOT);
  return файлы.some((f) => /pushManager\s*\.\s*subscribe/.test(fs.readFileSync(f, "utf-8")));
}

function worker(): string {
  const p = path.join(PUBLIC, "cyberchess-sw.js");
  return fs.existsSync(p) ? fs.readFileSync(p, "utf-8") : "";
}

describe("обещания установщика", () => {
  test("возврат обещается только когда push доведён до конца", () => {
    const умеетПринимать = /addEventListener\(\s*["']push["']/.test(worker());
    const доведён = умеетПринимать && естьПодписка();
    const ui = stripComments(fs.readFileSync(UI, "utf-8"));
    if (!доведён) {
      expect(ui).not.toMatch(/Ежедневные напоминания/);
      expect(ui).toMatch(/пока приложение открыто/);
    } else {
      expect(ui).toMatch(/апоминани/);
    }
  });

  test("обещание офлайна подкреплено кэширующим обработчиком", () => {
    expect(worker()).toMatch(/addEventListener\(\s*["']fetch["']/);
  });

  test("сама проверка смотрит на ШАХМАТНЫЙ worker, а не на общий", () => {
    // Первая редакция читала public/sw.js — файл другого модуля. Проверка,
    // смотрящая не туда, отвечает уверенно и не о том.
    expect(worker()).not.toBe("");
    expect(worker()).toMatch(/addEventListener\(\s*["']push["']/);
  });
});
