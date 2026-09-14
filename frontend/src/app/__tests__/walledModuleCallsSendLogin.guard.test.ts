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
export function найтиВызовы(корень: string): { места: Место[]; неразобрано: string[] } {
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
          for (const [модуль, префикс] of Object.entries(ЗАКРЫТЫЕ)) {
            const m = line.match(new RegExp(префикс.replace(/\//g, "\/") + "([/\"'`?$][^\"'`]*)?"));
            if (!m) continue;
            const окно = строки.slice(Math.max(0, i - 2), i + 1).join("\n");
            if (!/fetch\(/.test(окно)) continue;
            const путь = (m[1] ?? "").split("?")[0].replace(/\/+$/, "");
            if (модуль === "multichat-engine" && ПУБЛИЧНЫЙ_МУЛЬТИЧАТ.some((x) => путь.startsWith(x))) continue;
            if (ИСКЛЮЧЕНИЯ_СТЕНЫ.some((x) => путь.endsWith(x))) continue;
            const файл = relative(корень, p).split("\\").join("/");
            const текст = текстВызова(строки, i);
            if (текст === null) { неразобрано.push(`${файл}:${i + 1}`); continue; }
            места.push({ файл, строка: i + 1, модуль, текст, есть_вход: ВХОД.test(текст) });
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

  const { места, неразобрано } = найтиВызовы(SRC);

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

  it("ни один вызов к закрытому модулю не уходит без входа", () => {
    const без_входа = места.filter((m) => !m.есть_вход).map((m) => `${m.файл}:${m.строка} (${m.модуль})`);
    expect(
      без_входа,
      "запрос к модулю за стеной без Authorization: заплативший получит 402 как гость. " +
        "Добавьте headers: getAuthHeaders() из @/lib/auth",
    ).toEqual([]);
  });
});
