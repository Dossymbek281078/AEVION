import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { readBuildInfo } from "../src/lib/buildInfo";

/**
 * Идентификатор выкатки Railway не имеет права выдавать себя за коммит.
 *
 * ЗАЧЕМ. 21.09.2026 прод отвечал `commit: "unknown"` — активную сборку сделали
 * не через railway-deploy.sh, и build-info.json в образ не попал. Опознать код
 * стало нечем, и обёртка выкатки остановила ВСЕ окна. Чтобы такую сборку можно
 * было хотя бы найти в панели, в /health добавлено поле `deploymentId`.
 *
 * 🔴 И ровно здесь лежит соблазн, ради которого написан этот сторож: подставить
 * этот идентификатор в поле `commit`, чтобы «не было unknown». Тогда обёртки
 * выкатки получат строку, похожую на ответ, и сравнение с git станет ложью —
 * то есть вернётся ровно тот класс, что 14.08 дал «отметку, пережившую чужую
 * выкатку»: уверенный неправильный ответ вместо честного «не знаю».
 */

const прежние = { ...process.env };

/**
 * Запасной путь через переменную читается ТОЛЬКО когда файла отметки нет:
 * readBuildInfo() предпочитает файл переменным, и это правильно (файл едет
 * внутри образа, переменная принадлежит сервису). А в репозитории по этому пути
 * лежит заглушка — значит проверка запасного пути обязана убрать её на время и
 * вернуть, иначе её исход решает ПОРЯДОК запуска файлов, а не код.
 *
 * Так и было до 05.10.2026: один и тот же код давал красный тест в одном полном
 * прогоне и зелёный в следующем, в зависимости от того, успел ли сосед
 * (buildStampFoundFromAnyDepth) удалить заглушку раньше. Такой тест хуже
 * отсутствующего: он обвиняет невиновную правку.
 */
const ОТМЕТКА = join(__dirname, "..", "build-info.json");

function безЗаглушки<T>(действие: () => T): T {
  const было = existsSync(ОТМЕТКА) ? readFileSync(ОТМЕТКА, "utf-8") : null;
  if (было !== null) unlinkSync(ОТМЕТКА);
  try {
    return действие();
  } finally {
    if (было !== null) writeFileSync(ОТМЕТКА, было, "utf-8");
  }
}

describe("отметка сборки", () => {
  beforeEach(() => {
    delete process.env.RAILWAY_GIT_COMMIT_SHA;
    delete process.env.GIT_SHA;
    delete process.env.SOURCE_VERSION;
  });
  afterEach(() => {
    process.env = { ...прежние };
  });

  test("есть идентификатор выкатки, но нет коммита — commit остаётся честным unknown", () => {
    process.env.RAILWAY_DEPLOYMENT_ID = "dc8527fa-157d-483a-8bb1-e35c9e957b4d";
    // Без заглушки — то есть на том самом пути, где соблазн подставить
    // идентификатор в commit и возникает: тут честный ответ «unknown».
    const info = безЗаглушки(() => readBuildInfo());
    expect(info.deploymentId).toBe("dc8527fa-157d-483a-8bb1-e35c9e957b4d");
    // Главное утверждение сторожа: идентификатор НЕ просочился в коммит.
    expect(info.commit).not.toBe("dc8527fa-157d-483a-8bb1-e35c9e957b4d");
    expect(info.commit).not.toContain("dc8527fa");
  });

  test("нет и идентификатора — поле null, а не пустая строка и не выдумка", () => {
    delete process.env.RAILWAY_DEPLOYMENT_ID;
    expect(readBuildInfo().deploymentId).toBeNull();
  });

  test("переменная сборки из репозитория по-прежнему читается как источник env", () => {
    process.env.RAILWAY_DEPLOYMENT_ID = "any-deployment";
    process.env.RAILWAY_GIT_COMMIT_SHA = "abcdef1234567890";
    // Убираем заглушку на время: с файлом на месте запасной путь не достигается
    // ВООБЩЕ, и тест мерил бы порядок прогона вместо кода.
    const info = безЗаглушки(() => readBuildInfo());
    // Контроль в обратную сторону: если бы сторож просто требовал «commit !==
    // deploymentId», он был бы зелёным и на сломанном коде. Здесь проверяется,
    // что настоящий коммит ВИДЕН, то есть отметка вообще работает.
    expect(info.commit).toBe("abcdef123456");
    expect(info.deploymentId).toBe("any-deployment");
  });
});
