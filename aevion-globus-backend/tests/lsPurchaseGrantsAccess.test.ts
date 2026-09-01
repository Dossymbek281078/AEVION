import { describe, test, expect, vi, beforeEach, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Сквозная проверка ВТОРОЙ кассы: Lemon Squeezy — оплатил → получил доступ.
 *
 * ЗАЧЕМ отдельным файлом. Проверка для PayBox уже есть, но одна касса из
 * четырёх — это «хотя бы один»: сломается путь у LS, и тот тест останется
 * зелёным. А через LS идут международные покупатели, то есть на запуске
 * 10 сентября это не запасной путь, а основной для половины аудитории.
 *
 * Подменена только подпись провайдера? Нет — подпись НАСТОЯЩАЯ: секрет свой,
 * HMAC считается тем же способом, что и на проде. Подменять здесь нечего:
 * вебхук проверяет подпись сам, и это часть пути, которую стоит проверить.
 */

const каталог = mkdtempSync(join(tmpdir(), "aevion-ls-"));
process.env.SUBSCRIPTIONS_FILE = join(каталог, "subscriptions.jsonl");
process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "секрет-для-теста-32-символа-минимум-длины";
process.env.LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY = "99001";
process.env.PAYWALL_MODULES = "multichat-engine";
process.env.AUTH_JWT_SECRET = "тестовый-секрет-достаточной-длины-для-проверки-32+";

vi.mock("../src/lib/sentry/platform", () => ({ makeServiceCapture: () => () => {} }));

const { lemonSqueezyWebhookRouter } = await import("../src/routes/lemonSqueezyWebhook");
const { requireModule, resolvePlanFromPayload, paywallEnabledFor } = await import(
  "../src/lib/planGate"
);
const jwt = (await import("jsonwebtoken")).default;

function приложение() {
  const a = express();
  a.use(express.json({
    verify: (req, _res, buf) => {
      (req as unknown as { rawBody: Buffer }).rawBody = buf;
    },
  }));
  a.use("/api/ls", lemonSqueezyWebhookRouter);
  return a;
}

function закрытоеПриложение() {
  const a = express();
  a.use("/api/multichat-engine", requireModule("multichat-engine"));
  a.get("/api/multichat-engine/ping", (_req, res) => res.json({ ok: true }));
  return a;
}

const токен = (email: string) =>
  jwt.sign({ email, sub: email }, process.env.AUTH_JWT_SECRET as string, {
    algorithm: "HS256",
    expiresIn: "1h",
  });

let счётчик = 0;
async function оплатилЧерезLS(email: string, вариант: string) {
  счётчик += 1;
  const тело = {
    meta: { event_name: "subscription_created", custom_data: {} },
    data: { id: `ls-${счётчик}`, attributes: { user_email: email, variant_id: вариант } },
  };
  const сырое = JSON.stringify(тело);
  // Подпись настоящая: тот же HMAC-SHA256 в hex, что проверяет прод.
  const подпись = createHmac("sha256", process.env.LEMON_SQUEEZY_WEBHOOK_SECRET as string)
    .update(сырое, "utf8")
    .digest("hex");
  return request(приложение())
    .post("/api/ls/webhook")
    .set("Content-Type", "application/json")
    .set("x-signature", подпись)
    .send(сырое);
}

afterAll(() => {
  // Убираем за собой: без этого каждый прогон оставляет каталог в TEMP.
  // Замер 01.09.2026 — за день накопилось 127 штук.
  try { rmSync(каталог, { recursive: true, force: true }); } catch { /* уже нет */ }
  for (const k of [
    "SUBSCRIPTIONS_FILE", "LEMON_SQUEEZY_WEBHOOK_SECRET",
    "LEMON_SQUEEZY_VARIANT_MEDIUM_MONTHLY", "PAYWALL_MODULES", "AUTH_JWT_SECRET",
  ]) delete process.env[k];
});

describe("Lemon Squeezy: оплатил — получил доступ", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  test("контроль: стена включена и доступа без покупки нет", async () => {
    expect(paywallEnabledFor("multichat-engine")).toBe(true);
    const res = await request(закрытоеПриложение()).get("/api/multichat-engine/ping");
    expect(res.status).not.toBe(200);
  });

  test("подделанная подпись доступа НЕ даёт", async () => {
    // Контроль второго рода: если бы вебхук принимал что угодно, «оплата
    // сработала» ничего не значило бы.
    const тело = JSON.stringify({
      meta: { event_name: "subscription_created", custom_data: {} },
      data: { id: "ls-fake", attributes: { user_email: "fake@example.com", variant_id: "99001" } },
    });
    const res = await request(приложение())
      .post("/api/ls/webhook")
      .set("Content-Type", "application/json")
      .set("x-signature", "00".repeat(32))
      .send(тело);
    expect(res.status, "вебхук принял чужую подпись").toBe(401);
    expect(resolvePlanFromPayload({ email: "fake@example.com" }).tier).toBe("free");
  });

  test("оплата medium через LS открывает закрытый модуль", async () => {
    const email = "ls-buyer@example.com";
    const оплата = await оплатилЧерезLS(email, "99001");
    expect(оплата.status, `вебхук отказал: ${JSON.stringify(оплата.body)}`).toBe(200);

    expect(resolvePlanFromPayload({ email }).tier, "оплатил medium, а тариф другой").toBe("medium");

    const res = await request(закрытоеПриложение())
      .get("/api/multichat-engine/ping")
      .set("Authorization", `Bearer ${токен(email)}`);
    expect(res.status, "человек заплатил через LS, а ворота не пускают").toBe(200);
  });
});
