import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Сквозной сторож класса «форма говорит „сохранено“, а данные теряются».
 *
 * 28–29.08.2026 этот класс нашёлся в ВОСЬМИ местах: подписка на запуск, биржа
 * идей, венчурный маркет, пост, личное сообщение, статья, упражнение,
 * настроение. Везде одно и то же: ручка ЧЕСТНА и возвращает `storage`
 * ("db"/"postgres" против запасного пути в памяти процесса), а форма читает
 * только код ответа и показывает успех — иногда ещё и очищая набранный текст.
 *
 * Чинить их пришлось по одному. Этот сторож нужен, чтобы ДЕВЯТОЕ такое место
 * нашлось само — в том числе в модулях, которых ещё нет.
 *
 * ЧТО ОН УТВЕРЖДАЕТ, а что нет. Он НЕ объявляет каждый файл из списка ниже
 * дефектом: часть из них — страницы документации, генератор картинки и два
 * случая, проверенных вручную и признанных честными (пожертвования отвечают
 * 500 при отказе; форма сигналов прямо пишет «in-memory if DB unavailable»).
 * Он фиксирует ГРАНИЦУ: список не растёт. Появилась новая форма, которая шлёт
 * в ручку с запасным путём и не смотрит на `storage`, — сторож краснеет.
 *
 * Регулярок с обратными слэшами здесь нет намеренно: они теряются на границе
 * вызова, и тогда файл молча перестаёт разбираться («no tests» вместо
 * красного) — на этом за сутки обожглись трижды.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const FRONT = join(HERE, "..", "..");                       // frontend/src
const ROUTES = join(HERE, "..", "..", "..", "..", "aevion-globus-backend", "src", "routes");

/** Ручки, у которых есть запасной путь «легло в память процесса». */
function routersWithMemoryFallback(): string[] {
  // Ищем по БЛИЗОСТИ слов, а не по литералу `storage: "memory"`. Первая версия
  // искала литерал — и пропустила роутер подписки на запуск, где признак
  // присваивается через переменную (`let storage: "postgres" | "memory"`).
  // То есть сторож не покрывал ПЕРВЫЙ же случай, ради которого написан.
  return readdirSync(ROUTES)
    .filter((f) => f.endsWith(".ts"))
    .filter((f) => {
      const s = readFileSync(join(ROUTES, f), "utf8");
      let at = 0;
      for (;;) {
        const i = s.indexOf('"memory"', at);
        if (i < 0) return false;
        at = i + 1;
        if (s.slice(Math.max(0, i - 60), i + 20).includes("storage")) return true;
      }
    });
}

/**
 * Префиксы адресов, по которым фронт узнаёт эти ручки. Ведём списком, а не
 * выводим из имени файла: `startupExchange.ts` смонтирован как `/api/startupx`,
 * совпадения по имени тут не будет.
 */
const PREFIXES = [
  "devhub", "mapreality", "planet", "qevents", "qgood",
  "qnews", "qsocial", "startupx", "ventures", "voice-of-earth",
  "constitution/waitlist", "lifebox", "psyapp-deps",
];

/**
 * Комментарии вырезаем ДО поиска. Без этого сторож поднял страницу запуска
 * Multichat: она лишь УПОМИНАЕТ ручку подписки в заметке о том, что проверено,
 * а шлёт совсем в другие. Ложная тревога на честном файле — самый быстрый
 * способ сделать сторожа ненужным.
 */
/** Перевод строки константой: литерал с обратным слэшем теряется на границе
 * вызова и рвёт файл — на этом сторож уже один раз перестал разбираться. */
const NL = String.fromCharCode(10);

function stripComments(src: string): string {
  return src
    .split(NL)
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
    })
    .join(NL);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e !== "__tests__" && e !== "node_modules") walk(p, out);
    } else if (e.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function posters(): { all: string[]; unread: string[] } {
  const all: string[] = [];
  const unread: string[] = [];
  for (const f of walk(FRONT)) {
    const s = stripComments(readFileSync(f, "utf8"));
    if (!s.includes('method: "POST"') && !s.includes("method: 'POST'")) continue;
    if (!PREFIXES.some((p) => s.includes("/api/" + p))) continue;
    const rel = relative(FRONT, f).split(sep).join("/");
    all.push(rel);
    if (!s.includes("storage")) unread.push(rel);
  }
  return { all, unread };
}

/**
 * Замер 29.08.2026. Список только ТАЕТ: разобрали место — вычеркнули.
 * Добавлять сюда новое НЕЛЬЗЯ; новая форма обязана читать признак сразу.
 */
const KNOWN_UNREAD = new Set([
  "app/admin/planet/page.tsx",
  "app/bank/api/page.tsx",
  "app/bank/diagnostics/page.tsx",
  "app/bank/smoke/page.tsx",
  "app/constitution/api/page.tsx",
  "app/constitution/leaderboard/page.tsx",
  "app/constitution/page.tsx",
  "app/developers/fintech/page.tsx",
  "app/developers/opengraph-image.tsx",
  "app/developers/page.tsx",
  "app/devhub/[id]/deploy/page.tsx",
  "app/fintech/playground/page.tsx",
  "app/mapreality/components/SignalCard.tsx",
  "app/mapreality/components/SignalForm.tsx",
  "app/planet/artifact/[id]/page.tsx",
  "app/planet/page.tsx",
  "app/planet/webhooks/[id]/page.tsx",
  "app/psyapp-deps/components/StreakCounter.tsx",
  "app/psyapp-deps/components/SupportChat.tsx",
  "app/psyapp-deps/components/TriggerLog.tsx",
  "app/qgood/campaigns/[id]/DonateForm.tsx",
  "app/qgood/components/AiChat.tsx",
  "app/qgood/matching-pools/AdminPanel.tsx",
  // IdeaCard и InterestModal ушли из списка 31.08: соседнее окно перевело
  // биржу идей на общий lib.ts, и обе формы теперь читают признак хранения
  // сами. Храповик это и поймал — список обязан таять, а не только расти.
  "app/voice-of-earth/page.tsx",
]);

describe("формы читают признак хранения, а не только код ответа", () => {
  const routers = routersWithMemoryFallback();
  const { all, unread } = posters();

  // Контроль ОХВАТА. Без него сторож ответит «нарушений нет» и на пустом
  // множестве: сломается обход каталогов — и он станет вечнозелёным.
  it("контроль прибора: обе стороны найдены", () => {
    expect(routers.length, "не нашёл роутеров с запасным путём").toBeGreaterThanOrEqual(12);
    expect(all.length, "не нашёл форм, шлющих в эти ручки").toBeGreaterThanOrEqual(10);
  });

  it("новых форм, игнорирующих признак, не появилось", () => {
    const fresh = unread.filter((f) => !KNOWN_UNREAD.has(f));
    expect(
      fresh,
      `форма шлёт в ручку с запасным путём и не читает storage: ${fresh.join(", ")}`,
    ).toEqual([]);
  });

  it("список тает: в нём нет тех, кто уже читает признак", () => {
    const fixed = [...KNOWN_UNREAD].filter((f) => !unread.includes(f));
    expect(
      fixed,
      `эти уже читают storage — вычеркните их из KNOWN_UNREAD: ${fixed.join(", ")}`,
    ).toEqual([]);
  });
});
