import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Изменяющая ручка, которая без базы отвечает успехом, обязана СКАЗАТЬ, что
 * ничего не сохранила.
 *
 * Замер 28.08.2026. Класс найден в собственном коде предыдущего окна и оттуда
 * же расширен на весь бэкенд: обработчик получает правку, базы нет, он кладёт
 * значение в память и отвечает ровно тем же, чем ответил бы при настоящем
 * сохранении. Человек видит «готово», после перезагрузки — пусто, и объяснения
 * нет нигде: ни в ответе, ни в журнале, ни в Sentry.
 *
 * Найдено и починено четыре: сохранение и удаление персоны, цель по расходам,
 * метки сессии. Ронять их не стали — внутри одного процесса правка работает.
 * Изменилось одно: ответ перестал быть неотличимым.
 *
 * Образцы честного поведения в том же файле были с самого начала и подсказали
 * решение: `/me/webhook` отвечает 503 с причиной, `/me/optimize-costs` —
 * `source: "static"`. Разное поведение соседних ручек одного файла почти всегда
 * недосмотр, а не решение.
 *
 * Проверка мутационная: уберите признак у любой из четырёх — она покраснеет.
 */

const ROUTES = path.resolve(__dirname, "../src/routes");

/** Начала обработчиков — ЛЮБОЙ метод, иначе соседний обработчик утечёт в текущий. */
const ANY_VERB = [".get(", ".post(", ".put(", ".patch(", ".delete("];
const MUTATING = [".post(", ".put(", ".patch(", ".delete("];

/**
 * Чем ответ признаётся честным. Список закрытый и каждый пункт — реальная
 * форма из этого репозитория, а не догадка: `source: "static"` означает
 * «советы общие, не из ваших данных», 503 — прямой отказ.
 */
const SIGNALS = [
  "persisted", "durable", "storage", "degraded", "inMemory", "in-memory",
  "ephemeral", "temporary", 'source: "static"', "note:", "status(503)",
];

/**
 * Известные исключения. Пусто намеренно: сегодня класс закрыт целиком, и
 * непустой список тут означал бы, что мы согласились с молчанием где-то ещё.
 */
const BASELINE: string[] = [];

function offenders(file: string, src: string): string[] {
  const lines = src.split("\n");
  const starts: number[] = [];
  lines.forEach((l, i) => {
    const t = l.trim();
    if ((t.includes("outer.") || t.includes("Router.")) && ANY_VERB.some((v) => t.includes(v))) {
      starts.push(i);
    }
  });
  starts.push(lines.length);

  const found: string[] = [];
  for (let k = 0; k + 1 < starts.length; k++) {
    const head = lines[starts[k]].trim();
    if (!MUTATING.some((v) => head.includes(v))) continue;

    const text = lines.slice(starts[k], starts[k + 1]).join("\n");
    if (!text.includes("isDbReady")) continue;

    // Запасная ветка бывает двух форм. Прибор, знавший одну, молча пропустил
    // тот самый дефект, ради которого написан, — поэтому обе.
    let i = text.indexOf("!isDbReady()");
    if (i < 0) {
      const j = text.indexOf("if (isDbReady())");
      i = j >= 0 ? text.indexOf("} else {", j) : -1;
    }
    if (i < 0) continue;

    const tail = text.slice(i);
    const answersOk = tail.includes("res.json(") || tail.includes("res.status(2");
    if (!answersOk) continue;
    if (SIGNALS.some((sig) => tail.includes(sig))) continue;

    found.push(`${file} :${starts[k] + 1} ${head.slice(0, 60)}`);
  }
  return found;
}

describe("запасной путь без базы не выдаёт себя за сохранение", () => {
  test("самопроверка прибора: он умеет и находить, и не придираться", () => {
    const silent = [
      'xRouter.put("/x", async (req, res) => {',
      "  if (!isDbReady()) return res.json({ ok: true });",
      "  await pool.query(`UPDATE x`);",
    ].join("\n");
    expect(offenders("x.ts", silent), "молчащий запасной путь не найден").toEqual([
      'x.ts :1 xRouter.put("/x", async (req, res) => {',
    ]);

    const honest = silent.replace("{ ok: true }", "{ ok: true, persisted: false }");
    expect(offenders("x.ts", honest), "честный ответ принят за дефект").toEqual([]);

    const refuses = silent.replace("res.json({ ok: true })", 'res.status(503).json({ error: "no db" })');
    expect(offenders("x.ts", refuses), "прямой отказ принят за дефект").toEqual([]);

    const reading = silent.replace("xRouter.put(", "xRouter.get(");
    expect(offenders("x.ts", reading), "читающая ручка не относится к этому классу").toEqual([]);
  });

  test("во всех маршрутах молчащих запасных путей нет", () => {
    const found: string[] = [];
    for (const f of fs.readdirSync(ROUTES).filter((f) => f.endsWith(".ts"))) {
      found.push(...offenders(f, fs.readFileSync(path.join(ROUTES, f), "utf-8")));
    }
    const fresh = found.filter((f) => !BASELINE.includes(f));
    expect(
      fresh,
      "изменяющая ручка отвечает успехом при недоступной базе и молчит об этом:\n" +
        fresh.join("\n") +
        "\n\nОтвет обязан отличаться от настоящего сохранения: поле `persisted: false`\n" +
        "с пояснением, либо честный 503, как в /me/webhook.",
    ).toEqual([]);
  });
});
