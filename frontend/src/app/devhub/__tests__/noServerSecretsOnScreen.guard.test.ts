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
 * Модуль выходит 13.09 по $149/мес, то есть это увидит платящий человек.
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
 * Утечка бывает и ДИНАМИЧЕСКОЙ: имени ключа нет в нашем исходнике, оно
 * приходит с сервера в момент работы. Проверка выше её увидеть не может —
 * она ищет литералы. Замер 29.08.2026: так утекали три места, два из них
 * выкатка, то есть ручки, которые прямо отвечают "set VERCEL_TOKEN ...".
 *
 * Поэтому здесь проверяется УСТРОЙСТВО, а не текст: любой текст ошибки от
 * сервера обязан пройти через devhubServerError. Он и решает, что показать
 * человеку, а что увести в консоль.
 */
describe("текст ошибки сервера не показывается в обход переводчика", () => {
  it("каждый выброс с текстом сервера идёт через devhubServerError", () => {
    const files = uiFiles(DIR);
    expect(files.length, "обход не нашёл файлов — сторож ослеп").toBeGreaterThan(3);
    const bad: string[] = [];
    let wrapped = 0;
    for (const f of files) {
      const lines = fs.readFileSync(f, "utf8").split(String.fromCharCode(10));
      lines.forEach((l, i) => {
        // 29.08, второй заход: сперва шаблон знал только выброс исключения,
        // и восемь мест той же природы прошли мимо — текст сервера уходил
        // в setVideoError и showToast напрямую. Класс шире одной формы.
        const shows =
          l.includes("new Error(") ||
          l.includes("setError(") ||
          l.includes("setVideoError(") ||
          l.includes("showToast(");
        if (!shows) return;
        // Только то, что взято ПРЯМО из разобранного ответа сервера.
        // `e.message` сюда не входит намеренно: к моменту показа это уже
        // наш переведённый текст (перевод стоит в месте выброса), и
        // ловить его значило бы краснеть на исправном коде — а сторожа,
        // который всегда красный, перестают читать в первый же день.
        const fromServer = ["data.error", "d.error", "sd.error", "body.error", "json.error"].some(
          (k) => l.includes(k),
        );
        if (!fromServer) return;
        if (l.includes("devhubServerError")) { wrapped++; return; }
        bad.push(`${f.split("devhub").pop()}:${i + 1}`);
      });
    }
    // Контроль прибора: если бы обход ничего не разобрал, список нарушителей
    // был бы пуст по той же причине, что и при полном порядке.
    expect(wrapped, "ни одного обёрнутого выброса — разбор не сработал").toBeGreaterThan(3);
    expect(
      bad,
      "текст сервера уходит человеку мимо переводчика: оберните в devhubServerError(x.error, «понятная фраза»)",
    ).toEqual([]);
  });
});
