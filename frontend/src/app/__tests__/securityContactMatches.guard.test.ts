import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
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
    // `{/*` добавлен 21.08.2026: JSX-комментарии этот отсев пропускал,
    // и адрес из пояснения «почему НЕ этот домен» считался обещанием.
    // Ложная тревога в стороже опаснее пропуска: на неё перестают смотреть.
    return (
      !t.startsWith("//") && !t.startsWith("*") &&
      !t.startsWith("/*") && !t.startsWith("{/*")
    );
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

// ──────────────────────────────────────────────────────────────────────────
// ДОБАВЛЕНО 21.08.2026: отдельная, БОЛЕЕ ШИРОКАЯ проверка.
//
// Поправка к первой редакции этого блока. Я написал, что сторож выше «знал
// правило и стерёг 12% случаев» — это НЕСПРАВЕДЛИВО. Он проверяет строки с
// `security@`, то есть адрес раскрытия уязвимостей, и для СВОЕГО предмета
// очерчен точно. Я сравнил его с чужой задачей.
//
// Задача здесь другая и шире: НИКАКОЙ публичный адрес не должен стоять на
// домене без почты. Замер 21.08.2026: у `aevion.app` записей MX нет (контроль:
// у gmail.com их 5), а на сайте такие адреса встречаются в восьми файлах —
// среди них /terms, /qstore и панель партнёра.
//
// Почему список ожидающих, а не немедленный отказ: починка — это либо завести
// почту домену (панель DNS, рука основателя), либо заменить адреса на читаемый
// ящик (решение о позиционировании, тоже его). Пока решения нет, сторож держит
// ГРАНИЦУ: новых мест не прибавится, а список тает по мере починки.

function allSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__" || name === ".next") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) allSourceFiles(full, acc);
    else if (/\.tsx?$/.test(name)) acc.push(full);
  }
  return acc;
}

// Файлы, где адреса на домене без почты ещё остались. Список тает; новые
// записи сюда добавлять НЕЛЬЗЯ — в этом весь смысл.
const PENDING_FILES = new Set([
  "app/api/payments/v1/_email.ts",
  "app/build/onboarding/page.tsx",
  "app/constitution/pricing/page.tsx",
  "app/constitution/showcase/page.tsx",
  "app/developers/fintech/troubleshooting/page.tsx",
  "app/devhub/[id]/page.tsx",
  "app/pricing/affiliate-dashboard/page.tsx",
  "app/pricing/glossary/page.tsx",
  // app/pricing/page.tsx убрана 01.09.2026: mailto в подписи к FAQ заменён ссылкой на форму связи.
  // app/pricing/refund-policy убрана 01.09.2026: главная кнопка и шаг 1 процедуры возврата вели на ящик домена без MX; переведено на форму на двух языках.
  "app/qcoreai/budget/page.tsx",
  "app/qstore/page.tsx",
  "app/terms/page.tsx",
  "lib/build/calendar.ts",
  // 28.08.2026: строки уехали из lib/i18n-data.ts в один файл на язык
  // (lib/i18n-lang/*.ts). Адреса те же самые — это ПЕРЕЕЗД, а не новое
  // нарушение, поэтому запись заменена на три файла, где они теперь лежат.
  // Сам i18n-data.ts убран из списка: там осталась только метаинформация о
  // языках, и держать его здесь значило бы охранять пустоту — вторая проверка
  // этого сторожа («список не протух») на этом и краснела бы.
  "lib/i18n-lang/en.ts",
  "lib/i18n-lang/kk.ts",
  "lib/i18n-lang/ru.ts",
  // lib/pricingI18n.ts убран 01.09.2026: страница возврата денег звала писать на
  // billing@aevion.app — ящик домена без записи MX. Это был худший случай
  // класса: человек, которому нужен ВОЗВРАТ, отправлял письмо в пустоту, и это
  // стояло ШАГОМ 1 процедуры. Шесть мест на двух языках переведены на форму
  // связи; сторож сам потребовал сократить список проверкой «не протух».
]);

describe("адреса на домене без почты не расползаются", () => {
  const SRC = join(ROOT, "src");
  const files = allSourceFiles(SRC);

  test("контроль прибора: файлы найдены и правило непустое", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(DOMAINS_WITHOUT_MAIL.length).toBeGreaterThan(0);
  });

  test("новых файлов с такими адресами не появилось", () => {
    const offenders: string[] = [];
    for (const full of files) {
      const rel = full.slice(SRC.length + 1).split("\\").join("/");
      const lines = proseLines(readFileSync(full, "utf8"));
      const hit = lines.some((l) =>
        [...DOMAINS_WITHOUT_MAIL, ...FOREIGN_DOMAINS].some((d) => l.includes(d)),
      );
      if (hit && !PENDING_FILES.has(rel)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test("список ожидающих не протух: каждый файл всё ещё нарушает", () => {
    const stale: string[] = [];
    for (const rel of PENDING_FILES) {
      let lines: string[] = [];
      try {
        lines = proseLines(readFileSync(join(SRC, rel), "utf8"));
      } catch {
        stale.push(rel + " (файла нет)");
        continue;
      }
      const hit = lines.some((l) =>
        [...DOMAINS_WITHOUT_MAIL, ...FOREIGN_DOMAINS].some((d) => l.includes(d)),
      );
      if (!hit) stale.push(rel + " (уже починен — уберите из списка)");
    }
    expect(stale).toEqual([]);
  });
});
