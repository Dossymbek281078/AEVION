import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "./helpers/sourceCode";

/**
 * StartupX не должен утверждать регистрацию, которой не делает.
 *
 * Замер 19.08.2026:
 *
 *   const qrightObjectId: string | null = null;
 *   const qrightProtected = true;   // отдавалось ВСЕГДА
 *
 * Никакого обращения к реестру QRight в файле нет. Считается SHA-256 от полей
 * идеи — и всё. При этом витрина рисует по этому полю значок «QRight» и пишет
 * «Идея #N защищена», а модуль называется «биржа ЗАЩИЩЁННЫХ идей» и стоит
 * $29/мес.
 *
 * Пояснительный текст страницы честен («QRight-совместимая схема», «позже можно
 * перенести в реестр»), но человек читает короткое, а не абзац ниже. Основатель
 * отдаёт идею, считая её зарегистрированной.
 *
 * Поле оставлено, чтобы не сломать витрину, которую правят пять чужих веток.
 * Рядом идут два честных — по ним интерфейс может сказать правду, не гадая.
 * Замена значка и формулировки вынесена на доску запуска.
 */

const SRC = stripComments(readFileSync(join(__dirname, "..", "src", "routes", "startupExchange.ts"), "utf8"));

describe("StartupX говорит правду о защите", () => {
  test("контроль: файл прочитан и содержит ключевые места", () => {
    expect(SRC.length).toBeGreaterThan(1000);
    expect(SRC).toContain("computeContentHash");
    expect(SRC).toContain("qrightProtected");
  });

  test("регистрация в реестре не утверждается наперёд", () => {
    // qrightRegistered обязан ВЫЧИСЛЯТЬСЯ из наличия записи, а не быть true.
    expect(SRC, "qrightRegistered снова зашит константой").toMatch(
      /const qrightRegistered = qrightObjectId !== null;/,
    );
    expect(SRC).not.toMatch(/qrightRegistered = true/);
  });

  test("ответ называет, что фактически сделано", () => {
    expect(SRC, "нет поля protection — интерфейс не сможет сказать правду").toMatch(
      /const protection = "content-hash" as const;/,
    );
  });

  // ПРОВЕРКА ХРАНИЛИЩА ПЕРЕЕХАЛА — и это не косметика.
  //
  // Здесь стояло `expect(SRC).toMatch(/storage: "db"/)`. 29.08.2026 два пути
  // записи свелись в один помощник, хранилище стало приходить аргументом:
  // способность сохранилась, дословная строка исчезла, сторож покраснел на
  // ВЕРНОЙ правке. Я переписал шаблон — и мутация показала, что новый
  // совпадает с собственной подпоркой: `storage:` есть в сигнатуре, а
  // `"memory"` в типе. То есть обе версии были декоративными: убери поле
  // storage из ответа — обе останутся зелёными (проверено мутацией).
  //
  // Грепом этот класс не стережётся. Проверять надо ОТВЕТ:
  //   tests/startupxStorageIsNamed.test.ts — поднимает роутер без базы и
  //   требует, чтобы ответ сказал "memory". Обе мутации там ловятся.

  test("в файле по-прежнему НЕТ обращения к реестру QRight", () => {
    // Если однажды появится — это хорошая новость, но тогда qrightProtected
    // должен перестать быть историческим именем, и тест обязан об этом сказать.
    const callsRegistry = /qright.*(fetch|pool\.query\(.*QRight|registerIn)/i.test(SRC);
    expect(
      callsRegistry,
      "появилось обращение к реестру — пересмотрите смысл qrightProtected и текст витрины",
    ).toBe(false);
  });
});
