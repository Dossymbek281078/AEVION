#!/usr/bin/env node
/*
 * sign-delivery.mjs — подписать подготовленную поставку платформенным ключом.
 *
 * ЗАЧЕМ ОТДЕЛЬНЫЙ ФАЙЛ. В порядке пилота средний шаг был написан словами:
 * «POST каждый payload на /api/qsign/v2/sign». Слова на критическом пути — это
 * то же самое, что непроверенный код: когда покупатель скажет «да», этот шаг
 * будут набирать руками, в спешке, первый раз в жизни. Здесь он написан и
 * проверен заранее, чтобы в тот день осталось подставить ключ.
 *
 *   node sign-delivery.mjs <каталог поставки>        # из bundle prepare
 *   node sign-delivery.mjs <каталог> --batch         # пачкой, если файлов много
 *   node sign-delivery.mjs --selftest                # без сети и без ключа
 *
 * Ключ берётся ТОЛЬКО из окружения: AEVION_API_KEY. В команду его не
 * подставлять — он попадёт в историю оболочки и в журналы.
 *
 * Коды: 0 подписано всё, 1 подписано не всё (или ключ отвергнут),
 *       2 запуск невозможен — нет ключа, нет входных данных, сеть молчит.
 *       🔴 Код 2 это НЕ «ничего страшного»: поставка не подписана.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const API = process.env.AEVION_API || "https://api.aevion.app";

/** Один запрос подписи. Отделено, чтобы самопроверка могла подменить. */
export async function подписатьОдин(payload, ключ, fetchFn = fetch, api = API) {
  const r = await fetchFn(`${api}/api/qsign/v2/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ключ },
    body: JSON.stringify({ payload }),
  });
  const тело = await r.json().catch(() => ({}));
  return { ok: r.status === 201, status: r.status, тело };
}

export async function подписатьПачкой(payloads, ключ, fetchFn = fetch, api = API) {
  const r = await fetchFn(`${api}/api/qsign/v2/sign/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ключ },
    body: JSON.stringify({ items: payloads }),
  });
  const тело = await r.json().catch(() => ({}));
  return { ok: r.status === 201, status: r.status, тело };
}

/**
 * Разбор ответа в строки для `bundle attach`.
 *
 * Одиночная подпись и пачка отвечают ПО-РАЗНОМУ: первая отдаёт запись
 * целиком, вторая — только {ok, id}. Сводим к одному виду здесь, а не у
 * вызывающего: иначе появятся две ветки разбора и однажды разойдутся.
 */
export function вРезультаты(файлы, ответы) {
  return файлы.map((файл, i) => {
    const о = ответы[i];
    /*
     * Запись несём ДАЛЬШЕ, а не выбрасываем. Одиночная подпись отдаёт её
     * целиком, и именно она потом вкладывается в манифест — чтобы покупателю
     * не требовалось обращаться к нашему api (замер 12.10: без вложения
     * проверка образца падала на всех 5 записях при мёртвом apiBase).
     * Пачка записи не отдаёт — там её добирает bundle attach одним проходом.
     */
    const сЗаписью = о?.ed25519?.signature ? { record: о } : {};
    return { file: файл, id: о?.id ?? null, ok: Boolean(о?.id), ...сЗаписью };
  });
}

async function main() {
  const каталог = process.argv[2];
  const пачкой = process.argv.includes("--batch");

  const ключ = process.env.AEVION_API_KEY;
  if (!ключ) {
    console.error("нет ключа: задайте AEVION_API_KEY в окружении (в команду не вписывать)");
    console.error("это НЕ «подписано» — код 2");
    process.exitCode = 2;
    return;
  }

  let вход;
  try {
    вход = JSON.parse(readFileSync(join(каталог, "to-sign.json"), "utf8"));
  } catch (e) {
    console.error(`не читается ${каталог}/to-sign.json: ${e.message}`);
    process.exitCode = 2;
    return;
  }
  const payloads = (вход.payloads ?? []).map((p) => p.payload);
  const файлы = (вход.payloads ?? []).map((p) => p.file);
  if (payloads.length === 0) {
    console.error("в поставке нет ни одного payload — подписывать нечего");
    process.exitCode = 2;
    return;
  }

  console.log(`подписываю ${payloads.length} файл(ов)${пачкой ? " пачкой" : " по одному"} на ${API}`);

  let ответы = [];
  try {
    if (пачкой) {
      const r = await подписатьПачкой(payloads, ключ);
      if (!r.ok) {
        console.error(`пачка отклонена: HTTP ${r.status} ${JSON.stringify(r.тело).slice(0, 200)}`);
        process.exitCode = r.status === 401 ? 1 : 2;
        return;
      }
      ответы = r.тело.results ?? [];
    } else {
      for (const p of payloads) {
        const r = await подписатьОдин(p, ключ);
        if (!r.ok) {
          console.error(`отказ на файле: HTTP ${r.status} ${JSON.stringify(r.тело).slice(0, 200)}`);
          if (r.status === 401) {
            console.error("ключ не принят: он отозван, неверен или это не ключ подписи");
            process.exitCode = 1;
            return;
          }
        }
        ответы.push(r.тело);
      }
    }
  } catch (e) {
    console.error(`сеть не ответила: ${e.message}`);
    console.error("это НЕ «подписано» — код 2");
    process.exitCode = 2;
    return;
  }

  const результаты = вРезультаты(файлы, ответы);
  const подписано = результаты.filter((r) => r.ok).length;
  writeFileSync(join(каталог, "signed.json"), JSON.stringify({ results: результаты }, null, 2) + "\n");

  console.log(`подписано ${подписано} из ${результаты.length}; записано ${join(каталог, "signed.json")}`);
  for (const r of результаты.filter((x) => !x.ok)) console.log(`  НЕ подписан: ${r.file}`);
  console.log(`дальше: node bundle-aevion.mjs attach ${каталог} --signed ${join(каталог, "signed.json")}`);

  process.exitCode = подписано === результаты.length ? 0 : 1;
}

/* ------------------------------------------------------------------ *
 * Самопроверка: без сети, без ключа, с подменённым fetch.
 *
 * Проверяется не «работает ли», а поведение на ОТКАЗАХ — именно оно решит
 * исход в день пилота. Успешная ветка тоже здесь, но она самая простая.
 * ------------------------------------------------------------------ */
function selftest() {
  const случаи = [];
  const ok = (имя, условие) => случаи.push([имя, condBool(условие)]);
  const condBool = (v) => Boolean(v);

  return (async () => {
    const payload = { file: "a.txt", sha256: "aa" };

    /* 201 — подписано */
    const успех = await подписатьОдин(payload, "k", async () => ({
      status: 201,
      json: async () => ({ id: "sig-1" }),
    }));
    ok("201 считается успехом", успех.ok && успех.тело.id === "sig-1");

    /* 401 — ключ отвергнут, и это НЕ успех */
    const отказ = await подписатьОдин(payload, "k", async () => ({
      status: 401,
      json: async () => ({ error: "missing or invalid bearer token or x-api-key" }),
    }));
    ok("401 НЕ считается успехом", отказ.ok === false && отказ.status === 401);

    /* 200 вместо 201 — тоже не успех: ручка создаёт, значит 201 */
    const двести = await подписатьОдин(payload, "k", async () => ({
      status: 200,
      json: async () => ({ id: "sig-x" }),
    }));
    ok("200 не принимается за создание", двести.ok === false);

    /* Ответ без id — подпись не состоялась, сколько бы ни было 201 */
    const безId = вРезультаты(["a.txt", "b.txt"], [{ id: "s1" }, {}]);
    ok("ответ без id помечается как неподписанный", безId[0].ok === true && безId[1].ok === false);

    /* Форма пачки сводится к той же */
    const пачка = вРезультаты(["a.txt", "b.txt"], [{ ok: true, id: "s1" }, { ok: false }]);
    ok(
      "запись из одиночной подписи доносится до манифеста",
      вРезультаты(["a.bin"], [{ id: "s1", ed25519: { signature: "ff".repeat(64) } }])[0].record
        ?.ed25519?.signature === "ff".repeat(64),
    );
    ok(
      "ответ пачки без записи не выдумывает её",
      вРезультаты(["a.bin"], [{ id: "s1" }])[0].record === undefined,
    );
    ok("пачка сводится к общему виду", пачка[0].id === "s1" && пачка[1].ok === false);

    /* Порядок не теряется: имя файла привязано к своему ответу */
    const порядок = вРезультаты(["x", "y", "z"], [{ id: "1" }, { id: "2" }, { id: "3" }]);
    ok("порядок файлов сохраняется", порядок.map((r) => r.file + r.id).join() === "x1,y2,z3");

    let плохих = 0;
    for (const [имя, прошло] of случаи) {
      if (!прошло) плохих++;
      console.log(`${прошло ? "ok   " : "WRONG"} ${имя}`);
    }
    console.log(`\nself-test: ${случаи.length - плохих} of ${случаи.length} as expected`);
    process.exitCode = плохих === 0 ? 0 : 1;
  })();
}

if (process.argv.includes("--selftest")) selftest();
else if (!process.argv[2]) {
  console.error("usage: node sign-delivery.mjs <каталог поставки> [--batch] | --selftest");
  process.exitCode = 2;
} else main();
