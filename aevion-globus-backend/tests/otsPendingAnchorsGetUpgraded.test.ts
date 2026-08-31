import { describe, test, expect, vi, beforeEach } from "vitest";

/**
 * Якорь в биткойне подтверждался сам, а сертификат об этом не узнавал.
 *
 * Замер 28.08.2026: `upgradeProof` вызывался РОВНО В ОДНОМ месте — в ручке
 * POST /api/pipeline/ots/:certId/upgrade, то есть только когда автор сам
 * вернётся на страницу и нажмёт кнопку. Ни расписания, ни фоновой задачи, ни
 * workflow. Сертификат оставался `pending` бессрочно, хотя календарь своё дело
 * сделал и доказательство было готово.
 *
 * Проверяется не «функция существует», а поведение прохода:
 *   — берутся только «остывшие» pending с готовым доказательством;
 *   — подтверждённое СОХРАНЯЕТСЯ (иначе следующий проход спросит заново);
 *   — сбой на одном сертификате не отменяет остальные и не выдаётся за успех;
 *   — мусор в настройках не превращается в NaN и не доезжает до SQL.
 */

type Q = { sql: string; params?: unknown[] };
let queries: Q[] = [];
let selectRows: Array<{ id: string; otsProof: Buffer | null }> = [];
/** Уронить СЛЕДУЮЩЕЕ чтение очереди. Флагом, а не подменой объекта: модуль
 *  берёт пул один раз при импорте, и повторный getPool() ему уже не виден. */
let failNextSelect = false;
let upgradeImpl: (p: Buffer) => Promise<Record<string, unknown>>;

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push({ sql: String(sql), params });
      if (String(sql).includes('FROM "IPCertificate"')) {
        if (failNextSelect) { failNextSelect = false; throw new Error("база недоступна"); }
        return { rows: selectRows };
      }
      return { rows: [] };
    }),
  }),
}));

vi.mock("../src/lib/opentimestamps/anchor", () => ({
  upgradeProof: vi.fn(async (p: Buffer) => upgradeImpl(p)),
}));

// eslint-disable-next-line import/first
import { sweepPendingAnchors } from "../src/lib/opentimestamps/upgradeWorker";

const PROOF = Buffer.from("proof-bytes");
const NEW_PROOF = Buffer.from("upgraded-proof-bytes");

beforeEach(() => {
  queries = [];
  selectRows = [];
  failNextSelect = false;
  upgradeImpl = async () => ({ upgraded: false, status: "pending", otsProof: null, bitcoinBlockHeight: null, error: null });
});

const updates = () => queries.filter((q) => q.sql.includes("UPDATE"));

describe("фоновое дообновление якорей", () => {
  test("подтверждённый якорь СОХРАНЯЕТСЯ, а не только пересчитывается", async () => {
    selectRows = [{ id: "cert-a", otsProof: PROOF }];
    upgradeImpl = async () => ({
      upgraded: true,
      status: "bitcoin-confirmed",
      otsProof: NEW_PROOF,
      bitcoinBlockHeight: 912345,
      error: null,
    });

    const r = await sweepPendingAnchors();
    expect(r).toMatchObject({ checked: 1, upgraded: 1, stillPending: 0, failed: 0 });

    const u = updates();
    expect(u, "подтверждение не записано — следующий проход спросит календарь заново").toHaveLength(1);
    // Записывается именно НОВОЕ доказательство и высота блока, а не старое.
    expect(u[0].params).toContain(NEW_PROOF);
    expect(u[0].params).toContain(912345);
    expect(u[0].params).toContain("bitcoin-confirmed");
  });

  test("ещё не подтверждено — НИЧЕГО не пишем", async () => {
    selectRows = [{ id: "cert-b", otsProof: PROOF }];
    const r = await sweepPendingAnchors();
    expect(r).toMatchObject({ checked: 1, upgraded: 0, stillPending: 1, failed: 0 });
    expect(updates()).toHaveLength(0);
  });

  test("сбой на одном сертификате не отменяет остальные и не считается успехом", async () => {
    selectRows = [
      { id: "cert-плохой", otsProof: PROOF },
      { id: "cert-хороший", otsProof: PROOF },
    ];
    upgradeImpl = async (p: Buffer) => {
      if (queries.filter((q) => q.sql.includes("UPDATE")).length === 0 && upgradeCalls++ === 0) {
        throw new Error("календарь не ответил");
      }
      return { upgraded: true, status: "bitcoin-confirmed", otsProof: NEW_PROOF, bitcoinBlockHeight: 1, error: null };
    };
    let upgradeCalls = 0;

    const r = await sweepPendingAnchors();
    expect(r.checked).toBe(2);
    expect(r.failed, "сбой проглочен и посчитан успехом").toBe(1);
    expect(r.upgraded, "второй сертификат не обработан после чужого сбоя").toBe(1);
  });

  test("выборка берёт только остывшие pending с готовым доказательством", async () => {
    selectRows = [];
    await sweepPendingAnchors();
    const sel = queries.find((q) => q.sql.includes('FROM "IPCertificate"'));
    expect(sel).toBeDefined();
    const sql = sel!.sql;
    expect(sql).toContain(`"otsStatus" = 'pending'`);
    expect(sql).toContain(`"otsProof" IS NOT NULL`);
    expect(sql).toContain("INTERVAL");
    // Старые первыми: иначе свежие вытесняют застрявшие и те не дообновятся никогда.
    expect(sql).toContain(`ORDER BY "otsStampedAt" ASC`);
  });

  test("предел выборки — параметр, а не склейка строкой", async () => {
    selectRows = [];
    await sweepPendingAnchors();
    const sel = queries.find((q) => q.sql.includes('FROM "IPCertificate"'))!;
    expect(sel.sql).toContain("LIMIT $1");
    expect(typeof sel.params?.[0]).toBe("number");
    expect(Number.isFinite(sel.params?.[0] as number), "предел пришёл как NaN").toBe(true);
  });

  test("неудачное чтение очереди — это НЕ «нечего дообновлять»", async () => {
    // Проход обязан сообщить о неудаче броском, а не вернуть спокойные нули,
    // неотличимые от исправной пустой очереди.
    failNextSelect = true;
    await expect(sweepPendingAnchors()).rejects.toThrow(/база недоступна/);
    // И контроль: сразу после этого исправный проход снова работает —
    // то есть тест проверил ошибку, а не сломал стенд насовсем.
    selectRows = [];
    await expect(sweepPendingAnchors()).resolves.toMatchObject({ checked: 0 });
  });
});
