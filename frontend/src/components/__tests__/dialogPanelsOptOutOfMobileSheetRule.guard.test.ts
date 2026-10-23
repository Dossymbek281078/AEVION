import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * globals.css (≤768): `[role="dialog"]:not([data-dialog-panel]) > div` —
 * fixed, прижать к низу. Правило рассчитано на роль на ПОДЛОЖКЕ (ребёнок —
 * панель). Если роль стоит на самой панели, правило роняет каждый её блок.
 * Замеры прода 23.10.2026 на 390×844: окно «Новый проект» DevHub — 90 px с
 * выпавшими полями; панель ИИ-помощника пустая на всех страницах; «Новая
 * партия» CyberChess — выбор сложности и времени у низа экрана внахлёст.
 *
 * Сторож: у каждого тега с role="dialog" в коде сайта либо признак подложки
 * в самом теге (inset / overlay / закрытие кликом по фону), либо пометка
 * data-dialog-panel. Новое окно без одного из двух — красный.
 */
const SRC = path.resolve(__dirname, "..", "..");

function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__" && e.name !== "node_modules") files(p, out); }
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

/** Текст открывающего тега, в котором стоит role="dialog". */
function tagAround(s: string, i: number): string {
  const start = s.lastIndexOf("<", i);
  let depth = 0, j = start;
  for (; j < s.length; j++) {
    const c = s[j];
    if (c === "{") depth++;
    else if (c === "}") depth--;
    else if (c === ">" && depth === 0 && s[j - 1] !== "=") break;
  }
  return s.slice(start, j + 1);
}

const BACKDROP = /inset|[Oo]verlay|onClick=\{dismiss\}|setShow\w*\(false\)|onClose/;

describe("окна с ролью на панели не попадают под мобильное правило шторки", () => {
  const all = files(SRC);
  const sites: { where: string; tag: string }[] = [];
  for (const f of all) {
    const s = fs.readFileSync(f, "utf8");
    const re = /role="dialog"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) {
      if (/\/\/[^\n]*$/.test(s.slice(s.lastIndexOf("\n", m.index), m.index))) continue; // в комментарии
      if (s[m.index - 1] === "[") continue; // строка селектора: querySelector('[role="dialog"]')
      sites.push({ where: `${path.relative(SRC, f)}:${s.slice(0, m.index).split("\n").length}`, tag: tagAround(s, m.index) });
    }
  }

  test("знаменатель: окон найдено достаточно (прибор видит код)", () => {
    expect(sites.length).toBeGreaterThan(30);
  });

  test("каждое окно — подложка или помеченная панель", () => {
    const bad = sites.filter(x => !x.tag.includes("data-dialog-panel") && !BACKDROP.test(x.tag)).map(x => x.where);
    expect(bad, `всего окон ${sites.length}`).toEqual([]);
  });

  test("контроль: панель «Новый проект» узнаётся как панель", () => {
    const x = sites.find(y => y.tag.includes('aria-labelledby="devhub-new-project-title"'));
    expect(x).toBeDefined();
    expect(BACKDROP.test(x!.tag.replace("data-dialog-panel", ""))).toBe(false);
  });
});
