import { describe, test, expect, beforeEach, afterEach } from "vitest";
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
    const info = readBuildInfo();
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
    const info = readBuildInfo();
    // Контроль в обратную сторону: если бы сторож просто требовал «commit !==
    // deploymentId», он был бы зелёным и на сломанном коде. Здесь проверяется,
    // что настоящий коммит ВИДЕН, то есть отметка вообще работает.
    expect(info.commit).toBe("abcdef123456");
    expect(info.deploymentId).toBe("any-deployment");
  });
});
