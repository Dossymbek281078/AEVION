import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Regression guard for retired pitch numbers.
 *
 * Why this exists: the same headline figure ($2B+ ARR, the "Seed $5M" ask, …)
 * used to live as a hardcoded string in ~10 different files with slightly
 * different wording. A cleanup in one window only ever caught the variants
 * someone grepped for, so a stale copy always resurfaced in another surface
 * (SEO meta, OG images, print pages). This test fails the build the moment a
 * retired figure reappears on any pitch surface — so drift is caught in CI,
 * not by a human reading the page months later.
 *
 * Scope is deliberately narrow: only investor-facing pitch surfaces, and only
 * figures that were explicitly retired. Legitimate numbers the founder keeps
 * (valuation ranges like "$1.0-1.6B", the "$10M returnable advance", real
 * plant-cost answers in the smeta trainer) are intentionally NOT matched.
 */

const FRONTEND_ROOT = path.resolve(__dirname, "../../..");

// Pitch surfaces that must stay consistent with the single revenue model.
const SURFACES = [
  "src/app/page.tsx",
  "src/app/pitch/page.tsx",
  "src/app/pitch/print/page.tsx",
  "src/app/pitch/opengraph-image.tsx",
  "src/app/partner/page.tsx",
  "src/app/partner/print/page.tsx",
  "src/app/investor/layout.tsx",
  "src/app/investor/page.tsx",
  "src/components/AutoTranslate.tsx",
  "src/data/pitchModel.ts",
];

// Retired figures. Each must not appear on any surface above.
const RETIRED: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /\$2\.?0?\s*B\+/i,
    reason: '"$2B+" / "$2.0B+" — retired top-down ARR headline (replaced by the bottom-up model)',
  },
  {
    pattern: /modelled at \$2/i,
    reason: '"modelled at $2B" — retired top-down trajectory headline',
  },
  {
    pattern: /Seed \$5M/i,
    reason: '"Seed $5M" — retired ask (canonical offer is a $10M returnable advance, not an equity seed)',
  },
  {
    pattern: /\b29\b[^\n]{0,20}(product nodes|modules? live|nodes)/i,
    reason: '"29 … nodes" — stale module count (canonical public count is 37 nodes; import MODULE_NODES from pitchFacts)',
  },
];

describe("pitch numbers — retired figures must not resurface", () => {
  for (const rel of SURFACES) {
    it(`${rel} carries no retired figures`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      for (const { pattern, reason } of RETIRED) {
        const hit = src.match(pattern);
        expect(
          hit,
          `${rel} still contains ${reason}. Found: ${hit ? hit[0] : ""}. ` +
            `Align it with the single bottom-up revenue model (see unitEconomics in src/data/pitchModel.ts).`,
        ).toBeNull();
      }
    });
  }
});

/**
 * Числа витрины должны совпадать с РЕЕСТРОМ, а не с самими собой.
 *
 * Заголовок «stay in sync with the registry» тут стоял и раньше, но проверка
 * реестр не открывала: она сравнивала MODULE_NODES с литералом 37, а
 * LIVE_MODULES с литералом 35. Такой тест краснеет, только если кто-то трогает
 * pitchFacts, и молчит ровно в том случае, ради которого писался — когда
 * растёт реестр.
 *
 * Замерено 10.08.2026: в projects.ts уже 41 запись и 36 живых, а pitchFacts
 * говорил 37 и 35. То есть продающие страницы занижали платформу на четыре
 * узла, боевой API отдавал 36 живых, а сторож был зелёный и мешал исправить.
 *
 * Теперь счёт берётся из самого реестра, и добавление модуля роняет тест до
 * обновления pitchFacts — как и было обещано в исходном комментарии.
 */
describe("pitchFacts — числа берутся из реестра, а не из самих себя", () => {
  const REGISTRY = path.resolve(
    FRONTEND_ROOT,
    "../aevion-globus-backend/src/data/projects.ts",
  );

  const registryCounts = () => {
    const src = readFileSync(REGISTRY, "utf8");
    const statuses = src.match(/status:\s*"([a-z_]+)"/g) || [];
    const live = statuses.filter((s) => s.includes('"live"')).length;
    // Каждая запись реестра имеет ровно один id — считаем по ним, а не по
    // фигурным скобкам: вложенные объекты внутри записи сбили бы счёт.
    const entries = (src.match(/^\s{4}id:\s*"/gm) || []).length;
    return { entries, live };
  };

  it("реестр вообще прочитан — иначе ноль совпадений выглядел бы как успех", () => {
    const { entries, live } = registryCounts();
    expect(entries).toBeGreaterThan(20);
    expect(live).toBeGreaterThan(10);
  });

  it("MODULE_NODES = записи реестра минус оболочка карты globus", async () => {
    const { MODULE_NODES } = await import("@/data/pitchFacts");
    const { entries } = registryCounts();
    expect(
      MODULE_NODES,
      `в реестре ${entries} записей, значит узлов ${entries - 1} ` +
        `(globus — это карта, а не продукт). Обнови MODULE_NODES в pitchFacts.`,
    ).toBe(entries - 1);
  });

  it("LIVE_MODULES = число записей со статусом live", async () => {
    const { LIVE_MODULES } = await import("@/data/pitchFacts");
    const { live } = registryCounts();
    expect(
      LIVE_MODULES,
      `в реестре ${live} живых модулей. Обнови LIVE_MODULES в pitchFacts — ` +
        `иначе витрина занижает платформу.`,
    ).toBe(live);
  });
});

/**
 * Guard: a number on a public page never wears a "live" label unless it came
 * from a live call.
 *
 * Why this exists. On 2026-08-09 /demo and /pitch both showed a green "LIVE"
 * badge whenever ANY ONE of four endpoints answered. One of them —
 * /api/qtrade/summary — sits behind requireAuth, so for a signed-out visitor it
 * can never answer: its number always came from the hardcoded DEMO_METRICS
 * (1450) and was presented as live. Measured against production the same day,
 * the four working sources returned 25 / 25 / 20 / 50 — so a fabricated
 * four-digit figure stood next to real two-digit ones under one green dot.
 *
 * The structural invariant that prevents the whole class: every metric pill
 * must be told whether ITS OWN source answered. A pill rendered without the
 * `live` prop is a number with no way to mark itself, which is exactly how the
 * old bug looked in the diff — nothing about it read as wrong.
 */
describe("live metrics — every pill declares its own liveness", () => {
  const PILL_SURFACES = ["src/app/demo/page.tsx", "src/app/pitch/page.tsx"];

  for (const rel of PILL_SURFACES) {
    it(`${rel} renders no LivePill without a live= prop`, () => {
      const src = readFileSync(path.join(FRONTEND_ROOT, rel), "utf8");
      // Each usage is a single JSX element; match up to the self-closing slash
      // so a multi-prop pill on one line is captured whole.
      const usages = src.match(/<LivePill\b[^>]*\/>/g) || [];
      expect(
        usages.length,
        `${rel} no longer renders any LivePill — if the block was removed, drop it from PILL_SURFACES; ` +
          `if it was renamed, point this guard at the new component.`,
      ).toBeGreaterThan(0);

      const unmarked = usages.filter((u) => !/\blive=/.test(u));
      expect(
        unmarked,
        `${rel} renders ${unmarked.length} metric pill(s) with no live= prop. ` +
          `A pill that cannot know whether its source answered will show the DEMO_METRICS ` +
          `fallback as if it were a live number.`,
      ).toEqual([]);
    });
  }
});

/**
 * Guard: preview-режим ML-DSA не смеет публиковать `valid: true`.
 *
 * Проверено на проде 11.08.2026: activeKeys = { hmac, ed25519 }, ключа ML-DSA
 * нет — значит боевой стенд работает именно в preview-режиме. В нём ответ
 * содержит digest = SHA-512(canonical||kid) и собственную оговорку «NOT a
 * cryptographic signature», но `valid` возвращался true. Автоматический
 * потребитель, который смотрит только на valid, получал подтверждение того,
 * чего не было: приватного ключа в этой ветке нет вовсе, такой digest
 * вычислит любой.
 *
 * null здесь предусмотрен изначально: тип DilithiumBlock допускает
 * `boolean | null`, фронтенд (app/qsign/page.tsx) проверяет `valid === null`
 * первым делом, PDF печатает «—». Режим «нечего подтверждать» существовал,
 * просто не выставлялся.
 *
 * Сторож структурный, потому что помощники маршрута не экспортируются, а
 * поднимать базу ради проверки одного поля дороже, чем прочитать исходник.
 * Прецедент — проверка реестра выше: она тоже читает файл бэкенда.
 */
describe("qsign v2 — preview-подпись не выдаёт себя за проверенную", () => {
  const ROUTE = path.resolve(
    FRONTEND_ROOT,
    "../aevion-globus-backend/src/routes/qsignV2.ts",
  );

  it("исходник прочитан — иначе ноль совпадений выглядел бы как успех", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src.length).toBeGreaterThan(10000);
    expect(src).toContain("DILITHIUM_PREVIEW_NOTE");
  });

  it("previewValid объявлен и равен null", () => {
    const src = readFileSync(ROUTE, "utf8");
    expect(src).toMatch(/const\s+previewValid\s*=\s*null\s*;/);
  });

  it("каждый preview-блок публикует valid: previewValid", () => {
    const src = readFileSync(ROUTE, "utf8").split(/\r?\n/);
    // Точная привязка вместо разбивки по пустым строкам: у каждого preview-блока
    // последняя строка — `note: DILITHIUM_PREVIEW_NOTE`, а поле valid стоит
    // непосредственно над ней. Первая версия этой проверки резала файл по
    // абзацам, и в один кусок попадали preview-блок и `valid: true` соседнего
    // real-блока — сторож краснел на исправном коде. Инструмент, а не код.
    const marks: number[] = [];
    src.forEach((l, i) => {
      if (/^\s*note:\s*DILITHIUM_PREVIEW_NOTE,?\s*$/.test(l)) marks.push(i);
    });
    expect(marks.length, "не нашёл ни одного preview-блока в ответе").toBeGreaterThan(0);

    const bad: string[] = [];
    for (const i of marks) {
      // Ищем ближайшую строку valid выше метки, не дальше шести строк.
      let found: string | null = null;
      for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
        if (/^\s*valid:/.test(src[j])) { found = src[j].trim(); break; }
      }
      if (found === null) bad.push(`строка ${i + 1}: поля valid рядом нет`);
      else if (!/^valid:\s*previewValid,?$/.test(found)) bad.push(`строка ${i + 1}: ${found}`);
    }
    expect(
      bad,
      "preview-блок публикует valid как проверенный — вернуть previewValid",
    ).toEqual([]);
  });
});
