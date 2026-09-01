/**
 * Значок доступности тарифа и обещание под ним не должны спорить.
 *
 * 28.08.2026 страница /bureau сама себе противоречила, и обе половины видел
 * покупатель:
 *
 *   значок:   «▲ live»  (в браузере — «▲ в прямом эфире»)
 *   обещание: «Licensed notary co-signs the certificate ... apostille-ready
 *              document admissible in EAEU courts»
 *   а реестр: GET /api/bureau/notaries -> {"notaries":[]}
 *
 * Значок я в тот день поправил на «в плане», а обещание в СОСЕДНЕМ поле того
 * же объекта — нет. Именно поэтому сторож проверяет ПАРУ, а не значок: правку
 * одного поля легко счесть законченной работой, пока рядом стоит второе поле
 * про то же самое.
 *
 * Верить будут короткому и уверенному: «live» читается за долю секунды,
 * оговорка в третьей строке абзаца — нет.
 *
 * ГРАНИЦА, чтобы зелёный не читался шире, чем он есть. Сторож проверяет ДВЕ
 * вещи у тарифа без значка доступности: обещание называет недоступность И не
 * называет доставленный правовой результат. Он НЕ понимает смысла: новую
 * ложную формулировку, не попавшую в оба списка, он пропустит. Строить
 * детектор «обещание не соответствует действительности» вообще я не стал —
 * проверено сегодня отрицательным контролем на соседнем классе: такой
 * детектор даёт успокаивающий ноль, то есть хуже, чем его отсутствие.
 *
 * Он также НЕ спрашивает прод: реестр нотариусов может опустеть, а страница
 * останется зелёной. Это осознанно — сторож, ходящий в сеть, краснеет от
 * чужих сбоев, и его отключают. Живое состояние спрашивает смоук страниц.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = join(HERE, "..", "bureau", "page.tsx");

/** Значок утверждает, что тариф доступен ПРЯМО СЕЙЧАС. */
const AVAILABLE_BADGE = ["active", "available now", "live", "доступно сейчас"];

/**
 * Слова, которыми обещание честно называет свою недоступность.
 * Их наличие — единственное, что требуется от тарифа без значка доступности.
 */
const QUALIFIERS = [
  "still being assembled",
  "not yet",
  "planned",
  "check it for",
  "coming",
  "в плане",
  // Дополнено 31.08.2026 при сборке к 10.09. Два тарифа называли свою
  // недоступность честно и явно, а сторож их не признавал — его словарь
  // оговорок оказался уже, чем язык, которым люди пишут:
  //
  //   «Identity check is in demo mode right now… Ask us before buying this tier.»
  //   «Cryptographic co-signing is being finalised — ask us to confirm…»
  //
  // Это ровно тот класс, на котором мы сегодня обжигались весь день: ноль
  // делает СЛОВАРЬ ПРОВЕРЯЮЩЕГО, а не предмет. Здесь он давал ложную тревогу,
  // а ложная тревога на стороже дороже пропуска: к красному, которое «всегда
  // такое», привыкают за день и отключают.
  //
  // Формулировки взяты точные, а не широкие. «ask us» добавлено осознанно: оно
  // прямо отсылает покупателя спросить ДО покупки, то есть делает ту же
  // работу, что «в плане», только вежливее.
  "demo mode",
  "being finalised",
  "being finalized",
  "ask us",
];

/**
 * Слова, которыми обещание называет ДОСТАВЛЕННЫЙ правовой результат. У тарифа
 * без значка доступности их быть не может: результата ещё нет.
 *
 * Список узкий намеренно. Первая версия сторожа требовала только смягчитель —
 * и мутация её не поймала: «registry is operating across 130 countries — check
 * it for current availability» содержит смягчитель и всё равно лжёт. Одного
 * условия мало, нужны оба.
 */
const DELIVERED_OUTCOME = ["admissible", "apostille", "court-ready", "готовый к апостилю"];

type Tier = { name: string; blurb: string; badge: string };

/**
 * ВСЕ возможные строковые значения поля.
 *
 * ⚠️ Дописано 31.08.2026 при сборке к 10.09. Прежняя версия искала только
 * литерал `key: "..."` — и молча пропускала тариф, у которого значок стал
 * ВЫЧИСЛЯЕМЫМ:
 *
 *     badge:
 *       notaryCount && notaryCount > 0 && notarySig === "ed25519"
 *         ? "▲ live"
 *         : "▲ by request",
 *
 * Из трёх тарифов разбирался один, и сторож падал на своей же проверке
 * «разбор сломан» — она и спасла. Без неё он бы тихо проверял один тариф из
 * трёх и был зелёным.
 *
 * Проверять надо КАЖДЫЙ вариант, а не первый: если значок МОЖЕТ оказаться
 * «недоступно», обещание под ним обязано это называть — иначе в тот день,
 * когда условие свернётся в недоступность, страница начнёт обещать услугу,
 * которой нет.
 */
function fieldAll(block: string, key: string): string[] {
  const at = block.indexOf(key + ":");
  if (at === -1) return [];
  // Значение кончается на следующем поле того же объекта.
  const rest = block.slice(at + key.length + 1);
  // Значение кончается на следующем поле того же объекта. Ищем позиционно, без
  // регулярок: обратный слэш в этой среде теряется на границе вызова, и шаблон
  // молча перестаёт совпадать (первая версия этой правки именно так и легла —
  // молча перестаёт совпадать. Первая версия этой правки именно так и легла:
  // строки внутри неё превращались в настоящий перевод строки, файл переставал
  // сказал «no tests» — то есть ни зелёный, ни красный, а молчание).
  let stop = -1;
  // "badge:" обязательно в списке: без него разбор ОБЕЩАНИЯ перескакивал через
  // поле значка и захватывал его строки — «Notarized» получал обещание «▲ live».
  // "badgeColor:" отдельной строкой не мешает: indexOf ищет точное "badge:".
  for (const k of ["badge:", "badgeColor:", "cta:", "blurb:", "name:", "href:"]) {
    const at = rest.indexOf(k);
    if (at !== -1 && (stop === -1 || at < stop)) stop = at;
  }
  const value = stop === -1 ? rest : rest.slice(0, stop);
  const out: string[] = [];
  let i = value.indexOf('"');
  while (i !== -1) {
    const j = value.indexOf('"', i + 1);
    if (j === -1) break;
    const lit = value.slice(i + 1, j);
    // Строку, стоящую справа от сравнения, брать нельзя: это ОПЕРАНД условия
    // (kycMode === "stub"), а не возможное значение поля. Первая версия этой
    // правки их брала — и сторож объявил значками «stub» и «ed25519».
    const before = value.slice(Math.max(0, i - 5), i);
    const isOperand = before.includes("==") || before.includes("!=");
    if (lit.trim() && !isOperand) out.push(lit);
    i = value.indexOf('"', j + 1);
  }
  return out;
}

/** Значение строкового поля внутри одного блока тарифа. */
function field(block: string, key: string): string {
  const at = block.indexOf(key + ': "');
  if (at === -1) return "";
  const from = at + key.length + 3;
  const to = block.indexOf('"', from);
  return to === -1 ? "" : block.slice(from, to);
}

function tiers(): Tier[] {
  const raw = readFileSync(PAGE, "utf8");
  // Комментарии выбрасываем: в них законно цитируется прежний текст, и без
  // этого сторож краснел бы на собственном пояснении (эту ошибку я уже
  // допускал сегодня в соседнем стороже — см. stripComments там).
  const src = raw
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

  const end = src.indexOf("].map((tier)");
  if (end === -1) return [];
  const region = src.slice(0, end);

  const out: Tier[] = [];
  const parts = region.split('name: "');
  for (let i = 1; i < parts.length; i++) {
    const block = 'name: "' + parts[i];
    const badges = fieldAll(block, "badge");
    if (!badges.length) continue; // не тариф, а другой объект с полем name
    // badge — САМЫЙ СЛАБЫЙ из возможных: если хоть один вариант не обещает
    // доступности, обещание под значком обязано называть недоступность.
    // ⚠️ Значок и обещание у этих тарифов вычисляются ОДНИМ условием:
    //
    //     badge:  kycMode === "stub" ? "demo mode" : "available now"
    //     blurb:  kycMode === "stub" ? "...в демо-режиме..." : "...проверено..."
    //
    // Значит вариант i значка идёт в паре ровно с вариантом i обещания.
    // Сравнивать их независимо — выдумывать пару, которой не бывает: «значок
    // недоступен» + «обещание работы» получилось бы из РАЗНЫХ веток условия.
    // Первая версия этой правки так и делала и дала две ложные находки.
    //
    // Когда вариантов поровну — сверяем по позиции. Когда нет (один литерал
    // против ternary) — берём самую слабую пару: это осознанный запас в
    // сторону строгости, лишний раз покраснеть здесь дешевле, чем пропустить.
    const blurbs = fieldAll(block, "blurb");
    const name = field(block, "name");
    if (badges.length === blurbs.length && badges.length > 1) {
      for (let k = 0; k < badges.length; k++) {
        out.push({ name, blurb: blurbs[k], badge: badges[k] });
      }
      continue;
    }
    const weakestBadge = badges.find((b) => !claimsAvailable(b)) ?? badges[0];
    const weakestBlurb = blurbs.find((b) => !isQualified(b)) ?? blurbs[0] ?? "";
    out.push({ name, blurb: weakestBlurb, badge: weakestBadge });
  }
  return out;
}

function claimsAvailable(badge: string): boolean {
  const b = badge.toLowerCase();
  return AVAILABLE_BADGE.some((w) => b.includes(w));
}

function claimsOutcome(blurb: string): boolean {
  const t = blurb.toLowerCase();
  return DELIVERED_OUTCOME.some((w) => t.includes(w));
}

function isQualified(blurb: string): boolean {
  const t = blurb.toLowerCase();
  return QUALIFIERS.some((w) => t.includes(w));
}

describe("значок тарифа и обещание под ним не спорят", () => {
  it("контроль прибора: тарифы вообще разбираются", () => {
    // Проверяем РАЗБОР, а не конкретное состояние конкретного тарифа: сторож,
    // краснеющий в день, когда нотариус наконец появится, отключат сразу.
    const t = tiers();
    expect(t.length, "не разобрано ни одного тарифа — разбор сломан").toBeGreaterThanOrEqual(3);
    expect(t.every((x) => x.name && x.badge), "у тарифа пустое имя или значок").toBe(true);
    expect(t.some((x) => x.blurb.length > 20), "ни у одного тарифа нет обещания").toBe(true);
  });

  it("тариф без значка доступности честно называет это в обещании", () => {
    const bad = tiers()
      .filter((t) => !claimsAvailable(t.badge))
      .filter((t) => !isQualified(t.blurb) || claimsOutcome(t.blurb))
      .map((t) => `«${t.name}» (значок «${t.badge}») обещает: «${t.blurb}»`);

    expect(
      bad,
      "значок говорит, что тарифа ещё нет, а обещание под ним утверждает работу:\n  " +
        bad.join("\n  ") +
        "\nЛибо верните значок доступности (услуга работает), либо назовите " +
        "недоступность в самом обещании.",
    ).toEqual([]);
  });

  it("контроль: прежняя пара значок+обещание была бы поймана", () => {
    // Мутация внутри теста: ровно та пара, что стояла на проде до 28.08.
    const oldBlurb =
      "Licensed notary co-signs the certificate with Ed25519, producing an " +
      "apostille-ready document admissible in EAEU courts.";
    expect(claimsAvailable("▲ в плане")).toBe(false);
    expect(isQualified(oldBlurb), "прежнее обещание не называло недоступность").toBe(false);
    expect(claimsOutcome(oldBlurb), "прежнее обещание называло результат в суде").toBe(true);
    // И случай, на котором первая версия сторожа провалилась: смягчитель есть,
    // а обещание всё равно лжёт про доставленный результат.
    expect(
      claimsOutcome("Produces an apostille-ready document — check it for current availability."),
    ).toBe(true);
    // а починенная пара — проходит
    expect(
      isQualified("A licensed notary co-signs the certificate with Ed25519. The notary registry is still being assembled — check it for current availability."),
    ).toBe(true);
  });
});
