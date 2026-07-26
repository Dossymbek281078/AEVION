import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Список типов событий продублирован по обе стороны: `EventType` во
 * `frontend/src/lib/track.ts` и `ALLOWED_TYPES` в `src/routes/events.ts`.
 * Бэкенд молча отбрасывает неизвестный тип — то есть при расхождении фронт
 * «отправляет аналитику», её никто не пишет, и обнаружится это только когда
 * кто-то придёт за цифрами и не найдёт их. Ровно тот класс: не падает, а тихо
 * работает неправильно.
 *
 * Тест читает ОБА файла и требует совпадения. Дубль списков — не идеал (лучше
 * один источник), но выносить его в общий пакет ради 20 строк дороже, чем
 * держать эту проверку.
 */

const ROOT = join(__dirname, "..");

function backendTypes(): Set<string> {
  const src = readFileSync(join(ROOT, "src", "routes", "events.ts"), "utf8");
  const block = src.slice(src.indexOf("const ALLOWED_TYPES"), src.indexOf("function rateLimitKey"));
  const stripped = block.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...stripped.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

function frontendTypes(): Set<string> {
  const src = readFileSync(join(ROOT, "..", "frontend", "src", "lib", "track.ts"), "utf8");
  const block = src.slice(src.indexOf("export type EventType"), src.indexOf("export interface TrackPayload"));
  const stripped = block.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return new Set([...stripped.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

describe("типы аналитических событий: фронт == бэкенд", () => {
  test("оба файла читаются и списки непустые (иначе тест бессмысленен)", () => {
    // Защита от «зелёный, потому что распарсили пустоту».
    expect(backendTypes().size).toBeGreaterThan(10);
    expect(frontendTypes().size).toBeGreaterThan(10);
  });

  test("нет типов, которые фронт отправляет, а бэкенд отбрасывает", () => {
    const back = backendTypes();
    const orphans = [...frontendTypes()].filter((t) => !back.has(t));
    expect(orphans).toEqual([]);
  });

  test("нет типов, которые бэкенд принимает, а фронт никогда не пошлёт", () => {
    // Не ошибка, но верный признак мёртвой разметки — держим списки равными.
    const front = frontendTypes();
    const unused = [...backendTypes()].filter((t) => !front.has(t));
    expect(unused).toEqual([]);
  });

  test("веерные события заведены с обеих сторон", () => {
    const back = backendTypes();
    const front = frontendTypes();
    for (const t of ["fan_view", "fan_owned_pick", "fan_offer_click", "fan_terms_open"]) {
      expect(back.has(t), `бэкенд не знает ${t}`).toBe(true);
      expect(front.has(t), `фронт не знает ${t}`).toBe(true);
    }
  });
});
