import { describe, expect, test } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Невалидный workflow даёт провальный запуск на КАЖДЫЙ push в ЛЮБУЮ ветку —
// даже если триггера на push в нём нет вовсе.
//
// История, стоившая нам аккаунта. В qcore-benchmark.yml стояло
// `if: ${{ secrets.ANTHROPIC_API_KEY != '' }}` на уровне ЗАДАЧИ. Контекст
// `secrets` там недоступен, выражение невалидно, GitHub отвергал весь файл — и
// вместо «безопасного no-op» получался красный крестик, не выполнивший ни шага.
//
// Замер 19.08.2026 по истории запусков:
//   18.08 — 86 запусков за сутки, из них 84 за ОДИН час, 83 из них этот
//           бенчмарк на push по 73 РАЗНЫМ ветвям. Все упали;
//   19.08 — ещё 3 падения с одной ветки за 18 минут;
//   27.07 — 311+ запусков (выборка обрезана) в день отключения аккаунта.
//
// Именно так выглядит машинная активность со стороны GitHub. На main поломку уже
// починили (задача-гейт читает секрет через env), но старые ветки несут прежнюю
// копию файла, и push любой из них снова даёт гарантированный провал.
//
// Этот сторож не даёт вернуть поломку в файлы, которые мы правим.

const WORKFLOWS = join(__dirname, "..", "..", ".github", "workflows");

/** Строки `if:` вне комментариев, где упомянут контекст secrets. */
function badIfLines(text: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimStart();
    if (line.startsWith("#")) return; // объяснение поломки — не поломка
    if (!/^if\s*:/.test(line)) return;
    if (!/secrets\s*\./.test(line)) return;
    out.push({ line: i + 1, text: raw.trim() });
  });
  return out;
}

describe("контекст secrets не встречается в условиях workflow", () => {
  const files = existsSync(WORKFLOWS)
    ? readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f))
    : [];

  test("прибор читает workflow и отличает комментарий от кода", () => {
    // Отрицательный контроль на обоих концах: без него «нарушений нет» могло бы
    // значить «файлов не нашёл» или «шаблон не срабатывает никогда».
    expect(files.length).toBeGreaterThan(0);
    expect(badIfLines("    if: ${{ secrets.FOO != '' }}")).toHaveLength(1);
    expect(badIfLines("  # if: ${{ secrets.FOO != '' }} — так делать нельзя")).toHaveLength(0);
    expect(badIfLines("    if: github.event_name == 'schedule'")).toHaveLength(0);
  });

  test("ни в одном workflow нет условия с secrets", () => {
    const guilty: string[] = [];
    for (const f of files) {
      for (const hit of badIfLines(readFileSync(join(WORKFLOWS, f), "utf8"))) {
        guilty.push(`${f}:${hit.line}  ${hit.text}`);
      }
    }
    expect(
      guilty,
      "такое условие делает весь файл невалидным — провальный запуск на каждый push в любую ветку",
    ).toEqual([]);
  });

  test("починка бенчмарка на месте: секрет читается через задачу-гейт", () => {
    // Если задачу-гейт уберут, правило выше останется зелёным (условия с secrets
    // просто не будет), а поломка вернётся другим путём. Проверяем сам приём.
    const p = join(WORKFLOWS, "qcore-benchmark.yml");
    if (!existsSync(p)) return; // файл могли удалить осознанно — это не наша забота
    const src = readFileSync(p, "utf8");
    expect(src).toMatch(/^ {2}gate:/m);
    expect(src).toMatch(/needs:/);
  });
});
