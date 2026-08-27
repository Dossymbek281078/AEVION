import { describe, test, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Отметка сборки читает ФАЙЛ, а переменные — только запасным путём. 19.08.2026.
//
// 14.08 отметку ставили переменной сервиса, и она пережила чужую выкатку: образ
// сменился целиком, переменная осталась, /health продолжил называть чужой
// коммит. Переменную из Railway удалили, но код, читавший её ПЕРВОЙ, остался —
// и обнаружился на проде 19.08. Он безвреден лишь пока переменной нет.
//
// Проверка текстовая по исходнику, и это сказано прямо, а не выдано за
// поведенческую: поднять index.ts в тесте нельзя — он тянет весь сервер с
// планировщиками и внешними ключами.

// Читатель отметки вынесен из index.ts в lib/buildInfo 27.08.2026: то же
// самое поле commit заполнял ещё и routes/qreal.ts, но ИЗ ПЕРЕМЕННОЙ
// окружения — на выкатке папкой она не ставится, и поле было null всегда.
// Правило этот сторож стережёт прежнее, изменился только адрес.
const SRC = path.join(__dirname, "..", "src", "lib", "buildInfo.ts");

function readBuildInfoBody(): string {
  const src = fs.readFileSync(SRC, "utf-8");
  const start = src.indexOf("function readBuildInfo(");
  expect(start).toBeGreaterThan(-1);
  // до конца функции: ищем строку "^}" после начала
  const rest = src.slice(start);
  const end = rest.indexOf("\n}\n");
  return rest.slice(0, end > 0 ? end : 4000);
}

afterEach(() => {
  /* тест ничего не меняет */
});

describe("порядок источников отметки сборки", () => {
  test("файл читается РАНЬШЕ переменных окружения", () => {
    const body = readBuildInfoBody();
    const fileAt = body.indexOf("build-info.json");
    const envAt = body.indexOf("RAILWAY_GIT_COMMIT_SHA");

    expect(fileAt).toBeGreaterThan(-1);
    expect(envAt).toBeGreaterThan(-1);
    // Именно порядок и есть предмет проверки: обе ветки существуют и в
    // неправильной версии тоже, отличается только очерёдность.
    expect(fileAt).toBeLessThan(envAt);
  });

  test("источник называется честно — есть значения file/env/none", () => {
    const body = readBuildInfoBody();
    // Без пометки источника «правильный ответ» и «случайно совпавший» выглядят
    // одинаково, и разобраться, откуда он взялся, будет неоткуда.
    expect(body).toMatch(/source:\s*"env"/);
    expect(body).toMatch(/source:\s*"none"/);
  });

  test("при отсутствии всего отвечаем unknown, а не выдумываем", () => {
    const body = readBuildInfoBody();
    expect(body).toMatch(/commit:\s*"unknown"/);
  });
});
