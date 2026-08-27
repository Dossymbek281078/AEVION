import { describe, test, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Счётчик суточного потолка писем видит не все пути отправки.
 *
 * Замер 27.08.2026. У нас два провайдера и восемь файлов, которые обращаются к
 * ним напрямую. `noteEmailSent` из lib/brevoQuota зовут ДВА из них — и оба
 * на Brevo, тогда как /api/auth/email/healthz на проде отвечает, что живой
 * транспорт сейчас Resend (smtp not configured, resend configured).
 *
 * То есть счётчик стоит у той двери, через которую мы больше не ходим. Потолок
 * при этом общий на аккаунт: выберет его одна рассылка — молча перестанут
 * уходить письма подтверждения адреса, отклики и оповещения. Молчаливо, потому
 * что провайдер ответит отказом, а вызывающий код письма не роняет.
 *
 * Сторож НЕ требует починить всё разом: правка тронула бы шесть файлов в чужих
 * зонах. Он делает другое — фиксирует известный список и краснеет, когда
 * появляется НОВЫЙ неучтённый путь. Всегда красный сторож перестают читать
 * (см. feedback_audit_that_is_always_red), поэтому здесь храповик, а не запрет.
 *
 * Починка засчитывается уменьшением списка: убрали файл из KNOWN_UNCOUNTED —
 * сторож проверит, что он и правда считает.
 */

const SRC = join(__dirname, "..", "src");

/** Прямое обращение к провайдеру письма — то, что тратит суточный потолок. */
const SENDS_RE = /api\.resend\.com|api\.brevo\.com|api\.sendinblue\.com/;
const COUNTS_RE = /noteEmailSent/;

/**
 * Известные неучтённые пути на 27.08.2026. Список обязан только СОКРАЩАТЬСЯ.
 * Пути относительно src, с прямыми косыми — иначе сравнение развалится на
 * Windows.
 */
const KNOWN_UNCOUNTED = [
  "lib/build/email.ts",
  "routes/build/alerts.ts",
  "routes/build/applications.ts",
  "routes/build/vacancies.ts",
  "routes/build/verification.ts",
  "routes/provisioning.ts",
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (name.endsWith(".ts")) acc.push(full);
  }
  return acc;
}

function rel(full: string): string {
  return full.slice(SRC.length + 1).split("\\").join("/");
}

function sendingFiles(): { path: string; counts: boolean }[] {
  return walk(SRC)
    .map((full) => ({ full, text: readFileSync(full, "utf8") }))
    .filter(({ text }) => SENDS_RE.test(text))
    .map(({ full, text }) => ({ path: rel(full), counts: COUNTS_RE.test(text) }));
}

describe("суточный потолок писем: счётчик обязан видеть каждый путь отправки", () => {
  test("прибор находит хоть что-то — иначе зелёный ничего не значит", () => {
    // Отрицательный контроль к самому сторожу. Если регулярка перестанет
    // находить обращения к провайдерам (переехали на SDK, сменили хост), тест
    // ниже станет зелёным по пустому множеству и будет врать спокойствием.
    const files = sendingFiles();
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  test("новых неучтённых путей отправки не появилось", () => {
    const uncounted = sendingFiles().filter((f) => !f.counts).map((f) => f.path).sort();
    const fresh = uncounted.filter((p) => !KNOWN_UNCOUNTED.includes(p));
    expect(fresh, `новый путь шлёт письма мимо счётчика суточного потолка: ${fresh.join(", ")}`).toEqual([]);
  });

  test("починенное остаётся починенным: список известных только сокращается", () => {
    const uncounted = sendingFiles().filter((f) => !f.counts).map((f) => f.path);
    const goneFromList = KNOWN_UNCOUNTED.filter((p) => !uncounted.includes(p));
    // Файл, который вышел из списка, обязан либо считать письма, либо не слать
    // их вовсе. Проверяем вслух, чтобы «починка» не оказалась переименованием.
    for (const p of goneFromList) {
      const all = sendingFiles().find((f) => f.path === p);
      if (all) expect(all.counts, `${p} убран из списка, но письма всё ещё не считает`).toBe(true);
    }
    expect(uncounted.length).toBeLessThanOrEqual(KNOWN_UNCOUNTED.length);
  });
});
