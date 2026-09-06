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

  test("генерация кода метрируется: проверка на входе, списание в помощнике", () => {
    // 05.09.2026: самая дорогая возможность модуля (мультифайловая генерация
    // с vision-входом) не учитывалась вовсе и не отличала free от enterprise.
    expect((src.match(/checkCredit\(userId, "generate"\)/g) || []).length,
      "квота generate не проверяется на всех трёх точках генерации (generate, stream, database/design)")
      .toBeGreaterThanOrEqual(3);
    const helper = src.slice(src.indexOf("async function runProjectGeneration"), src.indexOf("async function runProjectGeneration") + 2500);
    expect(helper.includes('debitQuietly(userId, "generate")'),
      "runProjectGeneration не списывает generate — генерации снова бесплатны").toBe(true);
    expect(src.includes('generate: 30') && src.includes('generate: 1000'),
      "тарифные числа generate пропали из TIER_LIMITS").toBe(true);
  });

  test("шаги workflow не обходят квоты", () => {
    // Те же генерации, отправленные шагами workflow, шли МИМО квот целиком:
    // до 20 генераций/картинок/озвучек за один запрос без единого списания.
    for (const pair of ['code: "generate"', 'image: "image"', 'tts: "tts"', 'music: "music"']) {
      expect(src.includes(pair), `шаг workflow выпал из карты квот: ${pair}`).toBe(true);
    }
    const at = src.indexOf("async function executeWorkflowStep(");
    const wrapper = src.slice(at, at + 1600);
    expect(wrapper.includes("checkCredit(userId, stepCap"), "обёртка шага не проверяет квоту").toBe(true);
    expect(wrapper.includes("debitQuietly(userId, stepCap"), "обёртка шага не списывает квоту").toBe(true);
  });

  test("параллельный батч workflow резервирует квоту СОВОКУПНО до старта", () => {
    // Ревью 06.09: Promise.all по пошаговой проверке давал гонку — пять шагов
    // image разом читали used=9 при лимите 10 и все проходили. Закреплено:
    // оба места параллельного исполнения идут через runWorkflowGroup, который
    // проверяет и списывает сумму ДО батча и возвращает за упавшие шаги.
    const at = src.indexOf("async function runWorkflowGroup(");
    expect(at, "runWorkflowGroup исчез — гонка квот вернулась").toBeGreaterThan(-1);
    const body = src.slice(at, at + 2600);
    expect(body.includes("checkCredit(userId, cap, row.amount)"), "совокупная проверка пропала").toBe(true);
    expect(body.includes("debitQuietly(userId, cap, row.amount)"), "резерв вперёд пропал").toBe(true);
    expect(body.includes("refundQuietly(userId, cap, amount)"), "возврат за упавший шаг пропал").toBe(true);
    expect((src.match(/runWorkflowGroup\(project, userId, steps, group/g) || []).length,
      "не оба места параллельного батча идут через групповое резервирование").toBe(2);
    expect(src.includes("Promise.all(group.map((i) => executeWorkflowStep("),
      "прямой Promise.all по пошаговой проверке вернулся").toBe(false);
  });

  test("рассыльные ручки закрыты dhSendLimit списком", () => {
    // email/sms/whatsapp закрываются не по месту регистрации, а общим
    // devhubRouter.use([...], dhSendLimit()) — проверяем список.
    for (const route of ["/media/email", "/media/email-template-send", "/media/sms", "/media/whatsapp"]) {
      expect(src.includes(`"${route}"`), `${route} выпал из списка dhSendLimit`).toBe(true);
    }
  });
});
