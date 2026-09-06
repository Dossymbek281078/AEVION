import { describe, it, expect, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { channelsHealthRouter } from "../src/routes/channelsHealth";

/**
 * Снаружи видно, доходит ли ЗАЯВКА до человека.
 *
 * 🔴 ЗАМЕР 04.09.2026 на проде: `NOTIFY_EMAIL` не задана. Значит заявки
 * партнёров, образовательных программ и обращений сохраняются у нас — и
 * внутреннее письмо о них не отправляется ВООБЩЕ. Узнать о новой заявке
 * можно только зайдя на сервер и открыв файл.
 *
 * ОБРАБОТЧИК ПРИ ЭТОМ ВЕДЁТ СЕБЯ ПРАВИЛЬНО: без адреса он не придумывает
 * запасной и пишет предупреждение. Запасной здесь однажды уже стоял — на
 * домене `aevion.io`, который принадлежит ДРУГОЙ компании с похожим
 * названием, и наши заявки с именем, страной и каналом заявителя уходили им.
 *
 * ДЕФЕКТ БЫЛ НЕ В КОДЕ, А В ВИДИМОСТИ. Предупреждение уходит в журнал
 * контейнера, который никто не открывает: снаружи «заявки идут в никуда» и
 * «всё хорошо» выглядели одинаково. При этом на витрине обещано «Customer
 * Success одобрит заявку в течение…» — обещание, которому нужен человек.
 *
 * Молчаливый пропуск должен оставлять СЛЕД, доступный без входа на сервер.
 */

function app() {
  const a = express();
  a.use("/api/health", channelsHealthRouter);
  return a;
}

const было = process.env.NOTIFY_EMAIL;
afterEach(() => {
  if (было === undefined) delete process.env.NOTIFY_EMAIL;
  else process.env.NOTIFY_EMAIL = было;
});

describe("состояние говорит, дойдёт ли заявка до человека", () => {
  it("адрес не задан → признак false и человеку сказано, чем это грозит", async () => {
    delete process.env.NOTIFY_EMAIL;
    const r = await request(app()).get("/api/health/channels");
    expect(r.status).toBe(200);
    expect(r.body.applicationsNotified, "молчание подано как исправность").toBe(false);
    expect(
      r.body.missing.join(" "),
      "в списке недостающего не сказано, ЧТО именно ломается",
    ).toContain("никто не узнаёт");
  });

  it("контроль: адрес задан → признак true и строки в недостающем нет", async () => {
    // Без этого контроля проверка выше проходила бы и на признаке,
    // который ВСЕГДА false.
    process.env.NOTIFY_EMAIL = "kto@to.example";
    const r = await request(app()).get("/api/health/channels");
    expect(r.body.applicationsNotified).toBe(true);
    expect(r.body.missing.join(" ")).not.toContain("NOTIFY_EMAIL");
  });

  it("пустая строка — это НЕ заданный адрес", async () => {
    // Классическая ловушка: переменная есть, значение пустое. Для человека
    // это то же самое, что её нет.
    process.env.NOTIFY_EMAIL = "   ";
    const r = await request(app()).get("/api/health/channels");
    expect(r.body.applicationsNotified, "пустая строка принята за адрес").toBe(false);
  });
});
