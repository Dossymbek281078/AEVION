// Заявка из формы связи обязана ДОХОДИТЬ ДО ЧЕЛОВЕКА, а не только сохраняться.
//
// Зачем именно этот сторож. На 16.09.2026 путь заявки был такой: обработчик
// `/api/pricing/lead` проверял поля, дописывал строку в leads.jsonl и отвечал
// 201 — писем не шлось ни одного. Единственным читателем была суточная сводка
// на ноутбуке. При этом страница `/pricing/[tierId]` обещает во всех трёх
// языках «Customer Success свяжется в течение 24 часов».
//
// Почему этого не видел ни один существующий сторож — дыра лежала в СТЫКЕ:
//   • supportChannelFailsLoudly проверяет, что отказ ЗАПИСИ не выдаётся за
//     принятое обращение — про доставку до человека он не говорит;
//   • applicationsReachAHuman.guard проверяет «дойдёт ли до человека», но по
//     /api/health/channels, и слова lead в нём нет вовсе.
// Оба зелёные и оба правы по своему вопросу. Вопрос «эта заявка кому-нибудь
// доедет?» не задавал никто.
//
// Проверяется СЛЕДСТВИЕ, а не форма: не «помощник вызван», а «письмо ушло на
// настроенный адрес и несёт опознаваемые поля заявки». Проверка формы зелена и
// на сломанной подстановке.

import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.NODE_ENV = "test";

const FILE = join(tmpdir(), "aevion-leads-reach-test.jsonl");
const SAVED_LEADS = process.env.LEADS_FILE;
const SAVED_NOTIFY = process.env.NOTIFY_EMAIL;

/** Что именно ушло бы почтой. Подменяем на уровне sendEmail — того же места,
 *  что и в failedEmailIsVisibleAtTheCallSite: так сторож не зависит от формы
 *  вызова внутри маршрута. */
const { письма, исход } = vi.hoisted(() => ({
  письма: [] as Array<{ to: string; subject: string; text: string }>,
  // Управляемый исход отправки. Флагом, а не «как бы»: контрольный тест ниже
  // обязан создать НАСТОЯЩИЙ отказ, иначе он зелен всегда и проверяет пустоту.
  исход: { ok: true as boolean, error: undefined as string | undefined },
}));

/**
 * ⏱ Короткий предел на каждый тест — и это не косметика.
 *
 * ЗАМЕР 17.09.2026: один прогон этого файла упал, заняв 32.4 с при обычных
 * 1–2 с. Воспроизвести не удалось — восемь прогонов подряд (включая три с
 * чистого кэша vitest) зелёные, по 1–2 с. Причина НЕ УСТАНОВЛЕНА, и зелёные
 * прогоны её не закрывают: наблюдение было одно, объяснения нет ни одного.
 *
 * Единственный путь, которым этот тест МОЖЕТ ждать десятки секунд, — настоящая
 * отправка почты: если подмена `sendEmail` однажды не встанет, маршрут уйдёт к
 * живому провайдеру. Поэтому здесь два страховочных механизма вместо охоты за
 * флейком: предел времени (ждать почту нечем) и проверка ниже, что подмена
 * ДЕЙСТВИТЕЛЬНО активна. Тогда несработавшая подмена даёт быстрое и внятное
 * падение, а не тридцатисекундную тишину, которую потом нечем объяснить.
 *
 * Соседний сторож applicationsReachAHuman этой опасности не имеет вовсе: он
 * спрашивает ручку состояния и маршрут не поднимает. Мой тяжелее намеренно —
 * он проверяет доставку, а не признак, — и платит за это страховкой.
 */
const ПРЕДЕЛ = 5_000;
vi.setConfig({ testTimeout: ПРЕДЕЛ });

vi.mock("../src/routes/provisioning", async (importOriginal) => {
  const orig = await importOriginal<typeof import("../src/routes/provisioning")>();
  return {
    ...orig,
    sendEmail: async (p: { to: string; subject: string; text: string }) => {
      письма.push({ to: p.to, subject: p.subject, text: p.text });
      return { ok: исход.ok, mode: "real" as const, error: исход.error };
    },
  };
});

/**
 * Поднять приложение НА СВЕЖЕМ импорте маршрута.
 *
 * 🔴 Без `resetModules` этот сторож проверял не то, что обещает его имя.
 * `NOTIFY_EMAIL` в pricing.ts — МОДУЛЬНАЯ константа: она вычисляется один раз,
 * при импорте (`const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL?.trim() || ""`).
 * Динамический импорт кэшируется, поэтому первый тест фиксировал адрес, а
 * `delete process.env.NOTIFY_EMAIL` во втором уже ничего не менял — письмо
 * уходило, и тест «некуда шлём» падал по причине, не связанной с предметом.
 * Замер при написании: ожидалось 0 писем, пришло 1.
 *
 * Поэтому порядок строгий: сперва правим окружение, потом сбрасываем модули,
 * и только потом импортируем.
 */
const приложение = async () => {
  vi.resetModules();
  const { pricingRouter } = await import("../src/routes/pricing");
  const a = express();
  a.use(express.json());
  return a.use("/api/pricing", pricingRouter);
};

const ЗАЯВКА = {
  name: "Алия Смагулова",
  email: "buyer@example.com",
  company: "Halyk Digital",
  tier: "enterprise",
  message: "нужен договор и demo",
  source: "pricing/contact",
};

let предупреждения: string[] = [];

beforeEach(() => {
  process.env.LEADS_FILE = FILE;
  rmSync(FILE, { force: true });
  письма.length = 0;
  // Сброс управляемого исхода: без него отказ из контрольного теста протечёт
  // в соседние и покрасит их по причине, не связанной с их предметом.
  исход.ok = true;
  исход.error = undefined;
  предупреждения = [];
  vi.spyOn(console, "warn").mockImplementation((...a: unknown[]) => {
    предупреждения.push(a.map(String).join(" "));
  });
});

afterEach(() => {
  rmSync(FILE, { force: true });
  vi.restoreAllMocks();
  if (SAVED_LEADS === undefined) delete process.env.LEADS_FILE;
  else process.env.LEADS_FILE = SAVED_LEADS;
  if (SAVED_NOTIFY === undefined) delete process.env.NOTIFY_EMAIL;
  else process.env.NOTIFY_EMAIL = SAVED_NOTIFY;
});

describe("заявка с витрины доходит до человека", () => {
  test("КОНТРОЛЬ: подмена почты активна, тест не уйдёт к живому провайдеру", async () => {
    // Без этого контроля несработавшая подмена выглядела бы как медленное
    // падение по таймауту, и причину пришлось бы искать в предмете, а не в
    // приборе. Спрашиваем сам подменённый модуль, а не маршрут: если здесь
    // письмо не зарегистрировалось, все утверждения ниже бессмысленны.
    const { sendEmail } = await import("../src/routes/provisioning");
    await sendEmail({
      to: "control@example.com",
      subject: "control",
      html: "<p>control</p>",
      text: "control",
    });
    expect(
      письма.map((p) => p.to),
      "sendEmail НЕ подменён — маршрут пошёл бы в настоящую почту",
    ).toContain("control@example.com");
  });

  test("адрес настроен → уведомление уходит на него и несёт поля заявки", async () => {
    process.env.NOTIFY_EMAIL = "sales@aevion.app";
    const r = await request(await приложение()).post("/api/pricing/lead").send(ЗАЯВКА);

    expect(r.status, "заявка принята").toBe(201);

    const внутреннее = письма.filter((p) => p.to === "sales@aevion.app");
    expect(
      внутреннее.length,
      "уведомление о заявке не отправлено — человек о ней не узнает",
    ).toBe(1);

    // Опознаваемость: по письму должно быть понятно, КТО написал и ЗАЧЕМ.
    // Без этого письмо приходит, а перезвонить некому.
    expect(внутреннее[0].text).toContain(ЗАЯВКА.email);
    expect(внутреннее[0].text).toContain(ЗАЯВКА.name);
    expect(внутреннее[0].subject.toLowerCase()).toContain("lead");
  });

  test("адрес НЕ настроен → видимое предупреждение, и заявка всё равно принята", async () => {
    delete process.env.NOTIFY_EMAIL;
    const r = await request(await приложение()).post("/api/pricing/lead").send(ЗАЯВКА);

    expect(r.status, "письмо не должно ронять приём заявки").toBe(201);
    expect(письма.length, "некуда шлём — значит не шлём").toBe(0);
    expect(
      предупреждения.some((s) => s.includes("NOTIFY_EMAIL") && s.includes("pricing/lead")),
      "молчаливый пропуск: ни письма, ни следа — никто не узнает о слепоте",
    ).toBe(true);
  });

  test("контроль: отказ отправки НЕ превращает принятую заявку в ошибку", async () => {
    process.env.NOTIFY_EMAIL = "sales@aevion.app";
    // НАСТОЯЩИЙ отказ отправки, а не его видимость: флаг меняет ответ
    // подменённого sendEmail. Контроль нужен потому, что «письмо не роняет
    // операцию» — это требование, а не следствие: легко починить уведомление
    // так, что отказ почты начнёт возвращать 500 на денежном пути.
    исход.ok = false;
    исход.error = "domain is not verified";

    const r = await request(await приложение()).post("/api/pricing/lead").send(ЗАЯВКА);

    expect(r.status, "отказ почты не должен ронять приём заявки").toBe(201);
    expect(r.body.ok).toBe(true);
    expect(письма.length, "попытка отправки всё равно была").toBe(1);
  });
});
