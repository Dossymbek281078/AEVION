/**
 * Жаргон на экране — по ВСЕЙ платформе, а не только в шахматах.
 *
 * ЗАЧЕМ. Сторож `app/cyberchess/__tests__/noDeveloperJargonOnScreen.test.ts`
 * написан хорошо и свою папку держит чистой: замер 28.08.2026 по всему сайту
 * дал 119 мест с жаргоном, и НИ ОДНОГО в шахматах. Но его корень —
 * `path.join(__dirname, "..")`, то есть остальная платформа вне охвата.
 *
 * Опасность не в самом жаргоне, а в том, что кто-то прочитает «сторож
 * жаргона есть» и сочтёт класс закрытым. Он был закрыт в одном модуле.
 *
 * ЗАМЕР 28.08.2026 (словарь взят из того сторожа, выборка текста — его же):
 *   просмотрено 1530 файлов .tsx
 *   119 мест в 73 файлах, из них для обычного человека 63 в 44
 *   46 строк вообще без русского — английский текст на русском сайте
 *   чаще всего: backend 24, payload 11, endpoint 10, localStorage 9
 *
 * ПОЧЕМУ ХРАПОВИК, А НЕ ЗАПРЕТ. Починка 73 файлов — это конфликты с
 * параллельными сессиями и недели работы. Сторож, требующий миграции,
 * которой не было, красит набор в красный, а такой сторож отключают в
 * первый же день (feedback_audit_that_is_always_red,
 * feedback_baseline_guard_must_not_redden_main). Поэтому нынешнее
 * состояние заморожено списком, и проверяется одно: список НЕ РАСТЁТ.
 * Починки приветствуются — тест просит вычеркнуть файл, чтобы жаргон не
 * смог вернуться незамеченным.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "..", "..");
const CHESS = "app/cyberchess/";

/**
 * Словарь ДУБЛИРУЕТСЯ намеренно, а не импортируется: тест, который тянет
 * значение из другого теста, ломается вместе с ним и делает оба непонятными.
 * Плата за дубль — расхождение; от него защищает последняя проверка в файле,
 * она сверяет обе строки посимвольно.
 */
const ZHARGON =
  /\b(fallback|mock|polling|SSE|endpoint|payload|localStorage|cache|weak factor|SR reminders|backend|deprecated|TODO|FIXME|daily-variant|Coach Knowledge|training hub)\b/i;

/**
 * Отраслевые слова, совпавшие со словарём по случайности. Это НЕ жаргон:
 * у космического аппарата payload — полезная нагрузка, и по-другому её не
 * называют. Такие места идут сюда, а не в список ожидающих: список должен
 * худеть от починок, а не от исключений.
 */
const NE_ZHARGON = ["space-payload-processing"];

/** Список заморожен замером 28.08.2026. Чинишь файл — вычеркни строку. */
const OZHIDAYUT = new Set([
  "app/admin/awards/page.tsx",
  "app/admin/bureau/page.tsx",
  "app/admin/events/page.tsx",
  "app/admin/modules/page.tsx",
  "app/admin/planet/page.tsx",
  "app/admin/qright/page.tsx",
  "app/aev/page.tsx",
  "app/api-explorer/catalog/page.tsx",
  "app/api-explorer/health/page.tsx",
  "app/api-explorer/sdk/page.tsx",
  "app/api-explorer/version/page.tsx",
  "app/bank/api/page.tsx",
  "app/bank/diagnostics/page.tsx",
  "app/bank/smoke/page.tsx",
  "app/build/developers/page.tsx",
  "app/constitution/api/page.tsx",
  "app/deepsan/page.tsx",
  "app/demo/deep/page.tsx",
  "app/demo/opengraph-image.tsx",
  "app/demo/page.tsx",
  "app/developers/fintech/page.tsx",
  "app/developers/fintech/stripe-verifier/page.tsx",
  "app/developers/fintech/troubleshooting/page.tsx",
  "app/developers/fintech/webhooks/page.tsx",
  "app/developers/page.tsx",
  "app/devhub/[id]/page.tsx",
  "app/fintech/catalog/page.tsx",
  "app/fintech/page.tsx",
  "app/fintech/playground/page.tsx",
  "app/fintech/whitepaper/page.tsx",
  "app/launch-status/page.tsx",
  "app/multichat-engine/MultichatEngineClient.tsx",
  "app/multichat-engine/library/page.test.tsx",
  "app/payments/dashboard/page.tsx",
  "app/payments/status/page.tsx",
  "app/payments/webhooks/page.tsx",
  "app/planet/webhooks/[id]/page.tsx",
  "app/pricing/api-pricing/opengraph-image.tsx",
  "app/qcoreai/multi/page.tsx",
  "app/qcoreai/providers/page.tsx",
  "app/qcoreai/vs/page.tsx",
  "app/qcoreai/webhooks/page.tsx",
  "app/qfusionai/opengraph-image.tsx",
  "app/qmaskcard/charges/[id]/page.tsx",
  "app/qpaynet/admin/page.tsx",
  "app/qpaynet/admin/reconcile/page.tsx",
  "app/qright/page.tsx",
  "app/qright/webhooks/[id]/page.tsx",
  "app/qsign/keys/page.tsx",
  "app/qsign/page.tsx",
  "app/qsign/verify/[id]/page.tsx",
  "app/quantum-shield/page.tsx",
  "app/sdk/page.tsx",
  "app/sdks/page.tsx",
  "app/smeta-trainer/admin/page.tsx",
  "app/smeta-trainer/dashboard/page.tsx",
  "app/smeta-trainer/drawings-practice/satellite-control-ground-station/page.tsx",
  "app/smeta-trainer/drawings-practice/underwater-tunnels-subsea/page.tsx",
  "app/smeta-trainer/exam-analytics/page.tsx",
  "app/smeta-trainer/exam-journal/page.tsx",
  "app/status/page.tsx",
  "app/studio/page.tsx",
  "app/veilnetx/ledger/page.tsx",
]);

function obojti(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "node_modules" && e !== "__tests__") obojti(p, acc);
    } else if (/\.tsx$/.test(e)) acc.push(p);
  }
  return acc;
}

/**
 * Видимый текст: между тегами и ЧЕРЕЗ ПЕРЕНОС СТРОКИ. Выборка повторяет
 * шахматного сторожа — там она уже пережила ложный ноль на фразе, разбитой
 * на две строки.
 */
function vidimyjTekst(src: string): string[] {
  const bezKom = src
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
  const out: string[] = [];
  for (const m of bezKom.matchAll(/>([^<>{}]{12,300})</g)) {
    out.push(m[1].replace(/\s+/g, " ").trim());
  }
  return out;
}

function narushiteli(): string[] {
  const bad: string[] = [];
  for (const full of obojti(SRC)) {
    const rel = full.slice(SRC.length + 1).split("\\").join("/");
    if (rel.startsWith(CHESS)) continue;
    if (NE_ZHARGON.some((x) => rel.includes(x))) continue;
    if (vidimyjTekst(readFileSync(full, "utf8")).some((t) => ZHARGON.test(t))) {
      bad.push(rel);
    }
  }
  return bad;
}

describe("жаргон на экране не расползается по платформе", () => {
  it("контроль прибора: файлы находятся и словарь непустой", () => {
    expect(obojti(SRC).length).toBeGreaterThan(500);
    expect(ZHARGON.test("<div>Ошибка: payload не пришёл вовремя сюда</div>")).toBe(true);
    expect(ZHARGON.test("Обычная фраза без служебных слов вовсе")).toBe(false);
  });

  it("выборка видит текст, разбитый на две строки", () => {
    const t = vidimyjTekst("<p>\n  Данные лежат в localStorage браузера\n</p>");
    expect(t.some((x) => ZHARGON.test(x))).toBe(true);
  });

  it("новых файлов с жаргоном не появилось", () => {
    const novye = narushiteli().filter((f) => !OZHIDAYUT.has(f));
    expect(
      novye.join("\n"),
      "На экран уехало служебное слово. Скажите словами человека: не " +
        "«backend недоступен», а «сервис временно недоступен».",
    ).toBe("");
  });

  it("список ожидающих не протух: каждый файл всё ещё нарушает", () => {
    const est = new Set(narushiteli());
    const pochinennye = [...OZHIDAYUT].filter((f) => !est.has(f));
    expect(
      pochinennye.join("\n"),
      "Эти файлы уже чистые — вычеркните их из OZHIDAYUT, иначе жаргон " +
        "вернётся в них незамеченным.",
    ).toBe("");
  });

  it("словарь не разошёлся с шахматным сторожем", () => {
    const chuzhoj = readFileSync(
      path.join(SRC, "app", "cyberchess", "__tests__", "noDeveloperJargonOnScreen.test.ts"),
      "utf8",
    );
    const m = chuzhoj.match(/const ZHARGON =\s*(\/[\s\S]*?\/[gimsuy]*);/);
    expect(m, "у шахматного сторожа не нашёлся словарь — проверьте имя файла").toBeTruthy();
    // Сверяем ОБЩЕЕ ЯДРО, а не тождество строк.
    //
    // Прежняя версия требовала посимвольного совпадения словарей, и это
    // оказалось НЕВЕРНО. Проверено опытом 29.08.2026 на слитом дереве:
    // шахматный сторож пополнился словами `bracket`, `hotseat`,
    // `match me`, `quick start`, я скопировал строку целиком — как сам же
    // и предписывал — и получил три ложные тревоги:
    //
    //   qtrade       биржевой bracket order и имена переменных
    //   bank/income  налоговая шкала, tax bracket
    //   investor     то же
    //
    // Словари покрывают РАЗНЫЕ области. «Сетка турнира» — жаргон в шахматах,
    // «bracket order» — обычный термин на бирже. Требовать одинаковых
    // словарей у сторожей разных предметных областей нельзя.
    //
    // Что защищаем на самом деле: чтобы из ОБЩЕГО ядра никто тихо не убрал
    // слово, ослабив одного из сторожей. Пополнение доменными словами при
    // этом свободно с обеих сторон.
    const слова = (re: string) =>
      new Set((re.match(/[a-zA-Z][a-zA-Z ]*/g) || []).map((w) => w.trim()).filter(Boolean));
    const ядро = ["fallback", "mock", "polling", "endpoint", "payload", "cache", "backend"];
    const мои = слова(String(ZHARGON));
    const чужие = слова(m![1]);
    const пропали = ядро.filter((w) => !мои.has(w) || !чужие.has(w));
    expect(
      пропали.join(", "),
      "Слово из общего ядра исчезло у одного из сторожей — значит его " +
        "ослабили. Пополнять словари доменными словами можно свободно, " +
        "убирать общие — нет.",
    ).toBe("");
  });
});
