import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Витрина не имеет права называть нас сертифицированными, пока наш же источник
 * правды говорит «в процессе».
 *
 * Найдено 28.08.2026 на живом проде. Страница `aevion.app/pricing/glossary`
 * отдавала:
 *
 *   "AEVION is ISO 27001 certified for Enterprise tier"
 *   "AEVION is SOC 2 Type II certified"
 *
 * А `backend/src/data/trust.ts` про те же два идентификатора:
 *
 *   { id: "iso27001", status: "in progress (Q4 2026)" }
 *   { id: "soc2",     status: "in progress (Q3 2026)" }
 *
 * Две наши поверхности утверждали противоположное об одном и том же, и
 * покупатель видел ту, что говорит увереннее.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ СТОРОЖ, А НЕ СТРОКА В catalogClaims. Тот держит СПИСОК
 * уличённых формулировок руками — он ловит ровно то, что уже поймали. Здесь
 * проверка ВЫВОДИТСЯ из данных: сверяются идентификаторы, а не фразы. Появится
 * третий стандарт со статусом «в процессе» — сторож поймает его сам, без
 * правки.
 *
 * ⚠️ Направление важно: сторож запрещает называться сертифицированным при
 * незавершённом статусе, но НЕ требует обратного. Получим сертификат, поменяем
 * статус на "live" — сторож замолчит сам, и правка текста не будет заблокирована.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const trustPath = join(repoRoot, "aevion-globus-backend", "src", "data", "trust.ts");
const glossaryPath = join(here, "..", "pricing", "glossary", "page.tsx");
/**
 * Второй источник тех же утверждений — файл переводов. Найден 28.08.2026 уже
 * ПОСЛЕ первой версии сторожа: он читал только страницу глоссария и пропускал
 * `"pricing.security.cert.soc2.status": "Certified"` — подпись-значок на
 * странице безопасности, то есть форму более заметную, чем определение в
 * словаре. Сторож, знающий один источник из двух, занижает не риск, а свой
 * собственный охват.
 */
// РАЗДЕЛЁННЫЕ СЛОВАРИ. До 10.08.2026 все одиннадцать языков лежали в
// i18n-data.ts одним объектом, и сторож читал этот файл. Их разнесли по
// i18n-lang/<язык>.ts ради веса страницы (1.3 МБ из 2.5 грузились на каждой),
// и в i18n-data.ts переводов больше НЕТ — там осталось 2.8 КБ служебного кода.
//
// Сторож этого не знал и читал пустое: его собственная проверка «разбор
// работает» краснела, что и спасло — иначе он молча считал бы, что расхождений
// нет, при нуле разобранных строк.
//
// Ни одна сторона не была неправа: перенос верен, сторож верен, сломалось
// СОЧЕТАНИЕ. Поймано при сведении веток 28.08.2026.
const i18nDir = join(here, "..", "..", "lib", "i18n-lang");

/** id -> status из TRUST_BADGES. Разбор строковый: файл — данные, не код. */
function readTrustStatuses(src: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of src.split("\n")) {
    if (!line.includes("id:") || !line.includes("status:")) continue;
    const id = between(line, 'id: "', '"');
    const status = between(line, 'status: "', '"');
    if (id && status) out.set(id, status);
  }
  return out;
}

function between(s: string, a: string, b: string): string | null {
  const i = s.indexOf(a);
  if (i < 0) return null;
  const j = s.indexOf(b, i + a.length);
  return j < 0 ? null : s.slice(i + a.length, j);
}

/** Строки глоссария с их id — по одной на запись. */
function readGlossaryEntries(src: string): Array<{ id: string; text: string }> {
  const out: Array<{ id: string; text: string }> = [];
  for (const line of src.split("\n")) {
    const id = between(line, '{ id: "', '"');
    if (id) out.push({ id, text: line });
  }
  return out;
}

const CLAIMS_CERTIFIED = ["certified", "сертифицирован"];

/**
 * Известные расхождения на 28.08.2026 — ЖДУТ РЕШЕНИЯ ОСНОВАТЕЛЯ, а не забыты.
 *
 * Оба живут на проде прямо сейчас и записаны основателю красным пунктом:
 * какая из двух версий правда, знает только он. Если сертификатов нет —
 * правится текст глоссария; если получены, а `trust.ts` устарел — правится
 * `trust.ts`, иначе следующая правка вернёт страницу обратно.
 *
 * Держим их здесь, а не оставляем сторожа красным: постоянно красную проверку
 * перестают читать и отключают, и тогда НОВОЕ расхождение пройдёт незамеченным.
 * Убрать строку отсюда — часть починки, а не отдельная задача.
 */
// ⚠️ СЕГОДНЯ ЭТА ПРОВЕРКА НЕ ПРОВЕРЯЕТ НИЧЕГО, и это надо знать.
// Не-live статусов в trust.ts ровно два — soc2 и iso27001, — и оба здесь.
// То есть весь её предмет внутри исключения, и зелёный цвет означает
// «сравнивать пока не с чем», а не «расхождений нет».
//
// Логика при этом ЖИВАЯ, проверено мутацией 29.08.2026: убери отсюда
// "soc2" — и проверка немедленно называет строку i18n-data.ts:7311.
// Когда основатель решит судьбу этих двух заявлений, список опустеет и
// сторож снова начнёт работать сам.
const KNOWN_PENDING_DECISION = new Set(["soc2", "iso27001"]);

/**
 * Значки со страницы безопасности, у которых В РЕЕСТРЕ ДОВЕРИЯ нет записи —
 * ни в каком статусе. Найдено 28.08.2026, тоже ждёт решения основателя.
 *
 * Это отдельный и более тихий случай, чем расхождение статусов: там два
 * источника спорят, и спор заметен. Здесь второго источника НЕТ вовсе, то есть
 * заявление не подкреплено ничем и никем не отслеживается.
 *
 *   "pricing.security.cert.pcidss.status": "Level 1"      trust.ts: записи нет
 *   "pricing.security.cert.fz152.status":  "Compliant"    trust.ts: записи нет
 *
 * PCI DSS Level 1 — формальный уровень, подтверждаемый ежегодным аудитом QSA.
 * `fz152` — российский 152-ФЗ; в реестре есть `kz-152` (локализация в
 * Казахстане), это ДРУГАЯ юрисдикция, а не она же под другим именем.
 */
const KNOWN_UNTRACKED_BADGES = new Set(["pcidss", "fz152"]);

describe("витрина не называет нас сертифицированными раньше времени", () => {
  const trust = readTrustStatuses(readFileSync(trustPath, "utf8"));
  const glossary = readGlossaryEntries(readFileSync(glossaryPath, "utf8"));
  // Строки переводов: ключ несёт идентификатор, значение — видимый текст.
  const i18n = readdirSync(i18nDir)
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) =>
      readFileSync(join(i18nDir, f), "utf8")
        .split(String.fromCharCode(10))
        .map((text, i) => ({ text, line: i + 1, file: f })),
    )
    .filter((r) => r.text.includes('"pricing.'));

  it("сам разбор работает — иначе проверка была бы пустой", () => {
    // Без этого утверждения пустая карта дала бы зелёный прогон при любом тексте.
    expect(trust.size, "не разобрал ни одного статуса из trust.ts").toBeGreaterThan(3);
    expect(glossary.length, "не разобрал ни одной записи глоссария").toBeGreaterThan(3);
    expect(trust.has("iso27001"), "нет опорного идентификатора iso27001").toBe(true);
    expect(i18n.length, "не разобрал ни одной строки переводов").toBeGreaterThan(10);
  });

  it("известные расхождения не исчезли из виду", () => {
    // Если строку убрали из базовой линии, а расхождение осталось — проверка
    // выше промолчит. Поэтому список известных сверяется с данными отдельно.
    for (const id of KNOWN_PENDING_DECISION) {
      expect(trust.has(id), `известное расхождение ${id} исчезло из trust.ts — проверить, не переименовали ли`).toBe(true);
    }
  });

  it("ни одна незавершённая сертификация не объявлена полученной", () => {
    const bad: string[] = [];
    for (const { id, text } of glossary) {
      const status = trust.get(id);
      if (!status || status === "live") continue;
      if (KNOWN_PENDING_DECISION.has(id)) continue;
      const lower = text.toLowerCase();
      if (CLAIMS_CERTIFIED.some((w) => lower.includes(w))) {
        bad.push(`${id}: trust.ts говорит "${status}", а глоссарий пишет «сертифицирован»`);
      }
    }
    expect(bad, bad.join("; ")).toEqual([]);
  });

  it("у каждого значка безопасности есть запись в реестре доверия", () => {
    // Пропуск `if (!status) continue` в проверке выше делает такие заявления
    // невидимыми: спорить не с чем, потому что второго мнения нет.
    const badges = new Set<string>();
    for (const { text } of i18n) {
      const id = between(text, '"pricing.security.cert.', ".status");
      if (id) badges.add(id);
    }
    expect(badges.size, "не нашёл ни одного значка — разбор ключей сломан").toBeGreaterThan(2);
    const untracked = [...badges]
      .filter((id) => !trust.has(id) && !KNOWN_UNTRACKED_BADGES.has(id))
      .map((id) => `значок ${id} обещан на странице безопасности, а в trust.ts записи нет`);
    expect(untracked, untracked.join("; ")).toEqual([]);
  });

  it("известные неотслеживаемые значки не исчезли из виду", () => {
    const badges = new Set<string>();
    for (const { text } of i18n) {
      const id = between(text, '"pricing.security.cert.', ".status");
      if (id) badges.add(id);
    }
    for (const id of KNOWN_UNTRACKED_BADGES) {
      // Убрали значок со страницы или завели ему запись — строку отсюда надо
      // убрать, иначе базовая линия начнёт прятать уже несуществующее.
      const stillOpen = badges.has(id) && !trust.has(id);
      expect(stillOpen, `значок ${id} больше не в этом состоянии — убрать из KNOWN_UNTRACKED_BADGES`).toBe(true);
    }
  });

  it("в переводах тоже не объявлено полученным то, что в процессе", () => {
    const bad: string[] = [];
    for (const { text, line } of i18n) {
      for (const [id, status] of trust) {
        if (status === "live" || KNOWN_PENDING_DECISION.has(id)) continue;
        // Идентификатор должен стоять в КЛЮЧЕ, а не где-нибудь в тексте:
        // иначе поймаем упоминание стандарта в честном описании.
        if (!text.includes(`.${id}.`) && !text.includes(`.${id}"`)) continue;
        const lower = text.toLowerCase();
        if (CLAIMS_CERTIFIED.some((w) => lower.includes(w))) {
          bad.push(`i18n-data.ts:${line} — ${id} в статусе "${status}", а текст говорит «сертифицирован»`);
        }
      }
    }
    expect(bad, bad.join("; ")).toEqual([]);
  });
});
