import { describe, test, expect } from "vitest";
import { redactInfraDetails } from "../src/lib/safeErrorText";

/**
 * Устройство нашей сети не уходит клиенту вместе с текстом ошибки.
 *
 * Класс найден соседней сессией в QSkyway (коммит 3df0a4fdc от 28.08.2026):
 * при отказе хранилища посетителю уходил внутренний адрес и порт базы. Здесь
 * та же логика вынесена в общий модуль и применяется в DevHub.
 *
 * Тексты ниже — НАСТОЯЩИЕ сообщения драйверов, а не выдуманные. Выдуманный
 * вход проверял бы мою фантазию: я бы придумал ровно то, что мой же код и
 * умеет прятать.
 */
describe("текст ошибки не выдаёт устройство системы", () => {
  const REAL = [
    "connect ECONNREFUSED 10.130.0.7:5432",
    "getaddrinfo ENOTFOUND db-primary.internal",
    'permission denied for role "devhub_rw"',
    "connection to server at 172.31.4.19, port 5432 failed: FATAL: password authentication failed for user=aevion_app",
  ];

  test("адреса, порты, роли и пользователи базы не проходят", () => {
    // Контроль прибора: список не должен быть пустым, иначе цикл ниже
    // «проходит» ничего не проверив.
    expect(REAL.length).toBeGreaterThan(3);
    for (const raw of REAL) {
      const out = redactInfraDetails(new Error(raw));
      expect(out, raw).not.toMatch(/[0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}[.][0-9]{1,3}/);
      expect(out, raw).not.toContain("devhub_rw");
      expect(out, raw).not.toContain("aevion_app");
    }
  });

  test("IPv6 прячется так же, как IPv4", () => {
    // Первая версия правила знала только IPv4, и адрес вида [::1]:5432
    // проходил насквозь. Найдено 29.08.2026 прогоном на реальных формах,
    // а не чтением: правило выглядело исчерпывающим.
    for (const raw of ["connect ECONNREFUSED [::1]:5432",
                       "no route to host 2a03:2880:f12f:83:face:b00c:0:25de"]) {
      const out = redactInfraDetails(new Error(raw));
      expect(out, raw).not.toContain("::1");
      expect(out, raw).not.toContain("2a03");
      expect(out, raw).toContain("скрыт");
    }
  });

  test("учётные данные и имена в КАВЫЧКАХ тоже прячутся", () => {
    // Найдено прогоном форм списком: правило знало только user=, а
    // Postgres чаще пишет user "app". Заодно наружу шли имя базы и
    // путь к сокету — та же форма записи, тот же класс.
    const cases: Array<[string, string]> = [
      ["password authentication failed for user " + JSON.stringify("app_rw"), "app_rw"],
      ["FATAL: database " + JSON.stringify("aevion_prod") + " does not exist", "aevion_prod"],
      ["could not connect to server on socket " + JSON.stringify("/var/run/postgresql/x"), "/var/run"],
    ];
    expect(cases.length).toBeGreaterThan(2);
    for (const [raw, secret] of cases) {
      expect(redactInfraDetails(new Error(raw)), raw).not.toContain(secret);
    }
  });

  test("имя таблицы остаётся — оно помогает разбирать отказ", () => {
    // Граница: прячем то, что описывает НАШУ инфраструктуру, а не то,
    // что объясняет причину. Имя таблицы карту сети не выдаёт.
    const out = redactInfraDetails(new Error("relation " + JSON.stringify("DevHubFile") + " does not exist"));
    expect(out).toContain("DevHubFile");
  });

  test("обычное время не принимается за адрес", () => {
    // Обратный контроль: правило, вычищающее лишнее, портит сообщения
    // и этим так же мешает разбирать отказ.
    const out = redactInfraDetails(new Error("произошло в 12:34:56 при выгрузке"));
    expect(out).toContain("12:34:56");
  });

  test("причина остаётся видимой — иначе разбирать нечего", () => {
    // Обратный контроль: вычищать всё подряд так же плохо. «Не получилось»
    // без причины не отличает отказ базы от нашей поломки.
    const out = redactInfraDetails(new Error("connect ECONNREFUSED 10.130.0.7:5432"));
    expect(out).toContain("ECONNREFUSED");
  });

  test("длина ограничена — стек не уезжает клиенту", () => {
    const out = redactInfraDetails(new Error("x".repeat(5000)));
    expect(out.length).toBeLessThanOrEqual(200);
  });

  test("не падает на том, что вовсе не Error", () => {
    expect(redactInfraDetails(undefined)).toBe("undefined");
    expect(redactInfraDetails({ a: 1 })).toContain("object");
  });
});
