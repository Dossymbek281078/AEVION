import { describe, expect, test } from "vitest";
import request from "supertest";
import express from "express";
import { qskywayRouter } from "../src/routes/qskyway";

/**
 * Ворота запуска 3: путь новичка от первого экрана до первого результата.
 *
 * ПОВОД (29.08.2026). Этот путь проверял только `scripts/qskyway-smoke.js`,
 * а ему нужен запущенный бэкенд на порту 4001. Замер того же дня: порт
 * делят 18+ worktree, и смоук молча прошёл 153/153 против сервера СОСЕДНЕЙ
 * сессии. То есть путь новичка не проверялся против нашего кода вовсе, а
 * отчёт был зелёный.
 *
 * Здесь тот же путь, но без сети и без порта: роутер поднимается в
 * процессе. Такая проверка идёт в CI и на ноутбуке при нехватке памяти —
 * ровно тогда, когда сервер поднять нельзя (в день написания проверка
 * памяти отвечала «подождать»: свободно 14 ГБ при резерве 23).
 *
 * ⚠️ Чего она НЕ заменяет: сборку, подключение к базе, сеть и обратный
 * прокси. Смоук против живого сервера остаётся нужен — он теперь умеет
 * отличать свой сервер от чужого (`qskywaySmokeKnowsItsServer`).
 *
 * Проверяем не «ручки отвечают 200», а что человек ДОХОДИТ до результата:
 * увидел города → построил маршрут → получил обоснование → проверил его →
 * забронировал слот → проверил квитанцию. Каждый шаг берёт данные из
 * предыдущего, поэтому разрыв в середине виден сразу.
 */
const app = express();
app.use(express.json());
app.use("/api/qskyway", qskywayRouter);

describe("новичок доходит до результата", () => {
  test("города → маршрут → обоснование → проверка → слот → квитанция", async () => {
    // 1. Первый экран: какие города вообще есть.
    const cities = await request(app).get("/api/qskyway/cities");
    expect(cities.status).toBe(200);
    const list = cities.body.cities as { id: string }[];
    expect(list.length, "список городов пуст — новичку не с чего начать").toBeGreaterThan(0);

    // По ВСЕМ городам, а не по первому. Новичок открывает страницу и
    // переключает город первым же движением; путь, проверенный на одном,
    // ничего не говорит про остальные — это «проверка покрывает одну
    // страницу из двадцати одной», только в миниатюре.
    const walked: string[] = [];
    for (const entry of list) {
      walked.push(await walkCity(entry.id));
    }
    // Считаем ПРОЙДЕННЫЕ города, а не длину списка. Пустой цикл и цикл по
    // трём городам одинаково «зелёные», если не спросить, сколько шагов
    // он на самом деле сделал.
    expect(walked, "пройдено не столько городов, сколько отдал список").toEqual(list.map((c) => c.id));
    expect(walked.length, "городов меньше двух — переключать нечего").toBeGreaterThan(1);
  }, 180000);
});

async function walkCity(cityId: string): Promise<string> {

    // 2. Город грузится и отдаёт площадки, между которыми можно лететь.
    const city = await request(app).get("/api/qskyway/city?city=" + cityId);
    expect(city.status).toBe(200);
    const pads = city.body.vertiports as unknown[];
    expect(pads.length, cityId + ": нет площадок — маршрут не построить").toBeGreaterThan(1);

    // 3. Первый результат: маршрут.
    const route = await request(app).post("/api/qskyway/route").send({ from: 0, to: 1, city: cityId });
    expect(route.status).toBe(200);
    expect(route.body.path?.length, cityId + ": маршрут без точек").toBeGreaterThan(1);
    expect(typeof route.body.distanceKm, "маршрут без расстояния").toBe("number");

    // 4. Документ, ради которого модуль и нужен.
    const just = await request(app).post("/api/qskyway/route/justification")
      .send({ from: 0, to: 1, city: cityId });
    expect(just.status).toBe(200);
    expect(just.body.document, "обоснование без документа").toBeTruthy();
    expect(just.body.attestation?.signature, cityId + ": обоснование без подписи").toBeTruthy();

    // 5. И он проверяется — иначе подпись ничего не стоит.
    const check = await request(app).post("/api/qskyway/route/justification/verify")
      .send({ document: just.body.document, attestation: just.body.attestation });
    expect(check.status).toBe(200);
    expect(check.body.valid, "только что выданный документ не проходит собственную проверку").toBe(true);

    // 6. Бронь слота — первое действие, оставляющее след.
    const slot = await request(app).post("/api/qskyway/slots").send({
      routeId: "newcomer-path-" + cityId, t0: "2033-04-04T00:00:00.000Z",
      t1: "2033-04-04T00:10:00.000Z", holder: "Aero Taxi KZ",
    });
    expect(slot.status).toBeLessThan(300);
    const id = slot.body.slot?.id as string;
    expect(id, "бронь не вернула номер слота").toBeTruthy();

    // 7. Квитанция проверяется — это и есть «первый результат» на руки.
    const receipt = await request(app).get("/api/qskyway/slots/" + encodeURIComponent(id) + "/verify");
    expect(receipt.status).toBe(200);
    // Поле называется `matches` (сошлась ли квитанция с записью), а не
    // `valid`. Первая версия теста спрашивала `valid` и получала
    // undefined — то есть КРАСНЕЛА бы и на исправном коде. Форму ответа
    // здесь спросили у самой ручки, а не вспомнили.
    expect(receipt.body.matches, "свежая квитанция не сошлась с записью").toBe(true);
    expect(receipt.body.payload, "квитанция без байтов, по которым её проверяют").toBeTruthy();
  return cityId;
}
