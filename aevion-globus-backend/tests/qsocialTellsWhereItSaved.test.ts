import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * QSocial называет хранилище во всех десяти местах записи.
 *
 * Замер 19.08.2026: семь структур в памяти, десять мест, где ответ был
 * НЕОТЛИЧИМ от настоящего сохранения. Самое тяжёлое — личное сообщение:
 * человек видит письмо отправленным, и при следующей выкатке его нет ни у
 * отправителя, ни у получателя.
 *
 * Цена ошибки не равна размеру кода: `memDMs.set(...)` и `memLikes.set(...)` —
 * соседние строки одного файла, но теряется разное.
 *
 * Проверяем исходник, а не поведение: класс дефекта именно в том, что две
 * ветки возвращают неразличимое, и это видно в тексте.
 */

const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "qsocial.ts"), "utf8"));

/**
 * Ответы ЗАПИСИ без признака хранилища.
 *
 * Различать запись и чтение по тексту нельзя: у `GET /posts/:id` и
 * `PATCH /posts/:id` ответ совпадает дословно — `return res.json({ post });`.
 * Поэтому смотрим на метод ближайшего маршрута выше по файлу.
 *
 * Чтения намеренно не требуют признака: класс, который здесь стерегут, — это
 * ложное «сохранено». Показать данные из памяти тоже неидеально, но это другой
 * разговор и другая правка.
 */
function unmarkedWrites(): string[] {
  const lines = SRC.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!/^return res\.(status\(20[01]\)\.)?json\(\{/.test(t)) continue;
    if (!/\b(post|comment|message|story|liked|following)\b/.test(t)) continue;
    if (/storage:/.test(t)) continue;
    let method: string | null = null;
    for (let j = i; j >= 0 && j > i - 80; j--) {
      const m = /qsocialRouter\.(get|post|patch|put|delete)\(/.exec(lines[j]);
      if (m) { method = m[1]; break; }
    }
    if (method && method !== "get") out.push(`${method.toUpperCase()} · ${t}`);
  }
  return out;
}

describe("QSocial не выдаёт временное хранилище за постоянное", () => {
  test("контроль: обе ветки записи на месте", () => {
    expect(SRC).toContain("isQSocialDbReady()");
    expect(SRC).toContain("memDMs.set");
    expect(SRC).toContain("memPosts.set");
  });

  test("контроль: проверка умеет находить непомеченный ответ", () => {
    // Иначе список пустых находок ничего не значил бы.
    const probe = 'return res.status(201).json({ post });';
    expect(/^return res\.(status\(20[01]\)\.)?json\(\{/.test(probe)).toBe(true);
    expect(/storage:/.test(probe)).toBe(false);
  });

  test("ни один ответ записи не молчит о хранилище", () => {
    expect(
      unmarkedWrites(),
      "ответ снова неотличим от настоящего сохранения — человек не узнает, что запись временная",
    ).toEqual([]);
  });

  test("личное сообщение помечено в обеих ветках", () => {
    // Отдельно, потому что это самое дорогое место файла.
    expect(SRC).toMatch(/message: msg, storage: "db"/);
    expect(SRC).toMatch(/message: msg, storage: "memory"/);
  });
});
