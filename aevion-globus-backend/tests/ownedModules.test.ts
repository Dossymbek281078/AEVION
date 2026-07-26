import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Слияние двух сторов покупок: подписки (`data/subscriptions.jsonl`) и покупки
 * одиночных приложений (`AppSubscription` в Postgres).
 *
 * Живой прогон на настоящем Postgres это уже подтвердил, но в сюите такого
 * теста не было — то есть регрессия «веер снова слеп к поштучным покупкам»
 * прошла бы незамеченной до следующего ручного прогона. Базу здесь подменяем
 * (`vi.mock` на dbPool), потому что проверяем логику слияния и маппинг слагов,
 * а не SQL.
 */

const TMP = mkdtempSync(join(tmpdir(), "aevion-owned-"));
process.env.SUBSCRIPTIONS_FILE = join(TMP, "subscriptions.jsonl");
delete process.env.RESEND_API_KEY;

/** Управляемый ответ «базы» — каждый тест ставит свой. */
const dbState: { rows: Array<{ appSlug: string }>; fail: boolean } = { rows: [], fail: false };

vi.mock("../src/lib/dbPool", () => ({
  getPool: () => ({
    query: async () => {
      if (dbState.fail) throw new Error("connection refused (тестовая имитация)");
      return { rows: dbState.rows, rowCount: dbState.rows.length };
    },
  }),
}));

import { readOwnedModules } from "../src/lib/ownedModules";
import { provisionSubscription } from "../src/routes/provisioning";

afterAll(() => rmSync(TMP, { recursive: true, force: true }));

beforeEach(() => {
  dbState.rows = [];
  dbState.fail = false;
});

describe("readOwnedModules — два стора, один ответ", () => {
  test("модули подписки и поштучные покупки объединяются без дублей", async () => {
    const email = "both@test.aevion.dev";
    await provisionSubscription({
      email, tierId: "lite", period: "monthly", modules: ["qsign"], source: "ls",
    });
    // qsign куплен и подпиской, и отдельно — в ответе должен быть один раз.
    dbState.rows = [{ appSlug: "cyberchess" }, { appSlug: "ip_bureau" }, { appSlug: "qsign" }];

    const owned = await readOwnedModules(email);
    expect(owned.appsSource).toBe("db");
    expect(owned.tierId).toBe("lite");
    expect([...owned.modules].sort()).toEqual(["aevion-ip-bureau", "cyberchess", "qsign"]);
    expect(owned.modules.filter((m) => m === "qsign")).toHaveLength(1);
    expect(owned.fanAnchorAt).toBeTruthy();
  });

  test("слаги переводятся в id прайса, а не подставляются как есть", async () => {
    dbState.rows = [{ appSlug: "qpaynet" }, { appSlug: "smeta" }, { appSlug: "ip_bureau" }];
    const owned = await readOwnedModules("slugs@test.aevion.dev");
    expect([...owned.modules].sort()).toEqual([
      "aevion-ip-bureau", "qpaynet-embedded", "smeta-trainer",
    ]);
  });

  test("неизвестный слаг не роняет ответ и не попадает в модули", async () => {
    dbState.rows = [{ appSlug: "cyberchess" }, { appSlug: "какой-то-новый-модуль" }];
    const owned = await readOwnedModules("unknown@test.aevion.dev");
    expect(owned.modules).toEqual(["cyberchess"]);
    expect(owned.appsSource).toBe("db");
  });

  test("🔴 недоступная база помечается честно, а не выдаётся за «покупок нет»", async () => {
    // Именно это отличие спасает панель от тупика: клиент должен различать
    // «покупок нет» и «мы не смогли проверить».
    dbState.fail = true;
    const owned = await readOwnedModules("dberror@test.aevion.dev");
    expect(owned.appsSource).toBe("unavailable");
    expect(owned.modules).toEqual([]);
  });

  test("покупатель без подписки, но с поштучными покупками — не пустой", async () => {
    // Раньше такой человек получал «веер включается после первой покупки».
    dbState.rows = [{ appSlug: "cyberchess" }, { appSlug: "qventure" }];
    const owned = await readOwnedModules("appsonly@test.aevion.dev");
    expect(owned.tierId).toBe("free");
    expect(owned.subscriptionSince).toBeNull();
    expect([...owned.modules].sort()).toEqual(["cyberchess", "qventure"]);
    expect(owned.appModules).toHaveLength(2);
  });
});
