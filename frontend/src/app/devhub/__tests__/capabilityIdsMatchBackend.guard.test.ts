import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Идентификаторы возможностей, которые спрашивает интерфейс, существуют на сервере.
 *
 * Опечатка здесь ОТКАЗЫВАЕТ МОЛЧА: `isCapabilityBlocked` намеренно «падает
 * открытым» — неизвестная возможность считается доступной. То есть кнопка,
 * спрашивающая про `viedo`, выглядит рабочей и ведёт к отказу сервера.
 *
 * Раньше это охранял список, переписанный в тест РУКАМИ. Он и разошёлся:
 * 28.08.2026 выяснилось, что 3D нет среди возможностей вовсе, а интерфейс
 * спрашивает про него под идентификатором `video` — то есть панель «настроено
 * N из 16» о 3D молчала, хотя страница модуля обещает его в списке того, что
 * лежит «в одном проекте». Список, переписанный руками, повторяет ошибку
 * источника: он не проверка, а копия.
 *
 * Здесь идентификаторы читаются из ОБОИХ мест: объявления в бэкенде и вызовы
 * в интерфейсе.
 */

const BACKEND = path.join(
  __dirname, "..", "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);
const IDE = path.join(__dirname, "..", "[id]", "page.tsx");
const MAIN = path.join(__dirname, "..", "page.tsx");

/** Возможности, объявленные сервером в /studio/capabilities. */
function backendIds(): string[] {
  const src = fs.readFileSync(BACKEND, "utf8");
  // Якорь — объявление списка, а не весь файл: `id:` встречается всюду.
  const start = src.indexOf('{ id: "code"');
  const end = src.indexOf("];", start);
  const block = src.slice(start, end);
  return [...block.matchAll(/\{ id: "([a-z0-9_]+)"/g)].map((m) => m[1]);
}

/** Возможности, про которые спрашивает интерфейс. */
function askedIds(): string[] {
  const src = [IDE, MAIN].map((f) => fs.readFileSync(f, "utf8")).join("\n");
  const ids = new Set<string>();
  for (const m of src.matchAll(/(?:isCapabilityBlocked|capabilityHint)\(caps,\s*"([a-z0-9_]+)"/g)) {
    ids.add(m[1]);
  }
  return [...ids].sort();
}

describe("возможности: интерфейс и сервер говорят об одном", () => {
  test("прибор работает: оба файла на месте и списки непустые", () => {
    // Пропавший файл обязан ронять тест, а не давать пустой список: пустое
    // пересечение двух пустых списков — самый спокойный из ложных зелёных.
    expect(fs.existsSync(BACKEND), "исходник бэкенда не найден — сверять не с чем").toBe(true);
    expect(backendIds().length, "список возможностей сервера пуст").toBeGreaterThan(10);
    expect(askedIds().length, "интерфейс ни о чём не спрашивает").toBeGreaterThan(5);
  });

  test("каждый спрошенный идентификатор объявлен сервером", () => {
    const have = new Set(backendIds());
    const missing = askedIds().filter((id) => !have.has(id));
    expect(missing, "интерфейс спрашивает про возможность, которой на сервере нет").toEqual([]);
  });

  test("3D спрашивается под своим именем, а не под именем видео", () => {
    // Ровно та находка, из-за которой сторож и написан.
    expect(backendIds(), "у 3D нет своей возможности").toContain("3d");
    expect(askedIds(), "интерфейс снова спрашивает про 3D чужим идентификатором").toContain("3d");

    // Мутационная проверка показала, что предыдущего утверждения МАЛО: вернув
    // одну из двух точек 3D к идентификатору "video", тест остаётся зелёным —
    // "3d" по-прежнему встречается во второй. Поэтому спрашиваем прямо: ни один
    // вызов про 3D не должен идти под чужим именем.
    const src = [IDE, MAIN].map((f) => fs.readFileSync(f, "utf8")).join("\n");
    const wrong = [
      ...src.matchAll(/(?:isCapabilityBlocked|capabilityHint)\(caps,\s*"([a-z0-9_]+)"\s*(?:,\s*"([^"]*)")?/g),
    ].filter((m) => m[1] !== "3d" && (m[2] ?? "").includes("3D"));
    expect(
      wrong.map((m) => `${m[2]} -> ${m[1]}`),
      "вызов про 3D идёт под чужим идентификатором",
    ).toEqual([]);
  });
});
