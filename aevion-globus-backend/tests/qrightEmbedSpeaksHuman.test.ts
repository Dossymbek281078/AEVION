import { describe, test, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

/**
 * Врезка провенанса — лицо для ВНЕШНЕГО проверяющего: по verifyUrl пойдут
 * люди с Show HN. Замер 07.09 браузером: страница была сырым JSON-дампом
 * (contentType application/json, ни стилей, ни заголовка). Теперь браузеру
 * (ЯВНЫЙ Accept: text/html) отдаётся самодостаточная HTML-страница; всем
 * остальным — прежний JSON: curl/urllib шлют wildcard-Accept или ничего, машинные
 * потребители (включая живые пробы) не ломаются. Тест держит ОБЕ стороны
 * контракта и отзыв в HTML.
 */

const h = vi.hoisted(() => ({ revokedAt: null as string | null }));
const HASH = "b".repeat(64);

vi.mock("../src/lib/dbPool", () => ({
  isDbConfigured: () => true,
  getPool: () => ({
    query: async (sql?: string) => {
      const s = String(sql ?? "");
      if (!s.includes("QRightObject")) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          id: "obj-h",
          title: "DevHub AI generation — пример",
          kind: "code",
          contentHash: HASH,
          ownerName: null, country: null, city: null,
          createdAt: new Date("2026-09-07T04:00:00Z"),
          revokedAt: h.revokedAt ? new Date(h.revokedAt) : null,
          revokeReason: h.revokedAt ? "test revoke" : null,
          revokeReasonCode: h.revokedAt ? "owner_request" : null,
          certificateId: null,
        }],
        rowCount: 1,
      };
    },
  }),
}));
vi.mock("../src/lib/ensureQRightTable", () => ({ ensureQRightTable: async () => {} }));

import { qrightRouter } from "../src/routes/qright";

function app() {
  const a = express();
  a.use(express.json());
  a.use("/x", qrightRouter);
  return a;
}

describe("врезка провенанса говорит с человеком по-человечески", () => {
  test("браузер (Accept: text/html) получает страницу: статус, хеш, честная оговорка", async () => {
    const r = await request(app()).get("/x/embed/obj-h").set("Accept", "text/html,application/xhtml+xml");
    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.text).toContain("REGISTERED");
    expect(r.text).toContain(HASH);
    expect(r.text, "оговорка «содержимое не публикуется» — часть честности").toContain("never published");
    expect(r.text, "русская подстрока для местного проверяющего").toContain("промпт не публикуются");
  });

  test("curl-подобный Accept */* получает ПРЕЖНИЙ JSON — машины не сломаны", async () => {
    const r = await request(app()).get("/x/embed/obj-h").set("Accept", "*/*");
    expect(r.headers["content-type"]).toContain("application/json");
    expect(r.body.contentHash).toBe(HASH);
    expect(r.body.status).toBe("registered");
  });

  test("отзыв в HTML показан отзывом (парность — как у JSON-собрата)", async () => {
    h.revokedAt = "2026-09-07T05:00:00Z";
    try {
      const r = await request(app()).get("/x/embed/obj-h").set("Accept", "text/html");
      expect(r.text).toContain("REVOKED");
      expect(r.text).toContain("test revoke");
      expect(r.text, "REGISTERED не должен светиться на отозванном").not.toContain(">REGISTERED<");
    } finally {
      h.revokedAt = null;
    }
  });
});
