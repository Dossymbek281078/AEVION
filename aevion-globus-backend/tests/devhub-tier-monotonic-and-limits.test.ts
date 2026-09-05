import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Два сторожа денежного пути DevHub, оба выведены из настоящих дефектов 05.09.2026:
//
// 1. Тарифы обязаны быть монотонными. У free стояло tts=100000 при pro=30000 —
//    покупка Pro СНИЖАЛА лимит озвучки втрое, и ни один тест этого не видел.
//
// 2. Каждая ручка, зовущая модель или платный сервис, обязана стоять за
//    ограничителем. /projects/:id/generate был ограничен, а его близнец
//    /generate/stream — нет: обход стоил одного слова в URL.

const src = readFileSync(join(__dirname, "..", "src", "routes", "devhub.ts"), "utf8");

describe("тарифы DevHub монотонны: платящий не получает меньше бесплатного", () => {
  // Разбираем TIER_LIMITS из исходника, чтобы сторож не разошёлся с кодом.
  function tierRow(name: string): Record<string, number> {
    const m = src.match(new RegExp(name + ":\\s*\\{([^}]+)\\}"));
    expect(m, `строка тарифа ${name} не найдена в TIER_LIMITS`).toBeTruthy();
    const row: Record<string, number> = {};
    for (const part of m![1].split(",")) {
      const [k, v] = part.split(":").map((s) => s.trim());
      if (k && v !== undefined) row[k] = Number(v);
    }
    return row;
  }
  const INF = Number.MAX_SAFE_INTEGER;
  const norm = (n: number) => (n === -1 ? INF : n);

  test("free ≤ pro ≤ enterprise по каждой возможности", () => {
    const free = tierRow("free");
    const pro = tierRow("pro");
    const ent = tierRow("enterprise");
    expect(Object.keys(free).length, "TIER_LIMITS.free не разобрался").toBeGreaterThan(3);
    for (const cap of Object.keys(free)) {
      expect(norm(pro[cap]), `pro.${cap} меньше free.${cap} — покупка снижает лимит`)
        .toBeGreaterThanOrEqual(norm(free[cap]));
      expect(norm(ent[cap]), `enterprise.${cap} меньше pro.${cap}`)
        .toBeGreaterThanOrEqual(norm(pro[cap]));
    }
  });
});

describe("платные ручки DevHub стоят за ограничителем", () => {
  // Ручки, зовущие модель или платный внешний сервис. Список пополняется
  // при добавлении ручек; сторож упадёт и на ручке, снятой с ограничителя.
  const COSTLY_POSTS = [
    "/ask",
    "/projects/:id/generate",
    "/projects/:id/generate/stream",
    "/projects/:id/database/design",
    "/plan",
    "/projects/:id/agent/workflow",
    "/projects/:id/agent/workflow/stream",
    "/media/sfx",
    "/media/voice-clone",
    "/media/voice-clone/preview",
    "/media/stt",
    "/media/translate",
    "/projects/:id/files/translate",
    "/projects/:id/files/translate-bulk",
    "/projects/:id/drive/import",
    "/media/email-template-create",
    "/media/payment-link",
    "/media/drive-search",
    "/media/upload-image",
    "/media/upload-audio",
  ];

  for (const route of COSTLY_POSTS) {
    test(`POST ${route} — с ограничителем`, () => {
      const reg = `devhubRouter.post("${route}",`;
      const at = src.indexOf(reg);
      expect(at, `регистрация ${route} не найдена — ручку переименовали?`).toBeGreaterThan(-1);
      // Между регистрацией пути и телом обработчика должен стоять лимитер.
      const head = src.slice(at, src.indexOf("=>", at));
      const guarded = head.includes("dhCostlyLimit(") || head.includes("dhSendLimit(");
      expect(guarded, `POST ${route} зовёт платный сервис без ограничителя`).toBe(true);
    });
  }

  test("рассыльные ручки закрыты dhSendLimit списком", () => {
    // email/sms/whatsapp закрываются не по месту регистрации, а общим
    // devhubRouter.use([...], dhSendLimit()) — проверяем список.
    for (const route of ["/media/email", "/media/email-template-send", "/media/sms", "/media/whatsapp"]) {
      expect(src.includes(`"${route}"`), `${route} выпал из списка dhSendLimit`).toBe(true);
    }
  });
});
