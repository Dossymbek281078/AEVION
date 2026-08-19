import { describe, test, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

/**
 * `/api/bureau/kyc-stub/:sessionId` задумана как страница только для разработки,
 * но условие её выключения fail-open: заглушка прячется, лишь когда задана
 * переменная BUREAU_KYC_PROVIDER. В проде её нет — значит страница открыта всем.
 *
 * В ней было три дыры сразу:
 *   1. `sessionId` из пути попадал в HTML сырым — отражённая XSS;
 *   2. параметр `return` уходил внутрь <script>, и `JSON.stringify` от этого не
 *      спасает: последовательность `</script>` внутри строки всё равно закрывает
 *      блок для HTML-парсера, а остаток пути становится разметкой;
 *   3. тот же `return` не проверялся на относительность — открытый редирект на
 *      чужой домен со страницы нашего домена.
 *
 * Тест проверяет именно ПОВЕДЕНИЕ ответа, а не наличие строчки в коде: в теле
 * не должно быть исполняемой разметки, а адрес перехода обязан остаться нашим.
 */

vi.mock("../src/lib/dbPool", () => ({ getPool: () => ({ query: vi.fn().mockResolvedValue({ rows: [] }) }) }));
vi.mock("../src/lib/ensureUsersTable", () => ({ ensureUsersTable: vi.fn() }));
vi.mock("../src/lib/kyc", () => ({ getKycProvider: () => ({ name: "stub" }) }));
vi.mock("../src/routes/aev", () => ({ internalMintForDevice: vi.fn() }));

// eslint-disable-next-line import/first
import { bureauRouter } from "../src/routes/bureau";


describe("KYC-заглушка: чужой ввод не становится разметкой", () => {
  beforeEach(() => {
    delete process.env.BUREAU_KYC_PROVIDER;
  });

  const app = () => {
    const a = express();
    a.use(bureauRouter);
    return a;
  };

  test("обычный вызов работает (контроль)", async () => {
    const r = await request(app()).get("/kyc-stub/abc123?return=/bureau");
    expect(r.status).toBe(200);
    expect(r.text).toContain("abc123");
    expect(r.text).toContain('"/bureau"');
  });

  test("тег в sessionId не доезжает до страницы живым", async () => {
    const r = await request(app()).get("/kyc-stub/" + encodeURIComponent("<b>жир</b>"));
    expect(r.status).toBe(200);
    // Именно сырой тег. Экранированный (&lt;b&gt;) — это нормально и ожидаемо.
    expect(r.text).not.toContain("<b>");
    expect(r.text).toContain("&lt;b&gt;");
  });

  test("образ script-тега в sessionId не открывает блок", async () => {
    const r = await request(app()).get("/kyc-stub/" + encodeURIComponent("<script>alert(1)</script>"));
    expect(r.status).toBe(200);
    expect(r.text).not.toContain("<script>alert(1)");
  });

  test("закрывающий script в параметре return не разрывает блок", async () => {
    const evil = "/x</script><img src=x onerror=alert(1)>";
    const r = await request(app()).get("/kyc-stub/s1?return=" + encodeURIComponent(evil));
    expect(r.status).toBe(200);
    // Разметка не должна появиться в ответе ни в каком виде.
    expect(r.text).not.toContain("<img src=x");
    expect(r.text).not.toContain("</script><img");
  });

  test("чужой домен в return не становится адресом перехода", async () => {
    for (const evil of ["https://evil.example.com/steal", "//evil.example.com", "\\evil.example.com"]) {
      const r = await request(app()).get("/kyc-stub/s2?return=" + encodeURIComponent(evil));
      expect(r.status).toBe(200);
      expect(r.text).not.toContain("evil.example.com");
      // Должен остаться наш относительный адрес.
      expect(r.text).toContain('"/bureau"');
    }
  });
});
