import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import express from "express";
import request from "supertest";
import { деньАлматыНазад } from "./helpers/суткиАлматы";

/*
 * 🔴 ВОРОНКА ОТВЕЧАЕТ ПРО ТОТ ДЕНЬ, КОТОРЫЙ СПРОСИЛИ.
 *
 * Повод в ночь 11→12.10.2026, и он про молчаливый неверный ответ. Мне нужен был
 * разрез по постам за календарный день, я позвал `/funnel?day=2026-10-11` — и
 * получил 200 с числами. Числа оказались РОВНО теми же, что без параметра:
 * проверено на `day=2026-09-01` и `day=nonsense`, все три ответа совпали до
 * единицы (77 визитов). Параметр игнорировался молча.
 *
 * Это хуже отказа. Отказ видно; подмену окна — нет, и скользящие сутки уходят
 * в сводку основателю под видом календарного дня. Я поймал это только потому,
 * что искал в теле поле, называющее окно, и не нашёл ни одного.
 *
 * Три вещи проверяются здесь, и порознь они бессмысленны:
 *   1. `day` понимается, и ДВА разных дня дают РАЗНЫЕ числа (прежде совпадали);
 *   2. непригодный `day` даёт 400, а не тихо «сегодня»;
 *   3. окно названо в теле ВСЕГДА, включая скользящее, — иначе читатель снова
 *      не отличит одно от другого.
 *
 * И отдельно — главный различитель: сутки режутся по АЛМАТЫ, а не по UTC.
 * Событие в 02:00 Алматы имеет UTC-дату предыдущего дня, поэтому разрез по UTC
 * положил бы его в другой день. Без этой проверки «день понимается» ничего не
 * говорит о том, КАКОЙ день.
 */
const каталог = mkdtempSync(join(tmpdir(), "aevion-funnel-day-"));
const файл = join(каталог, "events.jsonl");
process.env.EVENTS_FILE = файл;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const ВЧЕРА = деньАлматыНазад(1);
const ПОЗАВЧЕРА = деньАлматыНазад(2);

/** 12:00 по Алматы = 07:00 UTC — заведомо внутри суток при любом прочтении. */
const полдень = (день: string) => `${день}T07:00:00.000Z`;
/** 02:00 по Алматы СЛЕДУЮЩЕГО дня: UTC-дата ещё прежняя, а день Алматы — уже новый. */
const ночьПосле = (день: string) => `${день}T21:00:00.000Z`;

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
  app.use(express.json());
  app.use("/api/pricing/events", eventsRouter);
  return app;
}

function просмотр(sid: string, ts: string) {
  return { type: "page_view", ts, sid, path: "/cyberchess?c=yt", meta: { channel: "youtube" } };
}

describe("воронка отвечает про спрошенный день", () => {
  it("🔴 два разных дня дают РАЗНЫЕ числа", async () => {
    /*
     * Носитель признака: по одному заходу в каждый день. Прежде оба запроса
     * давали одно и то же, потому что параметр отбрасывался, — и именно эта
     * проверка краснеет, если его снова начнут игнорировать.
     */
    журнал([
      просмотр("вчерашний", полдень(ВЧЕРА)),
      просмотр("позавчерашний", полдень(ПОЗАВЧЕРА)),
    ]);
    const app = await приложение();
    const в = await request(app).get(`/api/pricing/events/funnel?day=${ВЧЕРА}&days=1`);
    const п = await request(app).get(`/api/pricing/events/funnel?day=${ПОЗАВЧЕРА}&days=1`);
    expect(в.status).toBe(200);
    expect(п.status).toBe(200);
    expect(в.body.totalBySession.visits, "во вчерашнем дне не один заход").toBe(1);
    expect(п.body.totalBySession.visits, "в позавчерашнем дне не один заход").toBe(1);
    expect(в.body.окно.день).toBe(ВЧЕРА);
    expect(п.body.окно.день).toBe(ПОЗАВЧЕРА);
    // Разные дни — разные сессии. Если параметр игнорируется, здесь будет 2 и 2.
    expect(
      Object.keys(в.body.byHour).length + Object.keys(п.body.byHour).length,
      "часы обоих окон совпали — похоже, день снова не учитывается",
    ).toBe(2);
  });

  it("🔴 сутки режутся по АЛМАТЫ, а не по UTC", async () => {
    /*
     * Событие в 02:00 Алматы: UTC-дата у него ПОЗАВЧЕРАШНЯЯ, а день Алматы —
     * вчерашний. Разрез по UTC положил бы его в позавчера. Это единственная
     * проверка, которая отличает «день понимается» от «понимается ВЕРНО».
     */
    журнал([просмотр("ночной", ночьПосле(ПОЗАВЧЕРА))]);
    const app = await приложение();
    const в = await request(app).get(`/api/pricing/events/funnel?day=${ВЧЕРА}&days=1`);
    const п = await request(app).get(`/api/pricing/events/funnel?day=${ПОЗАВЧЕРА}&days=1`);
    expect(в.body.totalBySession.visits, "заход в 02:00 Алматы не попал во вчерашний день").toBe(1);
    expect(п.body.totalBySession.visits, "заход в 02:00 Алматы зачтён по UTC-дате").toBe(0);
  });

  it("🔴 непригодный день — 400, а не тихое «сегодня»", async () => {
    const app = await приложение();
    for (const плохой of ["nonsense", "2026-13-99", "2026-02-31", "12.10.2026"]) {
      const r = await request(app).get(`/api/pricing/events/funnel?day=${плохой}&days=1`);
      expect(r.status, `день «${плохой}» принят вместо отказа`).toBe(400);
      expect(r.body.error).toBe("bad_day");
      expect(r.body.отдано, "в отказе не названо, что именно отдали").toBe(плохой);
    }
  });

  it("🔴 у by-type та же дверь: непригодный день — 400", async () => {
    /*
     * Обещание «негодное значение — 400» стояло в комментарии этой ручки с
     * 07.10 и оставалось ТЕКСТОМ: `days` его получил, а `day` нет, и
     * `day=nonsense` отвечал 200 про сегодня. Свой комментарий ослепляет свой
     * же надзор — поэтому проверка смотрит на ответ, а не на исходник.
     */
    const app = await приложение();
    const плохой = await request(app).get(
      "/api/pricing/events/by-type?day=nonsense&types=puzzle_solved",
    );
    expect(плохой.status, "by-type принял непригодный день").toBe(400);
    expect(плохой.body.error).toBe("bad_day");

    журнал([{ type: "puzzle_solved", ts: полдень(ВЧЕРА), sid: "ч", path: "/cyberchess", ua: UA }]);
    const хороший = await request(await приложение()).get(
      `/api/pricing/events/by-type?day=${ВЧЕРА}&types=puzzle_solved`,
    );
    expect(хороший.status).toBe(200);
    expect(хороший.body.день, "годный день не доехал до ответа").toBe(ВЧЕРА);
  });

  it("🔴 окно названо в теле ВСЕГДА, в том числе скользящее", async () => {
    журнал([просмотр("кто-то", полдень(ВЧЕРА))]);
    const app = await приложение();
    const скользящее = await request(app).get("/api/pricing/events/funnel?days=1");
    expect(скользящее.status).toBe(200);
    expect(скользящее.body.окно, "поля окна нет — читатель не отличит одно окно от другого").toBeTruthy();
    expect(скользящее.body.окно.день, "скользящее окно назвалось календарным днём").toBeNull();
    expect(String(скользящее.body.окно.зона)).toMatch(/скользящее/);
    expect(String(скользящее.body.окно.от)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(String(скользящее.body.окно.до)).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const суточное = await request(app).get(`/api/pricing/events/funnel?day=${ВЧЕРА}&days=1`);
    expect(String(суточное.body.окно.зона)).toMatch(/Almaty/);
    expect(суточное.body.окно.день).toBe(ВЧЕРА);
  });

  it("КОНТРОЛЬ: без day поведение не изменилось — будущее событие всё ещё в окне", async () => {
    /*
     * Условие соседних окон: `/funnel?days=1` должен отвечать как прежде, иначе
     * чужие сторожа и приборы покраснеют. Верхняя граница окна применяется
     * ТОЛЬКО когда день назван — иначе событие с меткой в будущем (перекос
     * часов, сторож, пишущий «завтра») начало бы молча выпадать, и починка
     * одного молчаливого ответа завела бы второй.
     */
    const завтра = new Date(Date.now() + 36 * 3600_000).toISOString();
    журнал([просмотр("из-будущего", завтра)]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?days=1");
    expect(r.body.totalBySession.visits, "событие из будущего выпало из скользящего окна").toBe(1);
  });

  it("КОНТРОЛЬ: пустой day — это «не задан», а не отказ", async () => {
    // Так ведут себя формы, отправляющие поле пустым; 400 здесь был бы ложным.
    журнал([просмотр("кто-то", полдень(ВЧЕРА))]);
    const r = await request(await приложение()).get("/api/pricing/events/funnel?day=&days=1");
    expect(r.status).toBe(200);
    expect(r.body.окно.день).toBeNull();
  });
});
