import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "src", "routes", "constitutionWaitlist.ts"),
  "utf8",
);

/**
 * Предел подписки считает ЧЕЛОВЕКА, а не узел платформы.
 *
 * Замер 28.08.2026 на живом проде: пять быстрых подписок → 201, 201, 201, 429,
 * 429. Предел работал, но ключом был адрес, а адрес до нас не доходит —
 * платформа подставляет один из ~7 своих внутренних. Значит «три в минуту»
 * означало три на ВСЕХ за одним узлом: в день запуска, когда люди приходят
 * пачкой, большинство получило бы отказ вместо подтверждения.
 */
describe("подписку ограничиваем по человеку, а не по узлу", () => {
  test("ключ строится из адреса ПОЧТЫ", () => {
    const at = SRC.indexOf("const writeLimit");
    expect(at).toBeGreaterThan(-1);
    const block = SRC.slice(at, at + 900);
    expect(block).toContain("mail:${email}");
  });

  test("общий потолок оставлен — суммарный расход писем не вырос", () => {
    // Раньше защита давала 3/мин на каждый из ~7 внутренних адресов, то есть
    // до ~21 в минуту на платформу. Потолок 20 сохраняет тот же порядок.
    const at = SRC.indexOf("const writeCeiling");
    expect(at, "потолка нет: раздача по людям без него увеличила бы расход").toBeGreaterThan(-1);
    expect(SRC.slice(at, at + 400)).toContain("max: 20");
  });

  test("потолок стоит ПЕРЕД пределом по человеку", () => {
    const mount = SRC.indexOf('"/subscribe"');
    const tail = SRC.slice(mount, mount + 300);
    expect(tail.indexOf("writeCeiling")).toBeGreaterThan(-1);
    expect(tail.indexOf("writeCeiling")).toBeLessThan(tail.indexOf("writeLimit"));
  });
});
