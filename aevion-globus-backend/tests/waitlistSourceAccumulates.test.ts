import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildWaitlistConfirmEmail } from "../src/lib/constitutionBrevo";

// Интерес накапливается, а не затирается — 19.08.2026.
//
// Адрес в таблице уникален, и при повторной подписке источник ПЕРЕЗАПИСЫВАЛСЯ
// последним: человек, оставивший адрес на посадочной шахмат и потом на DevHub,
// оставался только как `devhub`. При четырёх посадочных (шахматы 30.08, бюро
// 06.09, DevHub 13.09, мультичат 20.09) это значит, что в рассылку про шахматы
// он не попадёт — а до неё одиннадцать дней.
//
// Починка тройная, и каждая часть без остальных бесполезна:
//   1. SQL дописывает метку вместо перезаписи;
//   2. развилка письма читает ВХОЖДЕНИЕ метки, а не начало строки — иначе
//      «cyberchess,constitution» перестало бы считаться конституционным;
//   3. роут ПЕРЕДАЁТ source в письмо — без этого развилка считает всех
//      конституционными, и человек с главной получает обещание скидки, о которой
//      не просил.
//
// Третья часть — след сведения из двух ветвей: файл письма пришёл из одной,
// роут из другой, и вызов остался старым. Поэтому здесь проверяется СВЯЗЬ между
// файлами, а не наличие починки в каждом.

const SRC = join(__dirname, "..", "src");

describe("развилка письма понимает список меток", () => {
  test("конституционный подписчик получает конституционное письмо", () => {
    const mail = buildWaitlistConfirmEmail("kto@primer.ru", "constitution");
    expect(mail.subject).toMatch(/Constitution/i);
  });

  test("метка конституции ВТОРОЙ в списке — письмо всё равно конституционное", () => {
    // Главный случай починки. По прежнему условию `/^constitution/` эта строка
    // дала бы «не наш» и человек получил бы письмо про ранний доступ.
    const mail = buildWaitlistConfirmEmail("kto@primer.ru", "cyberchess,constitution");
    expect(mail.subject).toMatch(/Constitution/i);
  });

  test("подписчик модуля получает письмо про ранний доступ, а не про скидку", () => {
    const mail = buildWaitlistConfirmEmail("kto@primer.ru", "devhub-instagram");
    expect(mail.subject).not.toMatch(/Constitution Pro/i);
    const all = `${mail.subject} ${mail.htmlContent}`;
    // Скидка обещана только на конституционном пути — там это решено.
    expect(all).not.toMatch(/30%/);
  });

  test("список из двух модулей без конституции — тоже не конституционное", () => {
    const mail = buildWaitlistConfirmEmail("kto@primer.ru", "cyberchess,devhub");
    expect(mail.subject).not.toMatch(/Constitution Pro/i);
  });

  test("пустой источник считается конституционным — как было до развилки", () => {
    // Обратная совместимость: старые записи в базе имеют source «unknown» или
    // пустой, и менять для них письмо задним числом не наше решение.
    expect(buildWaitlistConfirmEmail("kto@primer.ru").subject).toMatch(/Constitution/i);
    expect(buildWaitlistConfirmEmail("kto@primer.ru", "").subject).toMatch(/Constitution/i);
  });

  test("регистр и пробелы в метке не меняют выбор письма", () => {
    const mail = buildWaitlistConfirmEmail("kto@primer.ru", " CyberChess , Constitution ");
    expect(mail.subject).toMatch(/Constitution/i);
  });
});

describe("связь между файлами: source обязан доехать до письма", () => {
  test("роут передаёт source в sendWaitlistConfirm", () => {
    // Именно здесь порвалось при сведении ветвей: развилка была, а вызов остался
    // однопараметрическим — и все письма шли конституционными. Проверяем текстом
    // исходника, потому что дефект был в СВЯЗИ, а не в поведении одного модуля.
    const route = readFileSync(join(SRC, "routes", "constitutionWaitlist.ts"), "utf8");
    expect(route).toMatch(/sendWaitlistConfirm\(\s*row\.email\s*,\s*row\.source\s*\)/);
  });

  test("подпись функции принимает source", () => {
    const brevo = readFileSync(join(SRC, "lib", "constitutionBrevo.ts"), "utf8");
    expect(brevo).toMatch(/sendWaitlistConfirm\(\s*email:\s*string,\s*source\?:\s*string/);
  });
});

describe("SQL дописывает метку, а не затирает", () => {
  const route = readFileSync(join(SRC, "routes", "constitutionWaitlist.ts"), "utf8");

  test("прежней безусловной перезаписи больше нет", () => {
    // Ровно та строка, что теряла первый интерес.
    expect(route).not.toMatch(/DO UPDATE SET "source" = EXCLUDED\."source"\s*`/);
  });

  test("новая метка дописывается в конец, а существующая не дублируется", () => {
    expect(route).toMatch(/string_to_array/);
    expect(route).toMatch(/\|\|\s*','\s*\|\|\s*EXCLUDED\."source"/);
  });

  test("обрезка идёт по целой метке, а не по числу символов", () => {
    // Обрубленная посередине метка («devh») не совпала бы ни с чем при отборе
    // получателей — то есть тихо выкинула бы человека из рассылки.
    expect(route).toMatch(/position\(','/);
    expect(route).not.toMatch(/DO UPDATE SET "source" = left\(EXCLUDED/);
  });
});
