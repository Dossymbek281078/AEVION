import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Вызовы API модулей за платной стеной обязаны нести вход.
 *
 * Замер 14.09.2026. Стена (`requireModule` в бэкенде) узнаёт человека ТОЛЬКО по
 * заголовку `Authorization: Bearer`, а токен у нас лежит в `localStorage` — ни
 * cookie, ни прокси `/api-backend` его не донесут. На проде закрыты шесть
 * модулей (`/api/paywall/policy`, enforcedCount 6), и из 73 вызовов фронта к ним
 * 46 шли БЕЗ заголовка. Анонимная проба тех же адресов давала 402.
 *
 * Следствие не про статистику, а про деньги: подписчик, заплативший за тариф,
 * открывал страницу модуля — запрос уходил без токена, стена считала его
 * бесплатным и показывала окно «купите тариф». И воронка отказов записывала
 * его анонимом, так что зарегистрированных в ней не могло появиться вовсе.
 *
 * ГРАНИЦЫ, названные честно:
 *  - список модулей ниже — те, что закрыты на проде сейчас. Включат стену
 *    ещё одному модулю — дописать его сюда, иначе сторож его не видит;
 *  - видны только вызовы, где префикс стоит в тексте вызова. Адрес, собранный
 *    в переменной строкой выше, сторож пропустит;
 *  - исключения повторяют `isExemptPath` из `aevion-globus-backend/src/lib/planGate.ts`
 *    и публичный роутер мультичата — поменяются там, поменять и здесь.
 */

const SRC = join(process.cwd(), "src");

const ЗАКРЫТЫЕ: Record<string, string> = {
  qai: "/api/qai",
  qfusionai: "/api/qfusionai",
  qlearn: "/api/qlearn",
  qnews: "/api/qnews",
  healthai: "/api/healthai",
  "multichat-engine": "/api/multichat",
};
const ИСКЛЮЧЕНИЯ_СТЕНЫ = ["/health", "/me/plan", "/me/entitlements", "/providers", "/status", "/waitlist", "/subscribe"];
const ПУБЛИЧНЫЙ_МУЛЬТИЧАТ = ["/dissent/preview", "/receipt/verify", "/shared/"];
const ВХОД = /Authorization|getAuthHeaders|authHeaders?\s*\(|withAuth|Bearer|headers\s*:\s*authHeaders?\b|\.\.\.authHeaders?\b/;

/** Текст вызова от `fetch(` до его закрывающей скобки — не больше 40 строк. */
export function текстВызова(строки: string[], i: number): string | null {
  const старт = [i, i - 1, i - 2].find((k) => k >= 0 && строки[k].includes("fetch("));
  if (старт === undefined) return null;
  const кусок = строки.slice(старт, старт + 40).join("\n");
  const от = кусок.indexOf("fetch(") + "fetch(".length;
  let глубина = 1;
  for (let j = от; j < кусок.length; j++) {
    const c = кусок[j];
    if (c === "(") глубина++;
    else if (c === ")" && --глубина === 0) return кусок.slice(от, j);
  }
  return null;
}

type Место = { файл: string; строка: number; модуль: string; текст: string; есть_вход: boolean };

/** Все вызовы фронта к закрытым префиксам, с признаком «несёт ли вход». */
export function найтиВызовы(
  корень: string,
  пары: Array<[string, string]> = Object.entries(ЗАКРЫТЫЕ).map(([модуль, префикс]) => [префикс, модуль]),
): { места: Место[]; неразобрано: string[] } {
  // Длинный префикс раньше короткого: /api/veilnetx-ledger не должен уйти в /api/veilnetx.
  const порядок = [...пары].sort((a, b) => b[0].length - a[0].length);
  const шаблоны = порядок.map(([префикс, модуль]) => [new RegExp(префикс + "([/\"'`?$][^\"'`]*)?(?![A-Za-z0-9_-])"), модуль] as const);
  const места: Место[] = [];
  const неразобрано: string[] = [];
  const обход = (d: string) => {
    for (const имя of readdirSync(d)) {
      const p = join(d, имя);
      if (статистика(p).isDirectory()) {
        if (имя === "__tests__" || имя === "node_modules") continue;
        обход(p);
      } else if (/\.(ts|tsx)$/.test(имя) && !/\.test\./.test(имя)) {
        const строки = readFileSync(p, "utf8").split("\n");
        строки.forEach((line, i) => {
          if (!line.includes("/api/")) return;
          for (const [шаблон, модуль] of шаблоны) {
            const m = line.match(шаблон);
            if (!m) continue;
            const окно = строки.slice(Math.max(0, i - 2), i + 1).join("\n");
            if (!/fetch\(/.test(окно)) break;
            const путь = (m[1] ?? "").split("?")[0].replace(/\/+$/, "");
            if (модуль === "multichat-engine" && ПУБЛИЧНЫЙ_МУЛЬТИЧАТ.some((x) => путь.startsWith(x))) break;
            if (ИСКЛЮЧЕНИЯ_СТЕНЫ.some((x) => путь.endsWith(x))) break;
            const файл = relative(корень, p).split("\\").join("/");
            const текст = текстВызова(строки, i);
            if (текст === null) { неразобрано.push(`${файл}:${i + 1}`); break; }
            места.push({ файл, строка: i + 1, модуль, текст, есть_вход: ВХОД.test(текст) });
            break;
          }
        });
      }
    }
  };
  обход(корень);
  return { места, неразобрано };
}

function статистика(p: string) {
  return statSync(p);
}

const КОРЕНЬ = join(process.cwd(), "..");

/**
 * Все модули, которые стена УМЕЕТ закрывать, — из бэкенда, а не списком здесь:
 * список в тесте протух бы при первом новом модуле. Источник —
 * `MODULE_GATE_PREFIXES` и встроенные `app.use(..., requireModule(...))` в
 * `index.ts`; `UNSAFE_TO_GATE` из `planGate.ts` — по первой строке записи,
 * иначе в список попадают слова из комментариев («full», «medium»).
 */
export function модулиСтены(): { пары: Array<[string, string]>; строкСписка: number; небезопасные: Set<string> } {
  const index = readFileSync(join(КОРЕНЬ, "aevion-globus-backend/src/index.ts"), "utf8");
  const блок = index.match(/MODULE_GATE_PREFIXES[^=]*=\s*\[([\s\S]*?)\n\];/);
  const пары: Array<[string, string]> = [];
  let строкСписка = 0;
  if (блок) {
    строкСписка = (блок[1].match(/\["\/api/g) ?? []).length;
    for (const m of блок[1].matchAll(/\[\s*"(\/api\/[^"]+)"\s*,\s*"([^"]+)"\s*\]/g)) пары.push([m[1], m[2]]);
  }
  for (const m of index.matchAll(/app\.use\(\s*"(\/api\/[^"]+)"\s*,\s*requireModule\(\s*"([^"]+)"\s*\)/g)) пары.push([m[1], m[2]]);
  const pg = readFileSync(join(КОРЕНЬ, "aevion-globus-backend/src/lib/planGate.ts"), "utf8");
  const u = pg.match(/UNSAFE_TO_GATE\s*=\s*new Set\(\s*\[([\s\S]*?)\]\s*\)/);
  const небезопасные = new Set<string>();
  if (u) for (const строка of u[1].split("\n")) {
    const m = строка.match(/^\s*"([^"]+)"/);
    if (m) небезопасные.add(m[1]);
  }
  return { пары, строкСписка, небезопасные };
}

/**
 * Долг: вызовы без входа у модулей, стена которых сейчас ВЫКЛЮЧЕНА. Замер
 * 14.09.2026. Пока стена выключена, вреда нет; включат — у заплативших будет
 * 402. Число может только уменьшаться: новый вызов без входа краснит сторожа,
 * починка — нет (сторож не должен мешать тому, кто чинит). Перед флипом модуля
 * его число здесь обязано стать 0 — см. docs/PAYWALL_FLIP_READINESS.md.
 */
const ДОЛГ_БЕЗ_ВХОДА: Record<string, number> = {
  qcoreai: 205, qreal: 23, qmedia: 15, qright: 14, "revenue-hub": 14, "qpaynet-embedded": 13,
  qgood: 12, qskyway: 11, qsign: 10, "psyapp-deps": 8, qmaskcard: 8, qventure: 8, "z-tide": 8,
  shadownet: 7, qpersona: 6, qstore: 6, veilnetx: 6, "aevion-ip-bureau": 5, "kids-ai-content": 5,
  mapreality: 5, qchaingov: 5, qcontract: 5, qlife: 5, "voice-of-earth": 4, qevents: 3,
  qmelanin: 3, qrenew: 3, ventures: 3, qtradeoffline: 2, "startup-exchange": 2, deepsan: 0, lifebox: 0,
};

describe("вызовы модулей за стеной несут вход", () => {
  it("прибор различает: без заголовка — находка, с заголовком — нет", () => {
    const без = 'fetch(apiUrl("/api/qai/personas"))'.split("\n");
    const с = 'fetch(apiUrl("/api/qai/personas"), { headers: getAuthHeaders() })'.split("\n");
    const tBez = текстВызова(без, 0);
    const tS = текстВызова(с, 0);
    expect(tBez, "вызов без заголовка не разобран").not.toBeNull();
    expect(ВХОД.test(tBez!), "вызов без заголовка принят за несущий вход").toBe(false);
    expect(ВХОД.test(tS!), "вызов с getAuthHeaders() не узнан").toBe(true);
    const многострочный = ["const r = await fetch(", "  `${base}/api/healthai/log`,", "  {", '    method: "POST",', "    headers: { ...getAuthHeaders() },", "  },", ");"];
    expect(ВХОД.test(текстВызова(многострочный, 1) ?? ""), "многострочный вызов с входом не узнан").toBe(true);
  });

  // Один проход по файлам на все модули стены. Два прохода стоили 44 секунды и
  // падали по таймауту набора (30 с): сторож, медленнее всех остальных тестов,
  // в полном прогоне под нагрузкой начал бы краснеть не по делу.
  const стена = модулиСтены();
  const { места: всеМеста, неразобрано } = найтиВызовы(SRC, стена.пары);
  const закрытыеИмена = new Set(Object.keys(ЗАКРЫТЫЕ));
  const места = всеМеста.filter((м) => закрытыеИмена.has(м.модуль));

  it("вызовы к закрытым модулям вообще найдены — иначе проверка пуста", () => {
    // На 14.09.2026 их 73. Резкое падение — скорее поломка разбора, чем чистка кода.
    expect(места.length, "найдено подозрительно мало вызовов к закрытым модулям").toBeGreaterThan(60);
    for (const модуль of Object.keys(ЗАКРЫТЫЕ)) {
      expect(места.some((m) => m.модуль === модуль), `ни одного вызова к ${модуль} — префикс устарел?`).toBe(true);
    }
  });

  it("каждый вызов разобран до конца — неразобранный не может пройти молча", () => {
    expect(неразобрано, "вызов не закрылся за 40 строк — проверьте вручную").toEqual([]);
  });

  it("список модулей стены прочитан из бэкенда целиком", () => {
    const { пары, строкСписка, небезопасные } = модулиСтены();
    expect(строкСписка, "MODULE_GATE_PREFIXES не найден — сторож смотрит не туда").toBeGreaterThan(30);
    const изБлока = пары.length - 2; // два встроенных подключения: qcoreai и мультичат
    expect(изБлока, "разобрано меньше записей, чем строк в списке — шаблон отстал от кода").toBe(строкСписка);
    expect([...небезопасные].sort(), "UNSAFE_TO_GATE прочитан не так").toEqual(["qcoreai", "qright", "qsign"]);
    for (const модуль of Object.keys(ЗАКРЫТЫЕ)) {
      expect(пары.some(([, m]) => m === модуль), `закрытый модуль ${модуль} пропал из стены бэкенда`).toBe(true);
    }
  });

  it("у модулей с выключенной стеной долг без входа не растёт", () => {
    const счёт: Record<string, number> = {};
    for (const м of всеМеста) {
      if (закрытыеИмена.has(м.модуль) || м.есть_вход) continue;
      счёт[м.модуль] = (счёт[м.модуль] ?? 0) + 1;
    }
    const выросло = Object.entries(счёт)
      .filter(([модуль, n]) => n > (ДОЛГ_БЕЗ_ВХОДА[модуль] ?? 0))
      .map(([модуль, n]) => `${модуль}: ${n} при планке ${ДОЛГ_БЕЗ_ВХОДА[модуль] ?? 0}`);
    expect(
      выросло,
      "новый вызов без входа к модулю, который могут закрыть стеной. Добавьте headers: getAuthHeaders()",
    ).toEqual([]);
    // Контроль прибора: долг вообще виден — иначе ноль ничего не значит.
    expect(Object.values(счёт).reduce((a, b) => a + b, 0), "долг без входа не найден вовсе — поиск сломан?").toBeGreaterThan(100);
  });

  it("ни один вызов к закрытому модулю не уходит без входа", () => {
    const без_входа = места.filter((m) => !m.есть_вход).map((m) => `${m.файл}:${m.строка} (${m.модуль})`);
    expect(
      без_входа,
      "запрос к модулю за стеной без Authorization: заплативший получит 402 как гость. " +
        "Добавьте headers: getAuthHeaders() из @/lib/auth",
    ).toEqual([]);
  });
});
