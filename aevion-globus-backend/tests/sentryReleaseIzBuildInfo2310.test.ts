import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * 23.10.2026: события бэка в Sentry шли без поля release (оба init брали SENTRY_RELEASE,
 * которой на Railway нет). Теперь release выводится из build-info.json — той же отметки,
 * что отдаёт /health. Сторож проверяет и чистую функцию, и то, что ОБА Sentry.init
 * (qsignV2/sentry.ts — настоящий, lib/sentry.ts — запасной) передают release в SDK.
 */

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb: (s: any) => void) => cb({ setExtra: vi.fn(), setTag: vi.fn(), setExtras: vi.fn() })),
  flush: vi.fn().mockResolvedValue(true),
}));
vi.mock("@sentry/node", () => sentryMocks);

const buildMocks = vi.hoisted(() => ({ commit: "abc123def456" }));
vi.mock("../src/lib/buildInfo", () => ({
  readBuildInfo: () => ({ commit: buildMocks.commit, source: "build-info", branch: "test", builtAt: null, deploymentId: null }),
}));

describe("resolveSentryRelease — версия для Sentry из build-info", () => {
  it("без SENTRY_RELEASE берёт коммит из build-info с префиксом службы", async () => {
    const { resolveSentryRelease, SENTRY_RELEASE_PREFIX } = await import("../src/lib/sentryRelease");
    expect(resolveSentryRelease({} as NodeJS.ProcessEnv, () => ({ commit: "598f4fd61a2b" }))).toBe(`${SENTRY_RELEASE_PREFIX}598f4fd61a2b`);
  });

  it("явная SENTRY_RELEASE сильнее build-info", async () => {
    const { resolveSentryRelease } = await import("../src/lib/sentryRelease");
    expect(resolveSentryRelease({ SENTRY_RELEASE: " v-явная " } as NodeJS.ProcessEnv, () => ({ commit: "598f4fd61a2b" }))).toBe("v-явная");
  });

  it("commit=unknown, пустой или падение readBuildInfo → undefined, а не «unknown»", async () => {
    const { resolveSentryRelease } = await import("../src/lib/sentryRelease");
    expect(resolveSentryRelease({} as NodeJS.ProcessEnv, () => ({ commit: "unknown" }))).toBeUndefined();
    expect(resolveSentryRelease({} as NodeJS.ProcessEnv, () => ({ commit: "" }))).toBeUndefined();
    expect(resolveSentryRelease({} as NodeJS.ProcessEnv, () => { throw new Error("нет файла"); })).toBeUndefined();
  });
});

describe("оба Sentry.init получают release из build-info", () => {
  const было = { DSN: process.env.SENTRY_DSN, REL: process.env.SENTRY_RELEASE };
  beforeEach(() => {
    vi.resetModules();
    sentryMocks.init.mockClear();
    process.env.SENTRY_DSN = "https://ключ@o1.ingest.sentry.io/1";
    delete process.env.SENTRY_RELEASE;
  });
  afterEach(() => {
    if (было.DSN === undefined) delete process.env.SENTRY_DSN; else process.env.SENTRY_DSN = было.DSN;
    if (было.REL === undefined) delete process.env.SENTRY_RELEASE; else process.env.SENTRY_RELEASE = было.REL;
  });

  it("qsignV2/sentry.ts (настоящий init из src/index.ts): release = aevion-globus-backend@<commit>", async () => {
    const m = await import("../src/lib/qsignV2/sentry");
    expect(m.initSentry()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);
    const opts = sentryMocks.init.mock.calls[0][0] as Record<string, unknown>;
    expect(opts.release).toBe("aevion-globus-backend@abc123def456");
    expect(opts.dsn).toBe(process.env.SENTRY_DSN);
  });

  it("lib/sentry.ts (запасной init через require): тот же release", async () => {
    // Этот модуль берёт SDK через require(), мимо vi.mock — шпионим за настоящим CJS-модулем,
    // тем же объектом, что получит require внутри lib/sentry.ts (общий кэш require).
    const { createRequire } = await import("node:module");
    const real = createRequire(__filename)("@sentry/node") as { init: (o: Record<string, unknown>) => void };
    const spy = vi.spyOn(real, "init").mockImplementation(() => undefined);
    try {
      const m = await import("../src/lib/sentry");
      m.initSentry();
      expect(spy).toHaveBeenCalledTimes(1);
      const opts = spy.mock.calls[0][0] as Record<string, unknown>;
      expect(opts.release).toBe("aevion-globus-backend@abc123def456");
    } finally {
      spy.mockRestore();
    }
  });

  it("КОНТРОЛЬ: с SENTRY_RELEASE в окружении init получает её, а не build-info", async () => {
    process.env.SENTRY_RELEASE = "ручная-метка";
    const m = await import("../src/lib/qsignV2/sentry");
    m.initSentry();
    expect((sentryMocks.init.mock.calls[0][0] as Record<string, unknown>).release).toBe("ручная-метка");
  });
});
