import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Сторож витрины DevHub — ЗАЩЁЛКА, а не чёрный список.
//
// Соседний catalogClaims.guard проверяет ОТСУТСТВИЕ известных ложных фраз.
// Он защищает от возврата старой лжи и по устройству не может поймать новую:
// добавь седьмое обещание — он промолчит. А класс у нас дорогой: витрина уже
// обещала пять несуществующих вещей из тридцати девяти.
//
// Здесь список заморожен. Каждое обещание проверено по коду 31.08.2026:
//
//   Monaco IDE (VS Code engine)   monaco-editor в зависимостях фронта
//   AI code generation            4 вызова smartComplete в routes/devhub.ts
//   Deploy to Cloudflare Pages    108 упоминаний cloudflare; проверка живости
//                                 перед словом live — routes/devhub.ts:2622
//   Free *.pages.dev address      3 упоминания pages.dev
//   50 AI videos / 200 images     TIER_LIMITS.pro = { video: 50, image: 200 }
//   Team collaborators            26 упоминаний collaborator
//
// Меняете список — перепроверьте НОВОЕ обещание по коду и обновите разбор
// выше. Сторож не запрещает менять витрину, он запрещает менять её МОЛЧА.

const APPS = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "page.tsx");

// 🔴 ЕСЛИ ЭТОТ СТОРОЖ ПОКРАСНЕЛ ПОСЛЕ МЕРЖА — НЕ ПРАВЬТЕ СПИСОК.
//
// Замер 31.08.2026: две выкаточные ветки несут СТАРЫЕ обещания карточки —
// «Deploy: Railway · Vercel · Cloudflare Pages» и обещание домена
// *.aevion.build:
//
//   deploy/launch-2026-08-30-chess       4 расхождения с этим списком
//   deliver/silent-failures-2026-08-28   4 расхождения
//   merge/devhub-backlog-2026-08-27      0 — там уже починено
//
// Оба старых обещания ЛОЖНЫ, и это измерено на проде:
// GET /api/devhub/studio/capabilities → railway not_available, vercel
// needs_token, работает одна цель из трёх (pages). Зона aevion.build не
// делегирована.
//
// Значит красный после мержа означает ровно одно: ложное обещание вернулось
// вместе с чужой стороной файла. Правильная починка — взять НАШУ сторону
// apps/page.tsx, а не подогнать список под то, что приехало. Подгонка под
// срок тихо вернёт на карточку за $149/мес обещание, которого мы не
// выполняем.
const ПРОВЕРЕНО = [
  "Monaco IDE (VS Code engine)",
  "AI code generation",
  "Deploy to Cloudflare Pages, verified live before it says live",
  "Free *.pages.dev address",
  "50 AI videos · 200 images/mo",
  "Team collaborators",
];

function highlightsOf(src: string, id: string): string[] {
  const at = src.indexOf(`id: "${id}"`);
  if (at < 0) return [];
  const hAt = src.indexOf("highlights:", at);
  if (hAt < 0) return [];
  const open = src.indexOf("[", hAt);
  const close = src.indexOf("]", open);
  if (open < 0 || close < 0) return [];
  return src
    .slice(open + 1, close)
    .split(String.fromCharCode(10))   // не литерал с обратным слэшем: он теряется на границе вызова
    .map((l) => l.trim())
    .filter((l) => l.startsWith('"'))
    .map((l) => l.replace(/^"/, "").replace(/",?$/, ""));
}

// Заморозка ловит ИЗМЕНЕНИЕ обещания, но не его ЛОЖНОСТЬ: если кто-то поправит
// и список, и разбор в шапке, сторож промолчит. Одно из шести обещаний
// проверяемо машинно — числа лимитов, и они живут в бэкенде. Сверяем.
const BACKEND = join(
  dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "..",
  "aevion-globus-backend", "src", "routes", "devhub.ts",
);

describe("числа витрины совпадают с таблицей тарифов", () => {
  const src = readFileSync(BACKEND, "utf8");

  it("прибор исправен: таблица тарифов найдена и разобрана", () => {
    // Контроль охвата. Без него пустой разбор дал бы «расхождений нет» —
    // самый частый вид ложного зелёного.
    const at = src.indexOf("const TIER_LIMITS");
    expect(at, "таблица тарифов не найдена — сторож смотрит не туда").toBeGreaterThan(0);
    expect(
      src.slice(at, at + 400),
      "таблица тарифов найдена, но платного тарифа в ней нет — числа сверять не с чем",
    ).toContain("pro:");
  });

  it("«50 AI videos · 200 images/mo» — это то, что даёт платный тариф", () => {
    const at = src.indexOf("const TIER_LIMITS");
    const pro = src.slice(src.indexOf("pro:", at), src.indexOf("enterprise:", at));
    const num = (key: string) => {
      const m = pro.indexOf(key + ":");
      expect(m, `в тарифе нет ключа ${key}`).toBeGreaterThan(-1);
      return parseInt(pro.slice(m + key.length + 1).trim(), 10);
    };
    const claim = ПРОВЕРЕНО.find((c) => c.includes("videos"));
    expect(claim, "обещание про числа исчезло из списка").toBeTruthy();
    const [видео, картинки] = (claim as string).match(/[0-9]+/g)!.map(Number);
    expect(видео, "витрина обещает не столько видео, сколько даёт тариф").toBe(num("video"));
    expect(картинки, "витрина обещает не столько картинок, сколько даёт тариф").toBe(num("image"));
  });
});

describe("витрина DevHub: обещания заморожены", () => {
  const src = readFileSync(APPS, "utf8");

  it("разбор работает — карточка DevHub найдена", () => {
    // Контроль: без него пустой список читался бы как «расхождений нет»,
    // и сторож молча охранял бы пустоту.
    expect(
      highlightsOf(src, "devhub").length,
      "разбор не нашёл карточку devhub — сторож охраняет пустоту, а не витрину",
    ).toBeGreaterThan(0);
  });

  it("список обещаний не менялся без перепроверки", () => {
    expect(
      highlightsOf(src, "devhub"),
      "Витрина DevHub обещает не то, что проверено 31.08. НЕ подгоняйте список " +
        "ПРОВЕРЕНО под то, что приехало: две выкаточные ветки несут старые " +
        "обещания (Railway/Vercel как цели выкатки и домен *.aevion.build), и оба " +
        "измерены ЛОЖНЫМИ на проде — работает одна цель из трёх, зона не " +
        "делегирована. Правильно: взять НАШУ сторону frontend/src/app/apps/page.tsx. " +
        "Разбор — в шапке этого файла.",
    ).toEqual(ПРОВЕРЕНО);
  });

  it("разбор различает карточки, а не берёт первую попавшуюся", () => {
    // Второй контроль: если бы разбор игнорировал id, обе карточки дали бы
    // одно и то же, и заморозка относилась бы не к DevHub.
    const другая = highlightsOf(src, "qcontract");
    if (другая.length > 0) {
      expect(
        другая,
        "разбор вернул одно и то же для разных карточек — значит заморозка " +
          "относится не к DevHub, и её зелёный цвет ничего не говорит",
      ).not.toEqual(ПРОВЕРЕНО);
    }
  });
});
