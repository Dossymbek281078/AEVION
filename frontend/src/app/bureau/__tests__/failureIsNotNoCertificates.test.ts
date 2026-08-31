/**
 * Bureau запускается 10 сентября (дата перенесена основателем 29-30.08;
 * прежде здесь стояло «вторым, 6 сентября»), и у него тот же класс, что нашёлся
 * сегодня в шахматах и qgood: при сбое загрузки страница писала
 * «No certificates yet — Protect your first work to see it here», то есть
 * предлагала начать заново человеку, у которого работы уже защищены.
 *
 * Проверяем ОБА условия: и сообщение об отказе, и то, что признак реально
 * поднимается в ветке ошибки. Час назад точно такая правка в этом же обходе
 * оказалась декоративной — состояние и текст были, а признак не поднимался
 * нигде.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const PAGE = path.join(__dirname, "..", "page.tsx");
const src = fs.readFileSync(PAGE, "utf8");

describe("bureau: отказ отличим от «сертификатов нет»", () => {
  it("есть сообщение об отказе", () => {
    expect(src.includes("Не удалось загрузить сертификаты")).toBe(true);
  });

  it("признак поднимается и в else, и в catch", () => {
    const at = src.indexOf("/api/pipeline/certificates");
    expect(at).toBeGreaterThan(-1);
    const block = src.slice(at, at + 900);

    // ⚠️ Ужесточено 28.08.2026 после мутационной проверки. Прежние шаблоны
    // искали признак в окне 200 и 120 символов ПОСЛЕ ключевого слова, а обе
    // ветки стоят через строку друг от друга — поэтому ОДИН вызов попадал в
    // оба окна. Мутация «убрать вызов из else» сторожа пережила: он не
    // различал «признак ставят обе ветки» и «ставит только одна».
    //
    // Теперь считаем ВХОЖДЕНИЯ и проверяем каждую ветку своим узким окном.
    const calls = block.match(/setCertsFailed\(true\)/g) || [];
    expect(calls.length, "признак ставится не в обеих ветках").toBeGreaterThanOrEqual(2);

    const elseAt = block.indexOf("} else {");
    expect(elseAt, "у ветки res.ok нет else вовсе").toBeGreaterThan(-1);
    expect(
      block.slice(elseAt, elseAt + 60).includes("setCertsFailed(true)"),
      "у ветки res.ok нет else с признаком",
    ).toBe(true);

    const catchAt = block.indexOf("catch");
    expect(catchAt, "нет обработчика исключения вовсе").toBeGreaterThan(-1);
    expect(
      block.slice(catchAt, catchAt + 60).includes("setCertsFailed(true)"),
      "обработчик исключения молчит",
    ).toBe(true);
  });

  it("отказ показывается раньше пустого списка", () => {
    const failed = src.indexOf("certsFailed ? (");
    const empty = src.indexOf("certificates.length === 0 ? (");
    expect(failed).toBeGreaterThan(-1);
    expect(empty).toBeGreaterThan(-1);
    expect(failed).toBeLessThan(empty);
  });
});
