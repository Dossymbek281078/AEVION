import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Интерфейс платного модуля не показывает покупателю настройки НАШЕГО сервера.
 *
 * Замер 28.08.2026. В рабочем окне DevHub нашлось 16 мест, где имена переменных
 * окружения выводились человеку — и не подсказкой при наведении, а постоянным
 * видимым текстом под панелями:
 *
 *   «Server env: ELEVENLABS_API_KEY»
 *   «Requires CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in Railway.»
 *   «Powered by Replicate API. Requires REPLICATE_API_TOKEN in Railway.»
 *
 * Три беды сразу. Покупателю это БЕСПОЛЕЗНО: настройки нашего сервера ему
 * недоступны, а совет, который нельзя выполнить, хуже молчания — он выглядит
 * объяснением и заставляет искать несуществующую кнопку. Наружу уходит
 * устройство системы: провайдеры, хостинг и точные имена ключей. И всё это
 * по-английски на русском экране.
 *
 * Модуль выходит 10.09 по $149/мес, то есть это увидит платящий человек.
 *
 * ЧТО РАЗРЕШЕНО. Переменные ЕГО СОБСТВЕННОГО проекта — например `DATABASE_URL`,
 * которую DevHub кладёт в Env Vars созданного приложения, — человеку нужны, и
 * прятать их было бы вредно. Отличие простое: это настройка, к которой у него
 * есть доступ, а не наша.
 */

const DIR = path.join(__dirname, "..");

/** Имена, похожие на серверную настройку: ИМЯ_С_ПОДЧЁРКИВАНИЯМИ_KEY|TOKEN|... */
const ENVISH = /\b[A-Z][A-Z0-9_]{4,}_(?:TOKEN|KEY|SECRET|ID|URL|HOST|PASS)\b/g;

/**
 * Настройки ПОЛЬЗОВАТЕЛЬСКОГО проекта — их показывать нужно.
 * Список поимённый и с причиной: перечень без причин через месяц становится
 * местом, куда дописывают, чтобы сторож замолчал.
 */
const ALLOWED = new Set([
  // Строка подключения к базе СОЗДАННОГО приложения: лежит в его Env Vars,
  // человек её копирует и вставляет в свой код.
  "DATABASE_URL",
]);

function uiFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "__tests__") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...uiFiles(p));
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}

describe("экран DevHub не выдаёт настройки сервера", () => {
  it("прибор работает: файлы находятся, шаблон различает настройку и константу", () => {
    const files = uiFiles(DIR);
    expect(files.length).toBeGreaterThan(3);
    expect("CLOUDFLARE_API_TOKEN".match(ENVISH)).not.toBeNull();
    // Обычная константа кода настройкой не считается — иначе сторож утонет в шуме.
    expect("STACK_LABELS".match(ENVISH)).toBeNull();
  });

  it("ни одного имени серверной настройки в исходниках интерфейса", () => {
    const bad: string[] = [];
    for (const f of uiFiles(DIR)) {
      const lines = fs.readFileSync(f, "utf8").split("\n");
      lines.forEach((l, i) => {
        const t = l.trim();
        // Комментарии пропускаем: они объясняют устройство разработчику и
        // на экран не попадают. Этот же сторож ссылается на имена в своей шапке.
        if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return;
        for (const m of l.match(ENVISH) ?? []) {
          if (!ALLOWED.has(m)) bad.push(`${path.basename(f)}:${i + 1} ${m}`);
        }
      });
    }
    expect(bad, "имя настройки нашего сервера видно покупателю").toEqual([]);
  });

  it("исчезли и вводные слова, которыми эти сноски начинались", () => {
    const all = uiFiles(DIR)
      .map((f) => fs.readFileSync(f, "utf8"))
      .join("\n")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"))
      .join("\n");
    expect(all, "сноска «Server env:» вернулась").not.toContain("Server env:");
    expect(all, "инструкция «set … on the server» вернулась").not.toMatch(/set [A-Z0-9_]+ on the server/);
  });
});

/**
 * Значение сервера не живёт в модуле сырым — ни на показе, ни в структуре.
 *
 * Третья редакция за ночь, путь тот же, что у серверного близнеца: сперва
 * правило знало список из пяти имён переменных (их оказалось десять), потом
 * смотрело только на строку ПОКАЗА — и пропускало вход в структуру:
 *
 *   const issue = { error: d.error };   // вход, раньше не виден
 *   setGithubMsg(issue.error);          // показ, здесь уже наше поле
 *
 * Теперь условий нет вовсе: любое <имя>.error без переводчика — нарушение,
 * кроме перечисленного ниже С ПРИЧИНАМИ. Правило перестаёт угадывать, где
 * значение опасно, и вместе с тем перестаёт занижать свой охват.
 */
describe("значение сервера не остаётся сырым", () => {
  const ALLOWED: Array<[string, string]> = [
    ["if (d.error) {", "условие, значение не идёт дальше"],
    ["errorKind: d.errorKind", "это ВИД ошибки, машинный ярлык, а не текст"],
    ["githubIssue?.error &&", "условие показа блока"],
    ["r.outputPath || r.error", "поле переведено на входе (setBulkResults)"],
    ["res.ok ? (res.savedAs", "поле переведено на входе"],
  ];

  it("ни одного сырого <имя>.error", () => {
    const files = uiFiles(DIR);
    expect(files.length, "обход не нашёл файлов").toBeGreaterThan(3);
    let wrapped = 0;
    const bad: string[] = [];
    for (const f of files) {
      const lines = fs.readFileSync(f, "utf8").split(String.fromCharCode(10));
      lines.forEach((l, i) => {
        if (l.includes("devhubServerError") || l.includes("serverError(")) { wrapped++; return; }
        if (!l.includes(".error")) return;
        if (l.includes("e.error") || l.includes("err.error")) return;
        if (ALLOWED.some(([frag]) => l.includes(frag))) return;
        bad.push(`${f.split("devhub").pop()}:${i + 1}`);
      });
    }
    // Контроль прибора: без обёрнутых мест пустой список нарушителей означал бы
    // сломанный разбор, а не порядок.
    expect(wrapped, "ни одного devhubServerError — разбор не сработал").toBeGreaterThan(10);
    expect(
      bad,
      "сырое значение сервера: оберните devhubServerError(x.error, «фраза») — лучше в точке ВХОДА",
    ).toEqual([]);
  });
});
