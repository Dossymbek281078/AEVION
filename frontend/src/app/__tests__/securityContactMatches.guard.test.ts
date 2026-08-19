import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Канал раскрытия уязвимостей — один, и он должен совпадать в двух местах.
 *
 * Замер 19.08.2026: `/.well-known/security.txt` называл один адрес, а страница
 * безопасности — другой, `security@aevion.app`, 13 раз вместе с переводами.
 * У домена aevion.app записи MX НЕТ: письма на него отбиваются. То есть
 * исследователь, пришедший со страницы, сообщить не мог, а пришедший по
 * машиночитаемому файлу — мог. Половина канала работала, и снаружи это
 * выглядело исправным.
 *
 * Почему тестом. Адрес на странице про безопасность выглядит как косметика, и
 * его легко «улучшить» обратно на красивый вида security@наш-домен. Пока у
 * домена нет почты, такое улучшение молча выключает канал.
 */

const ROOT = join(__dirname, "..", "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** Домены без записи MX — письмо на них не доходит. Проверено отправкой. */
const DOMAINS_WITHOUT_MAIL = ["@aevion.app"];
/** Домен чужой компании с тем же названием — туда нельзя вести никого. */
const FOREIGN_DOMAINS = ["@aevion.io"];

function contactFromSecurityTxt(): string {
  const txt = read("public/.well-known/security.txt");
  const m = txt.match(/^Contact:\s*mailto:(\S+)\s*$/m);
  expect(m, "в security.txt нет строки Contact: mailto:").not.toBeNull();
  return m![1].trim();
}

/** Строки кода без комментариев — обещание пользователю, а не заметка о нём. */
function proseLines(src: string): string[] {
  return src.split("\n").filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  });
}

describe("канал раскрытия уязвимостей не расходится сам с собой", () => {
  test("контроль: security.txt читается и даёт адрес", () => {
    // Иначе все проверки ниже сравнивали бы с пустой строкой и проходили всегда.
    const c = contactFromSecurityTxt();
    expect(c).toMatch(/@/);
    expect(c.length).toBeGreaterThan(5);
  });

  test("страница безопасности зовёт по тому же адресу, что security.txt", () => {
    const contact = contactFromSecurityTxt();
    const page = read("src/app/pricing/security/page.tsx");
    expect(
      page.includes(contact),
      `страница не называет ${contact} — исследователь со страницы и исследователь ` +
        `из security.txt пишут в разные места`,
    ).toBe(true);
  });

  for (const file of ["src/app/pricing/security/page.tsx", "src/lib/i18n-data.ts"]) {
    test(`${file} не зовёт на домен без почты или на чужой`, () => {
      const lines = proseLines(read(file));
      for (const d of [...DOMAINS_WITHOUT_MAIL, ...FOREIGN_DOMAINS]) {
        const hits = lines.filter((l) => l.includes("security@") && l.includes(d));
        expect(
          hits,
          `${file}: адрес на ${d} не доходит — сообщения об уязвимостях пропадают молча`,
        ).toEqual([]);
      }
    });
  }

  test("контроль: проверка умеет отличать комментарий от кода", () => {
    // Разбор адреса живёт в комментарии того же файла — если бы проверка
    // считала и его, она краснела бы на собственном объяснении.
    const page = read("src/app/pricing/security/page.tsx");
    expect(page, "разбор из комментария пропал — верните объяснение").toContain("записи MX");
    expect(proseLines(page).join("\n")).not.toContain("записи MX");
  });
});
