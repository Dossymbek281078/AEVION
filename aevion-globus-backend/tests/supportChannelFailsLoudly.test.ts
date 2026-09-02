import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Канал поддержки не отвечает «принято», когда обращение не сохранено.
 *
 * ЗАЧЕМ ИМЕННО СЕЙЧАС. 01.09.2026 форма связи стала ЕДИНСТВЕННЫМ каналом
 * поддержки на денежном пути: у домена нет записи MX, письма на @aevion.app не
 * доходят никуда, и адреса в письме о покупке, в чеке и в ответах касс
 * переведены на неё. Раньше отказ формы означал «человек напишет письмом»;
 * теперь — «человек не свяжется с нами никак».
 *
 * Хуже отказа только отказ, выглядящий успехом: страница показывает «спасибо,
 * приняли», человек уходит и больше не пишет, а обращения нет. Здесь
 * проверяется, что этого не бывает.
 *
 * Проверяется ПОВЕДЕНИЕ ручки: код ответа и наличие строки в хранилище, а не
 * присутствие try/catch в исходнике.
 */

const FILE = join(tmpdir(), "aevion-leads-test.jsonl");
/** Обычный ФАЙЛ, внутри которого нельзя создать каталог: так ломается запись. */
const ЗАНЯТЫЙ = join(tmpdir(), "aevion-leads-occupied");
const SAVED = process.env.LEADS_FILE;

const app = async () => {
  const { pricingRouter } = await import("../src/routes/pricing");
  const a = express();
  a.use(express.json());
  return a.use("/api/pricing", pricingRouter);
};

const обращение = (n: number) => ({
  name: "Покупатель",
  email: `buyer${n}@example.com`,
  message: "не пришёл доступ после оплаты",
  source: "pricing/contact",
});

let n = 0;

beforeEach(() => {
  n += 1;
  process.env.LEADS_FILE = FILE;
  rmSync(FILE, { force: true });
  writeFileSync(ЗАНЯТЫЙ, "не каталог", "utf8");
  vi.restoreAllMocks();
});

afterEach(() => {
  rmSync(FILE, { force: true });
  rmSync(ЗАНЯТЫЙ, { force: true });
  if (SAVED === undefined) delete process.env.LEADS_FILE;
  else process.env.LEADS_FILE = SAVED;
});

describe("канал поддержки отказывает громко", () => {
  test("контроль: обращение принимается и СОХРАНЯЕТСЯ", async () => {
    // Положительная сторона первой: без неё «при сбое не 201» означало бы
    // «никогда не 201», и проверка ниже подтверждалась бы сама собой.
    const r = await request(await app()).post("/api/pricing/lead").send(обращение(n));
    expect(r.status, "обращение не принято: " + JSON.stringify(r.body)).toBe(201);
    expect(r.body.id, "номер обращения не выдан — человеку не на что сослаться").toBeTruthy();
    expect(existsSync(FILE), "ответ 201, а файла обращений нет").toBe(true);
    expect(readFileSync(FILE, "utf8")).toContain(`buyer${n}@example.com`);
  });

  test("сбой записи НЕ выдаётся за принятое обращение", async () => {
    // Ломаем запись НАСТОЯЩИМ способом, а не подменой модуля: маршрут
    // импортирует appendFileSync по имени, и подмена объекта модуля на уже
    // связанную ссылку не влияет — первая редакция теста этого не учла и
    // краснела на исправном коде.
    //
    // Кладём хранилище ВНУТРЬ обычного файла: создать там каталог нельзя, и
    // запись падает так же, как упала бы на переполненном диске.
    process.env.LEADS_FILE = join(ЗАНЯТЫЙ, "leads.jsonl");
    const r = await request(await app()).post("/api/pricing/lead").send(обращение(n));
    expect(
      r.status,
      "обращение не сохранено, а человеку ответили «принято» — он уйдёт и больше не напишет",
    ).toBeGreaterThanOrEqual(500);
    expect(r.body.id, "выдан номер обращения, которого не существует").toBeUndefined();
  });

  test("отказ называет причину машиночитаемо", async () => {
    // Страница показывает человеку текст из этого поля; без него на экране
    // окажется голый код ответа.
    process.env.LEADS_FILE = join(ЗАНЯТЫЙ, "leads.jsonl");
    const r = await request(await app()).post("/api/pricing/lead").send(обращение(n));
    expect(r.body.error, "отказ без причины: странице нечего показать").toBeTruthy();
  });
});
