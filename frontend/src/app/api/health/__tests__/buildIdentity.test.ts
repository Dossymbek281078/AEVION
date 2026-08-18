import { describe, test, expect, beforeEach, afterAll } from "vitest";

/**
 * Сайт должен уметь назвать свой код.
 *
 * В /api/health лежало поле `version: "v1.3"` — зашитая строка. Она выглядит
 * заполненной и не отвечает ни на что: по ней нельзя сказать, чья выкатка
 * сейчас на сайте. У бэкенда ровно эта дыра 14.08.2026 стоила половины дня —
 * `/health` отвечал "unknown", а выкатывали его семь сессий подряд, и каждая
 * заменяла предыдущую целиком. Фронт правят как минимум три ветки, и до
 * 18.08.2026 опознать его было нечем.
 *
 * Тест держит два условия: метка читается из окружения (а не подставляется
 * постоянной) и честно говорит "unknown", когда окружения нет. Второе важнее
 * первого: выдуманной метке верят, отсутствующей — нет.
 */

const KEYS = ["VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_REF", "VERCEL_ENV", "VERCEL_DEPLOYMENT_ID"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterAll(() => {
  // Возвращаем окружение: иначе соседние файлы в том же процессе увидят чужое
  // состояние, и падение поедет по набору без видимой причины.
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k] as string;
  }
});

async function health() {
  const mod = await import("../route");
  const res = await mod.GET();
  return (await res.json()) as { build?: { commit: string; branch: string; env: string; deploymentId: string | null } };
}

describe("health сайта называет свою сборку", () => {
  test("метки нет — говорит unknown, а не молчит и не выдумывает", async () => {
    const j = await health();

    expect(j.build, "поля build нет вовсе — опознать сайт нечем").toBeTruthy();
    expect(j.build?.commit).toBe("unknown");
    expect(j.build?.branch).toBe("unknown");
    expect(j.build?.env).toBe("local");
    expect(j.build?.deploymentId).toBeNull();
  });

  test("метка есть — отдаёт её, а не постоянную", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "abcdef0123456789";
    process.env.VERCEL_GIT_COMMIT_REF = "deploy/combined-2026-08-14";
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_DEPLOYMENT_ID = "dpl_test123";

    const j = await health();

    expect(j.build?.commit).toBe("abcdef012345");
    expect(j.build?.branch).toBe("deploy/combined-2026-08-14");
    expect(j.build?.env).toBe("production");
    expect(j.build?.deploymentId).toBe("dpl_test123");
  });

  test("контроль: два разных окружения дают два разных ответа", async () => {
    // Иначе тест прошёл бы и на коде, который просто возвращает постоянную.
    process.env.VERCEL_GIT_COMMIT_SHA = "1111111111111111";
    const a = await health();
    process.env.VERCEL_GIT_COMMIT_SHA = "2222222222222222";
    const b = await health();

    expect(a.build?.commit).toBe("111111111111");
    expect(b.build?.commit).toBe("222222222222");
  });
});

describe("отметка внутри сборки главнее переменных", () => {
  test("когда buildStamp заполнен, он и отвечает", async () => {
    // Переменные Vercel живут в ПРОЕКТЕ и переживают чужую выкатку: на Railway
    // ровно это привело к тому, что /health уверенно называл коммит, которого
    // на проде уже не было. Поэтому первым спрашиваем то, что уехало внутри
    // артефакта.
    vi.resetModules();
    vi.doMock("@/lib/buildStamp", () => ({
      BUILD_STAMP: { commit: "aaaaaaaaaaaa", branch: "deploy/test", builtAt: "2026-08-18T00:00:00Z" },
    }));
    process.env.VERCEL_GIT_COMMIT_SHA = "bbbbbbbbbbbbbbbb";
    process.env.VERCEL_GIT_COMMIT_REF = "other-branch";

    const mod = await import("../route");
    const j = (await (await mod.GET()).json()) as { build?: { commit: string; branch: string; builtAt: string | null } };

    expect(j.build?.commit).toBe("aaaaaaaaaaaa");
    expect(j.build?.branch).toBe("deploy/test");
    expect(j.build?.builtAt).toBe("2026-08-18T00:00:00Z");
    vi.doUnmock("@/lib/buildStamp");
    vi.resetModules();
  });
});
