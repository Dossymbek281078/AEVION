import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Гигиена публичной витрины QBuild: соискателю показываем только то, на что
 * можно откликнуться.
 *
 * Найдено на живом проде 27.07.2026. Публичный фид `GET /api/build/vacancies`
 * исключал лишь `ARCHIVED`, поэтому `CLOSED` доезжал до витрины: закрытая
 * «Маляр-штукатур» (`ae000800`) от старого .ru-аккаунта была закрыта ADMIN'ом
 * 16.07, а отклик по ней предлагался до 27.07.
 *
 * Тот же класс дефекта уже чинили для проектов в PR #661 (исключили `DONE`) —
 * значит это не разовая опечатка, а повторяющаяся ошибка, которой нужен
 * сторож.
 *
 * Проверяем по исходнику намеренно: интеграционный путь требует живой БД, а
 * регресс тут — одна строка SQL-условия.
 */

const SRC = join(process.cwd(), "src", "routes", "build");

function read(file: string): string {
  return readFileSync(join(SRC, file), "utf8");
}

/** Тело обработчика `GET /` — от маршрута до следующего `Router.get/post`. */
function crossProjectFeed(source: string): string {
  const start = source.indexOf('vacanciesRouter.get("/",');
  expect(start, "не найден обработчик кросс-проектного фида вакансий").toBeGreaterThan(-1);
  const rest = source.slice(start + 10);
  const nextRoute = rest.search(/vacanciesRouter\.(get|post|patch|delete)\(/);
  return nextRoute === -1 ? rest : rest.slice(0, nextRoute);
}

describe("публичный фид вакансий отдаёт только OPEN", () => {
  const feed = crossProjectFeed(read("vacancies.ts"));

  it("фильтр по умолчанию — именно OPEN, а не список исключений", () => {
    // Положительное условие важнее списка исключений: любой новый
    // «неактивный» статус не просочится на витрину сам собой.
    expect(feed).toMatch(/v\."status"\s*=\s*'OPEN'/);
  });

  it("в дефолтной ветке не осталось фильтра-исключения по ARCHIVED", () => {
    // Именно он и пропускал CLOSED.
    expect(feed).not.toMatch(/v\."status"\s*<>\s*'ARCHIVED'/);
  });

  it("вакансии завершённых проектов тоже скрыты", () => {
    // Иначе роль ведёт на проект, которого на витрине нет: фид проектов
    // скрывает DONE с #661. Сегодня это незаметно по случайности —
    // единственный DONE-проект держит закрытую вакансию.
    expect(feed).toMatch(/p\."status"\s*<>\s*'DONE'/);
  });

  it("явный ?projectStatus= по-прежнему поддержан", () => {
    expect(feed).toMatch(/req\.query\.projectStatus/);
  });

  it("явный ?status= по-прежнему поддержан — рекрутёр видит свои закрытые", () => {
    expect(feed).toMatch(/req\.query\.status/);
    expect(feed).toMatch(/v\."status" = \$\$?\{params\.length\}|v\."status" = \$/);
  });
});

describe("публичный фид проектов не показывает завершённые (регресс #661)", () => {
  it("DONE исключён", () => {
    const projects = read("projects.ts");
    expect(projects).toMatch(/"status"\s*<>\s*'DONE'/);
  });
});
