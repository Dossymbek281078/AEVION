import { describe, test, expect, vi } from "vitest";
import request from "supertest";
import express from "express";

// Ворота 4 живьём (07.09): PUT files/:filepath принимал «../../evil.txt» с
// кодом 200 — серверная проверка была СЛАБЕЕ клиентской (§15). Побега в ФС
// не было (выкатка отбрасывает такие пути с видимым skipped), но дверь
// обязана отказывать сразу и словами. Тест держит обе стороны: мусор — 400,
// нормальный вложенный путь — проходит.

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock("../src/lib/ensureDevHubTables", () => ({
  ensureDevHubTables: vi.fn().mockResolvedValue(undefined),
  isDevHubDbReady: () => false,
}));

async function app() {
  process.env.AUTH_JWT_SECRET = "test-secret-for-path-door-long-enough";
  const { devhubRouter } = await import("../src/routes/devhub");
  const a = express();
  a.use(express.json());
  a.use("/api/devhub", devhubRouter);
  return a;
}

describe("дверь пути файла отказывает мусору сама", () => {
  test.each([
    ["../../evil.txt", "выход из каталога"],
    ["a/../b.txt", "скрытый .. в середине"],
    ["/etc/passwd", "ведущий слэш"],
    ["a//b.txt", "пустой сегмент"],
    ["до" + String.fromCharCode(10) + "сле.txt", "управляющий символ"],
  ])("«%s» (%s) → 400 с человеческим текстом", async (плохой) => {
    const a = await app();
    const guest = { "x-devhub-guest": "path-door-guest" };
    const созд = await request(a).post("/api/devhub/projects").set(guest)
      .send({ name: "door", stack: "static" });
    const pid = созд.body.project.id;
    const r = await request(a)
      .put(`/api/devhub/projects/${pid}/files/${encodeURIComponent(плохой)}`)
      .set(guest).send({ content: "x" });
    expect(r.status, `путь «${плохой}» прошёл дверь`).toBe(400);
    expect(String(r.body.error)).toContain("invalid file path");
  });

  test("нормальный вложенный путь проходит (дверь не перетянута)", async () => {
    const a = await app();
    const guest = { "x-devhub-guest": "path-door-guest-ok" };
    const созд = await request(a).post("/api/devhub/projects").set(guest)
      .send({ name: "door ok", stack: "static" });
    const pid = созд.body.project.id;
    const r = await request(a)
      .put(`/api/devhub/projects/${pid}/files/${encodeURIComponent("assets/logo.svg")}`)
      .set(guest).send({ content: "<svg/>" });
    expect(r.status, "честный путь assets/logo.svg отбит — дверь перетянута").toBe(200);
    expect(r.body.file?.path).toBe("assets/logo.svg");
  });
});
