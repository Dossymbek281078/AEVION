import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { denPoMestnomu } from "../src/lib/denPoMestnomu";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";

/*
 * 🔴 ИТОГ САМ НАЗЫВАЕТ, СКОЛЬКО В НЁМ НАШЕГО — И НА ТОЙ ЖЕ ОСИ.
 *
 * Задание оркестратора 11.10.2026 для инвесторских материалов: «живые = всего
 * минус наши» должно браться ОДНОЙ командой. До этой правки «наших» в итоге не
 * было вовсе, и их приходилось складывать по каналам — а сумма по каналам
 * законно БОЛЬШЕ итога (замер: 688 против 675), потому что сессия с двумя
 * метками попадает в два канала. То есть вычитание суммы каналов из итога
 * давало заниженное число живых, и выглядело это правдоподобно.
 *
 * Главное утверждение сторожа — не наличие полей, а ОСЬ:
 *   visits  / visitsOurs  — СЕССИИ (уникальные внутри дня);
 *   pricing / pricingOurs — ПРОСМОТРЫ страницы цен, а не сессии.
 * Если «наши» посчитать сессиями там, где слева просмотры, вычитание смешает
 * единицы и даст число, которое не является ни тем, ни другим. Этот класс у нас
 * уже стоил ложного доклада, поэтому проверяется случаем, где два числа РАЗНЫЕ:
 * одна наша сессия с двумя просмотрами цен.
 *
 * ⚠️ Метки времени — от «сейчас» (окно ручки скользящее), две точки разнесены
 * на 26 часов, значит гарантированно разные сутки UTC.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-total-ours-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const ЧАС = 60 * 60 * 1000;
const тСегодня = new Date(Date.now() - ЧАС).toISOString();
const тВчера = new Date(Date.now() - 26 * ЧАС).toISOString();
const дСегодня = denPoMestnomu(new Date(тСегодня));
const дВчера = denPoMestnomu(new Date(тВчера));

function журнал(события: Array<Record<string, unknown>>) {
  writeFileSync(файл, события.map((о) => JSON.stringify({ ua: UA, ...о })).join("\n") + "\n");
}

beforeAll(async () => {
  await import("../src/routes/events");
}, 120_000);

beforeEach(() => {
  журнал([]);
});

afterAll(() => {
  rmSync(каталог, { recursive: true, force: true });
});

async function приложение() {
  const { eventsRouter } = await import("../src/routes/events");
  const app = express();
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

function день(тело: any, дата: string) {
  const строка = (тело.byDay || []).find((д: any) => д.day === дата);
  expect(строка, "в ответе нет строки за " + дата).toBeTruthy();
  return строка;
}

describe("итог называет наших на той же оси", () => {
  it("🔴 два числа РАЗНЫЕ: сессии и просмотры считаются каждое своей мерой", async () => {
    журнал([
      // Наша проба: ОДНА сессия, но ДВА просмотра страницы цен.
      { type: "page_view", ts: тСегодня, sid: "наш", path: "/pricing?c=probe-okno" },
      { type: "page_view", ts: тСегодня, sid: "наш", path: "/pricing?c=probe-okno" },
      // Живой человек: одна сессия, один просмотр цен.
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/pricing?c=yt" },
      // Живой, до цен не доходивший.
      { type: "page_view", ts: тСегодня, sid: "живой2", path: "/?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.status).toBe(200);

    expect(r.body.total.visits, "визиты считаются сессиями").toBe(3);
    expect(r.body.total.visitsOurs, "наши визиты не названы в итоге").toBe(1);
    expect(r.body.total.pricing, "до цен считаются просмотрами").toBe(3);
    expect(r.body.total.pricingOurs, "наши просмотры цен посчитаны сессиями, а не просмотрами").toBe(2);
    // Решающее: если бы «наши» считались одной мерой, эти два числа совпали бы.
    expect(r.body.total.pricingOurs).not.toBe(r.body.total.visitsOurs);
    expect(r.body.total.visits - r.body.total.visitsOurs, "живых сессий вышло не столько").toBe(2);
    expect(r.body.total.pricing - r.body.total.pricingOurs, "живых просмотров цен вышло не столько").toBe(1);
  });

  it("🔴 те же два числа есть в КАЖДОМ дне, а не только в итоге", async () => {
    журнал([
      { type: "page_view", ts: тСегодня, sid: "наш", path: "/pricing?c=probe-okno" },
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/pricing?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    const д = день(r.body, дСегодня);
    expect(д.visitsOurs, "в строке дня нет наших визитов").toBe(1);
    expect(д.pricingOurs, "в строке дня нет наших просмотров цен").toBe(1);
    expect(д.visits - д.visitsOurs).toBe(1);
  });

  it("🔴 ось итога — СУММА ДНЕЙ: наша сессия, заходившая два дня, даёт двоих", async () => {
    /*
     * Это не дефект, а ось разреза, и она должна держаться у «наших» так же, как
     * у визитов: иначе вычитание на окне в неделю даст отрицательное живое.
     */
    журнал([
      { type: "page_view", ts: тВчера, sid: "наш", path: "/pricing?c=probe-okno" },
      { type: "page_view", ts: тСегодня, sid: "наш", path: "/pricing?c=probe-okno" },
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(день(r.body, дВчера).visitsOurs).toBe(1);
    expect(день(r.body, дСегодня).visitsOurs).toBe(1);
    expect(r.body.total.visitsOurs, "итог «наших» собран не по дням").toBe(2);
    expect(r.body.total.visits).toBe(3);
    expect(r.body.total.visits - r.body.total.visitsOurs).toBe(1);
  });

  it("🔴 заход БЕЗ sid считается в общем, но нашим не становится", async () => {
    /*
     * Две ошибки здесь противоположны и обе дорогие: приписать безсессионный
     * заход нам — занизить живых; выбросить его совсем — занизить общее число, и
     * тогда «живые» окажутся больше «всего». Поэтому проверяются ОБА числа, и у
     * визитов, и у просмотров цен (просмотр цен без sid ловится только здесь:
     * мутация «не считать просмотр без сессии» иначе выживает).
     */
    журнал([
      { type: "page_view", ts: тСегодня, path: "/?c=probe-okno" },
      { type: "page_view", ts: тСегодня, path: "/pricing?c=probe-okno" },
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.body.total.visits, "визит без sid потерян").toBe(3);
    expect(r.body.total.visitsOurs, "визит без sid приписан нам, хотя сессии у него нет").toBe(0);
    expect(r.body.total.pricing, "просмотр цен без sid потерян").toBe(1);
    expect(r.body.total.pricingOurs, "просмотр без sid приписан нам").toBe(0);
  });

  it("🔴 ось названа словами, и сказано, что по каналам складывать нельзя", async () => {
    журнал([{ type: "page_view", ts: тСегодня, sid: "с", path: "/" }]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.body.totalUnits).toMatch(/visitsOurs/);
    expect(r.body.totalUnits).toMatch(/pricingOurs/);
    expect(r.body.totalUnits, "не сказано, что pricing — просмотры, а не сессии").toMatch(/ПРОСМОТР/);
    expect(r.body.totalUnits, "не сказано, почему сумма по каналам больше итога").toMatch(/по каналам/);
  });

  it("КОНТРОЛЬ: нашего нет — поля на месте и равны нулю, а не исчезают", async () => {
    журнал([
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/pricing?c=yt" },
      { type: "page_view", ts: тСегодня, sid: "живой2", path: "/?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.body.total.visitsOurs).toBe(0);
    expect(r.body.total.pricingOurs).toBe(0);
    expect(r.body.total.visits).toBe(2);
    expect(r.body.total.pricing).toBe(1);
    const д = день(r.body, дСегодня);
    expect(д.visitsOurs).toBe(0);
    expect(д.pricingOurs).toBe(0);
  });

  it("КОНТРОЛЬ: проба, помеченная флагом, а не меткой в адресе, тоже наша", async () => {
    // Окна метят заходы двумя способами (метка ?c=probe-* и флаг probe/заголовок),
    // и итог обязан знать оба: иначе часть наших прогонов станет людьми.
    журнал([
      { type: "page_view", ts: тСегодня, sid: "флаг", path: "/pricing", probe: true },
      { type: "page_view", ts: тСегодня, sid: "живой", path: "/pricing?c=yt" },
    ]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=3");
    expect(r.body.total.visitsOurs, "проба с флагом не зачтена нашей").toBe(1);
    expect(r.body.total.pricingOurs).toBe(1);
  });
});
