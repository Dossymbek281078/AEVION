import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Сторож: ручки, которым ОПУБЛИКОВАННАЯ спецификация обещает HealthResponse,
 * действительно отдают её поля.
 *
 * ЗАЧЕМ. 29.08.2026 живой /api/qpaynet/health отдавал status, service,
 * wallets, pool, encryption, stuckWebhookDeliveries — и НЕ отдавал timestamp,
 * который обещает общая схема HealthResponse в openapiFintechSpec. Все
 * соседние health-ручки поле отдавали; эта одна — нет. Клиент, разбирающий
 * ответ по НАШЕМУ ЖЕ контракту, получал undefined.
 *
 * Спецификация публикуется наружу, то есть это не внутренняя мелочь: по ней
 * пишут интеграции.
 *
 * ГРАНИЦА. Проверяем только модули, названные в спецификации, и только
 * НАЛИЧИЕ имени поля в теле ответа. Общий запрет «у любого health должен быть
 * timestamp» краснел бы на пяти законных случаях (i18n, qcontract,
 * qtradeoffline) — их контракт наружу не публикуется.
 */
const СПЕКА = join(__dirname, "..", "src", "lib", "openapiFintechSpec.ts");
const РОУТЫ = join(__dirname, "..", "src", "routes");

/** Поля, которые обещает общая схема HealthResponse. */
const ОБЕЩАНО = ["status", "service", "timestamp"];

describe("обещанные спецификацией поля health действительно отдаются", () => {
  it("каждый модуль из спецификации отдаёт status, service и timestamp", () => {
    const спека = readFileSync(СПЕКА, "utf8");
    const пути = [
      ...спека.matchAll(
        /"\/api\/([a-z0-9-]+)\/health":\s*\{\s*get:[\s\S]{0,1200}?\$ref:\s*"#\/components\/schemas\/HealthResponse"/g,
      ),
    ].map((m) => m[1]);

    // Знаменатель вслух: пустой список читался бы как «нарушений нет».
    expect(пути.length, "в спецификации не найдено health-путей — сломан разбор").toBeGreaterThan(3);

    const нет: string[] = [];
    for (const модуль of пути) {
      const кандидаты = [
        join(РОУТЫ, `${модуль}.ts`),
        join(РОУТЫ, `${модуль.replace(/-/g, "")}.ts`),
        join(РОУТЫ, `${модуль.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}.ts`),
      ];
      const файл = кандидаты.find((p) => existsSync(p));
      if (!файл) {
        нет.push(`${модуль}: файл маршрута не найден — проверка НЕ выполнена`);
        continue;
      }
      const текст = readFileSync(файл, "utf8");
      // Привязываемся к САМОМУ обработчику /health, а не к первому вхождению
      // service: — в крупном файле их несколько, и окно уезжало не туда.
      // Первая версия сторожа именно так и оболгала qpaynet.
      const начало = текст.indexOf('.get("/health"');
      if (начало < 0) {
        нет.push(`${модуль}: обработчик /health не найден — проверка НЕ выполнена`);
        continue;
      }
      const окно = текст.slice(начало, начало + 1800);
      // Проверяем УСПЕШНЫЙ ответ, а не любой res.json в обработчике: ветка
      // отказа (res.status(503).json) отдаёт свою форму, и её наличие
      // маскировало бы пропажу поля в основном ответе. Поймано мутацией:
      // первая версия сторожа пережила удаление поля из успешной ветки.
      const усп = окно.indexOf("res.json({");
      if (усп < 0) {
        нет.push(`${модуль}: успешный res.json не найден — проверка НЕ выполнена`);
        continue;
      }
      const тело = окно.slice(усп, усп + 700);
      const пропуски = ОБЕЩАНО.filter((f) => !тело.includes(`${f}:`));
      if (пропуски.length) нет.push(`${модуль}: нет ${пропуски.join(", ")}`);
    }

    expect(
      нет,
      "Ручка не отдаёт поля, которые обещает опубликованная спецификация.\n" +
        "По ней пишут интеграции снаружи; недостающее поле придёт клиенту как\n" +
        "undefined.\n  " +
        нет.join("\n  "),
    ).toEqual([]);
  });
});
