import { describe, expect, test, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import jwt from "jsonwebtoken";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Выгрузка заявок обязана говорить о себе правду — 19.08.2026.
//
// ЗАЧЕМ. По этому файлу принимают решения: сколько людей ждёт запуска и из каких
// каналов пришли. До починки (`d1ca730cb`, взята в ветку) выгрузка при сбое
// запроса к базе молча подставляла список из памяти и отдавала его как полный —
// владелец видел три строки и делал вывод, что заявок нет.
//
// Починка не в том, чтобы память не подставлять (запасной путь полезен), а в том,
// что признак подставленных данных лежит В САМИХ ДАННЫХ: `source`,
// `dbQueryFailed`, `truncated`, `rowCap`. Для CSV те же признаки уходят
// заголовками, потому что в файл их не положить, а файл в любом случае выглядит
// одинаково полным.
//
// Тест сторожит именно эти признаки. Без него первая же «чистка ответа» уберёт их
// как лишние поля, и выгрузка снова начнёт врать молча.
//
// Базы в тестовом окружении нет, поэтому ручка идёт по запасному пути — ровно тот
// случай, который и надо проверить.

const SECRET = "test-secret-for-waitlist-export-honesty-000";

beforeAll(() => {
  process.env.AUTH_JWT_SECRET = SECRET;
  // Базы в тестах нет, и ручка это выясняет ПОПЫТКОЙ подключения. Пул по
  // умолчанию ждёт её 5 секунд (PG_POOL_CONN_MS), а при полном прогоне —
  // 122 файла параллельно — этого хватало, чтобы тест падал по таймауту в 10 с,
  // будучи зелёным в одиночку. Падало при этом не там, где причина.
  //
  // Сокращаем ожидание, а не поднимаем лимит теста: причина в ожидании
  // соединения, которого здесь и не должно быть. Vitest изолирует модули по
  // файлу, поэтому пул в этом файле создаётся уже с этим значением.
  process.env.PG_POOL_CONN_MS = "150";
  process.env.PG_STATEMENT_TIMEOUT_MS = "500";
});

function adminToken(): string {
  return jwt.sign({ sub: "admin-1", email: "a@a.test", role: "admin" }, SECRET, {
    algorithm: "HS256",
    expiresIn: "1h",
  });
}

async function mount() {
  const { constitutionWaitlistAdminRouter, constitutionWaitlistRouter } = await import(
    "../src/routes/constitutionWaitlist"
  );
  const app = express();
  app.use(express.json());
  // Публичный роут подписки нужен, чтобы проверить путь целиком: подписка →
  // склейка метки → разбивка в выгрузке. Письма при этом не уходят — без
  // BREVO_API_KEY отправка возвращает отказ ещё до сетевого вызова.
  app.use("/api/constitution/waitlist", constitutionWaitlistRouter);
  app.use("/api/constitution/waitlist", constitutionWaitlistAdminRouter);
  return app;
}

describe("выгрузка заявок — признаки честности", () => {
  test(
    "без админского токена не отдаётся вовсе",
    async () => {
      // Список адресов — персональные данные: закрыт он не «на всякий случай».
      const app = await mount();
      const r = await request(app).get("/api/constitution/waitlist/list");
      expect(r.status).toBe(403);
      expect(r.body.error).toBe("admin_required");
    },
    // Страховка: этот случай первый, он и платит за создание пула.
    20_000,
  );

  test("JSON называет источник данных, а не только строки", async () => {
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.status).toBe(200);
    // Четыре признака, каждый отвечает на свой вопрос: откуда список, не упал ли
    // запрос, не обрезан ли, и каков предел обрезки.
    expect(r.body).toHaveProperty("source");
    expect(["postgres", "memory"]).toContain(r.body.source);
    expect(r.body).toHaveProperty("dbQueryFailed");
    expect(typeof r.body.dbQueryFailed).toBe("boolean");
    expect(r.body).toHaveProperty("truncated");
    expect(typeof r.body.truncated).toBe("boolean");
    expect(r.body).toHaveProperty("rowCap");
    expect(r.body.rowCap).toBeGreaterThan(0);
  });

  test("без базы источник назван памятью — а не выдан за postgres", async () => {
    // Главное утверждение теста. В тестовом окружении базы нет, значит ответ
    // обязан признаться, что список из памяти.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.body.source).toBe("memory");
    // truncated имеет смысл только для базы: у памяти обрезки нет, и говорить
    // «не обрезан» о неполном списке было бы вторым обманом.
    expect(r.body.truncated).toBe(false);
  });

  test("CSV несёт те же признаки заголовками — в файл их не положить", async () => {
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list?format=csv")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.status).toBe(200);
    expect(r.headers["content-type"]).toMatch(/text\/csv/);
    expect(r.headers["x-data-source"]).toBe("memory");
    expect(r.headers["x-data-truncated"]).toBe("false");
    // Шапка на месте, иначе файл не откроется таблицей.
    expect(r.text.split("\n")[0]).toBe("email,source,createdAt");
  });

  test("CSV отдаётся как вложение с именем файла", async () => {
    // Иначе браузер покажет его текстом, и человек скопирует руками с потерями.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list?format=csv")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.headers["content-disposition"]).toMatch(/attachment/);
    expect(r.headers["content-disposition"]).toMatch(/\.csv/);
  });

  test("total описывает выданное, и рядом есть чем это понять", async () => {
    // `total` — это «сколько отдали», а не «сколько есть». Поэтому проверяем не
    // само число, а что рядом с ним стоят признаки, по которым его можно
    // истолковать.
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    if ("total" in r.body) {
      expect(typeof r.body.total).toBe("number");
      expect(r.body).toHaveProperty("source");
      expect(r.body).toHaveProperty("truncated");
    }
  });
});

describe("недельный дайджест — молчание лучше неполной рассылки", () => {
  // Эту функцию зовёт задача по расписанию, и главное её свойство: она не должна
  // рапортовать об успехе, ничего не отправив. Раньше при сбое базы рассылка
  // уходила по списку из ПАМЯТИ (в проде почти пустому), и функция возвращала
  // успех — недельное письмо считалось отправленным, не дойдя ни до кого. Теперь
  // такой случай возвращает aborted: true, потому что отправку нельзя повторить
  // «уже правильно»: второе письмо людям выглядит спамом.
  //
  // ЧЕГО ЗДЕСЬ НЕТ И ПОЧЕМУ. Сначала я написал случай «функция не бросает» — и
  // мутация его не поймала: я убрал внешний catch, а тест остался зелёным.
  // Причина в том, что без базы функция выходит на ПЕРВОМ шаге (нет артефактов
  // недели), до внешнего catch дело не доходит, и утверждение проверяет пустоту.
  // Такой тест хуже отсутствующего: он создаёт впечатление проверенного.
  // Оставлено только то, что здесь действительно проверяется.
  //
  // Писем при этом не отправляется: без базы нет ни артефактов, ни подписчиков.
  test("без базы отправка нулевая — успех не рапортуется", async () => {
    const { sendWeeklyDigest } = await import("../src/routes/constitutionWaitlist");
    const r = await sendWeeklyDigest();
    expect(r.sent).toBe(0);
    expect(typeof r.skipped).toBe("number");
  }, 20_000);

  test("форма ответа позволяет отличить «нечего слать» от «отменено»", async () => {
    // Оба случая дают sent: 0, и без отдельного признака они неразличимы — а
    // решения разные: в первом ждать следующей недели, во втором чинить базу и
    // слать вручную.
    const { sendWeeklyDigest } = await import("../src/routes/constitutionWaitlist");
    const r = (await sendWeeklyDigest()) as { sent: number; skipped: number; aborted?: boolean };
    expect("sent" in r && "skipped" in r).toBe(true);
    if ("aborted" in r) expect(typeof r.aborted).toBe("boolean");
  }, 20_000);

  test("признак отмены объявлен в типе — иначе его нельзя прочесть у вызывающего", () => {
    // Проверяем не поведение, а контракт: задача по расписанию должна иметь
    // возможность отличить отмену. Читаем исходник, потому что тип в рантайме
    // недоступен, а поведение с настоящим сбоем базы здесь не воспроизвести.
    const src = readFileSync(
      join(__dirname, "..", "src", "routes", "constitutionWaitlist.ts"),
      "utf8",
    );
    expect(src).toMatch(/aborted\?:\s*boolean/);
    expect(src).toMatch(/aborted:\s*true/);
    // И рядом — что отмена именно ЛОГИРУЕТСЯ: молчаливая отмена ничем не лучше
    // молчаливой неполной рассылки.
    expect(src).toMatch(/ДАЙДЖЕСТ ОТМЕНЁН/);
  });
});

describe("разбивка по источникам после склейки меток", () => {
  // Источник накапливается с 19.08: у подписавшегося на шахматах и потом на
  // DevHub в поле стоит «cyberchess,devhub». Группировка по СТРОКЕ дала бы отчёт
  // из наборов интересов — «cyberchess» 1, «devhub» 1, «cyberchess,devhub» 1, — и
  // на вопрос «сколько ждёт шахматы» ответить было бы нельзя.
  //
  // Побочное следствие правильной группировки: сумма по группам может быть
  // БОЛЬШЕ числа подписчиков. Это обязано быть названо в самом ответе, иначе
  // первый же отчёт (12 адресов, 15 по группам) прочитают как ошибку счёта.
  test("ответ несёт uniqueEmails и пояснение про сумму", async () => {
    const app = await mount();
    const r = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(r.status).toBe(200);
    expect(r.body).toHaveProperty("bySource");
    expect(Array.isArray(r.body.bySource)).toBe(true);
    expect(r.body).toHaveProperty("uniqueEmails");
    expect(typeof r.body.uniqueEmails).toBe("number");
    // Именно пояснение, а не только число: иначе расхождение придётся объяснять
    // человеку каждый раз заново.
    expect(String(r.body.note ?? "")).toMatch(/сумма по группам/i);
  });

  test("один адрес с двумя интересами даёт ДВЕ группы, а не одну строку-набор", async () => {
    // Сквозная проверка вместо чтения исходника: подписка → склейка метки →
    // разбивка. Первая версия этого случая смотрела на текст функции (есть ли
    // split) и осталась зелёной, когда я мутацией вернул группировку по целой
    // строке. Наличие вызова не доказывает, что его результат используется.
    const app = await mount();
    const email = `dva-interesa-${Date.now()}@primer.test`;

    for (const source of ["cyberchess", "devhub-instagram"]) {
      const r = await request(app)
        .post("/api/constitution/waitlist/subscribe")
        .send({ email, source });
      expect([200, 201]).toContain(r.status);
    }

    const list = await request(app)
      .get("/api/constitution/waitlist/list")
      .set("Authorization", `Bearer ${adminToken()}`);

    const groups = (list.body.bySource ?? []) as Array<{ source: string; count: number }>;
    const names = groups.map((g) => g.source);
    // Обе метки — отдельными группами. Набор «cyberchess,devhub-instagram»
    // группой быть не должен.
    expect(names).toContain("cyberchess");
    expect(names).toContain("devhub-instagram");
    expect(names.some((n) => n.includes(","))).toBe(false);

    // И то самое расхождение: один человек, две группы.
    const sum = groups.reduce((a, g) => a + g.count, 0);
    expect(list.body.uniqueEmails).toBeGreaterThanOrEqual(1);
    expect(sum).toBeGreaterThan(0);
    expect(sum).toBeGreaterThanOrEqual(list.body.uniqueEmails);
  }, 20_000);
});

describe("признак обрезки — проверяемо, а не «нужна база»", () => {
  // Мутациями 19.08.2026 выяснилось, что одиннадцать тестов выше НЕ ловят ни
  // `truncated = false` всегда, ни снижение предела строк до пяти. Тесты не лгали: в
  // них нет базы, путь postgres не проходится, а признак считался только там. Решение
  // вынесено в чистую функцию — теперь свойство проверяется без всякой базы.

  test("ровно предел — считается обрезанной", async () => {
    // Граница важнее остального: запрос идёт с LIMIT cap, и ровно cap строк означает
    // «возможно, есть ещё». При строгом «больше» последняя страница молча выдавалась
    // бы за полную.
    const { exportTruncated } = await import("../src/routes/constitutionWaitlist");
    expect(exportTruncated("postgres", 5000, 5000)).toBe(true);
    expect(exportTruncated("postgres", 4999, 5000)).toBe(false);
    expect(exportTruncated("postgres", 5001, 5000)).toBe(true);
  });

  test("память обрезанной не считается — там предел не применялся", async () => {
    const { exportTruncated } = await import("../src/routes/constitutionWaitlist");
    expect(exportTruncated("memory", 99999, 5000)).toBe(false);
  });

  test("обработчик пользуется этой же функцией, а не своей копией", async () => {
    // Иначе проверка выше охраняла бы функцию, которую никто не зовёт — класс,
    // уже пойманный в этом проекте не раз.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "src", "routes", "constitutionWaitlist.ts"), "utf8");
    expect(src).toMatch(/const truncated = exportTruncated\(source, rows\.length, ROW_CAP\)/);
    expect(src).not.toMatch(/const truncated = source === "postgres" && rows\.length >= ROW_CAP/);
  });
});
