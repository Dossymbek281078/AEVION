import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import * as path from "path";

// `session-claim.mjs` выдаёт РАЗРЕШЕНИЕ редактировать модуль. Значит опасный для
// него исход — не отказ, а ложное «свободно»: оно посылает сессию в чужой
// каталог, ровно туда, ради чего инструмент и написан.
//
// 28.07.2026 ложное «свободно» выдавалось на двух обычных входах:
//   • путь вместо имени модуля — `frontend/src/app/compare` склеивалось в
//     несуществующую зону `frontend/src/app/frontend/src/app/compare`. Этот вход
//     естественнее правильного: в глобальном правиле команда стоит рядом с
//     путями, и рука подставляет путь. Проверено на живом столкновении — каталог
//     БЫЛ занят чужой веткой `feat/compare-page`, а инструмент отвечал «FREE».
//   • любая описка в имени модуля (`qskiway`) — зоны не существует, совпадений
//     нет, ответ «FREE».
//
// Тесты НЕ утверждают, свободен ли конкретный модуль: это зависит от того, какие
// worktree живы прямо сейчас, и такой тест мигал бы. Проверяется только то, что
// от состояния не зависит: разбор аргумента и запрет отвечать «свободно», когда
// проверка не выполнена.

const SCRIPT = path.join(__dirname, "..", "..", "scripts", "session-claim.mjs");

function run(arg?: string): { code: number; out: string } {
  try {
    const out = execFileSync(process.execPath, arg === undefined ? [SCRIPT] : [SCRIPT, arg], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: (err.stdout ?? "") + (err.stderr ?? "") };
  }
}

describe("session-claim не выдаёт разрешение, которого не проверял", () => {
  it("описка в имени модуля — отказ, а не «свободно»", () => {
    const r = run("qskiway");
    expect(r.out).not.toContain("FREE");
    expect(r.out).toMatch(/не найден/);
    expect(r.code).toBe(2);
  });

  it("несуществующий модуль — отказ, а не «свободно»", () => {
    const r = run("модуль-которого-нет");
    expect(r.out).not.toContain("FREE");
    expect(r.code).toBe(2);
  });

  it("отказ прямо говорит, что это НЕ «свободно»", () => {
    // Без этой строки exit=2 легко прочитать как «ошибка инструмента, работаем
    // дальше» — то есть как разрешение, только молчаливое.
    expect(run("qskiway").out).toMatch(/НЕ значит «свободно»/);
  });

  it("путь вместо имени модуля переводится в модуль, а не клеится в зону", () => {
    const r = run("frontend/src/app/compare");
    expect(r.out).toContain('отнесён к модулю "compare"');
    // Именно этот вход раньше врал: зона существует и была занята.
    expect(r.out).not.toContain("frontend/src/app/frontend");
  });

  it("путь до файла роутера тоже переводится", () => {
    expect(run("aevion-globus-backend/src/routes/qskyway.ts").out).toContain('отнесён к модулю "qskyway"');
  });

  it("путь с обратными слэшами (Windows) разбирается так же", () => {
    expect(run("frontend\\src\\app\\compare").out).toContain('отнесён к модулю "compare"');
  });

  it.each([
    ["frontend/src/app/build", "qbuild"],
    ["frontend/src/app/bureau", "aevion-ip-bureau"],
    ["frontend/src/app/qpaynet", "qpaynet-embedded"],
    ["aevion-globus-backend/src/routes/ztide.ts", "z-tide"],
  ])("«%s» относится к модулю «%s», а не к имени папки", (p, id) => {
    // У части модулей папка называется иначе, чем id. Вернуть имя папки значило
    // бы проверить занятость не того модуля — и снова ответить не о том.
    expect(run(p).out).toContain(`отнесён к модулю "${id}"`);
  });

  it("путь вне зон модулей — отказ, а не догадка", () => {
    const r = run("docs/readme.md");
    expect(r.code).toBe(2);
    expect(r.out).not.toContain("FREE");
  });

  it("известный модуль по-прежнему проверяется, а не отвергается", () => {
    // Защита от чрезмерной строгости: починка не должна была превратить
    // инструмент в тот, что отказывает всегда — такой тоже бесполезен.
    const r = run("qskyway");
    expect(r.out).toMatch(/FREE|CLAIMED/);
    expect(r.out).not.toMatch(/не найден/);
  });
});
