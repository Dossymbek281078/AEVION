#!/usr/bin/env node
/**
 * Смоук на дефекты, найденные 19.08.2026 — чтобы они не вернулись молча.
 *
 * Зачем отдельным файлом. Ни один из существующих смоуков не проверял ни
 * один из этих классов: поиск по всем скриптам дал ноль упоминаний
 * `limit=-1`, `no_payment_provider`, `bad_request` и `email/healthz`.
 * А классы дорогие: платный товар выдавался без оплаты, кривое число роняло
 * Postgres, регистрация молча не отправляла письма.
 *
 * ПОЧЕМУ НЕ КРАСНЫЙ С РОЖДЕНИЯ. Часть починок ещё не выкачена, и смоук,
 * который красен всегда, перестают читать — тогда настоящая регрессия тонет.
 * Поэтому каждый случай имеет ожидаемое состояние:
 *
 *   FIXED   — починка на проде: расхождение это РЕГРЕССИЯ, выход 1
 *   PENDING — починки ещё нет: расхождение ожидаемо, выход 0, но видно
 *
 * Когда ветки смержены и выкачены, PENDING переводится в FIXED — одной
 * правкой в таблице ниже. Пока этого не сделали, смоук честно говорит
 * «ещё не выкачено», а не «всё хорошо».
 *
 * Только ЧИТАЮЩИЕ запросы: ничего не создаёт и не платит.
 */

const BASE = process.env.BASE || "https://api.aevion.app";
const TIMEOUT = Number(process.env.SMOKE_TIMEOUT_MS || 15000);

/** Классы дефектов и как их проверить снаружи. */
const CASES = [
  {
    id: "limit-negative",
    what: "отрицательный limit не должен ронять Postgres",
    // Все четыре подтверждены живой пробой 19.08: 500 с текстом ошибки базы.
    paths: [
      "/api/qevents/events?limit=-1",
      "/api/qjobs/jobs?limit=-1",
      "/api/qlife/biomarkers?limit=-1",
      "/api/qpersona/personas?limit=-5",
    ],
    bad: (s) => s >= 500,
    // Контроль: та же ручка с нормальным числом обязана отвечать 200.
    control: (p) => p.replace(/limit=-\d+/, "limit=3"),
    state: "PENDING",
  },
  {
    id: "malformed-url",
    what: "кривое процентное кодирование — 4xx, а не 5xx",
    paths: ["/api/qstore/products/%ED%E5%F1%F3%F9%E5%F1%F2%E2%F3%FE%F9%E8%E9"],
    bad: (s) => s >= 500,
    control: () => "/api/qstore/products/normal-id",
    state: "FIXED", // на проде отвечает 400 — проверено 19.08
  },
  {
    id: "gumroad-signed",
    what: "приёмник оплаты проверяет подпись",
    paths: ["/api/gumroad/webhook"],
    bad: async (_s, body) => {
      try { return JSON.parse(body).signed !== true; } catch { return true; }
    },
    state: "PENDING", // ждёт GUMROAD_WEBHOOK_SECRET на Railway
  },
  {
    id: "channels-health",
    what: "ручка состояния каналов отвечает",
    paths: ["/api/health/channels"],
    bad: (s) => s >= 400,
    state: "PENDING", // ждёт мержа feat/channels-healthz
  },
];

async function probe(path) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), TIMEOUT);
  try {
    const r = await fetch(BASE + path, { signal: c.signal, headers: { "User-Agent": "curl/8.7.1" } });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    return { status: 0, body: String(e && e.message) };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  let regressions = 0, pending = 0, ok = 0;
  for (const c of CASES) {
    for (const p of c.paths) {
      const r = await probe(p);
      const isBad = typeof c.bad === "function" ? await c.bad(r.status, r.body) : false;

      // Контроль обязателен там, где он объявлен: без него «не 500» может
      // значить, что ручки просто нет, а не что она чинена.
      let controlOk = true;
      if (c.control) {
        const cr = await probe(c.control(p));
        // Контроль доказывает, что ручка ЖИВА и отвечает штатно — а штатным
        // бывает и 404 («такого товара нет»), и 401, и 402. Первая версия
        // требовала 2xx и потому объявила проверку недостоверной там, где
        // всё было в порядке. Недостоверность — это 5xx и отсутствие ответа.
        controlOk = cr.status > 0 && cr.status < 500;
      }

      if (!isBad && controlOk) { ok++; console.log(`✅ ${c.id} ${p}`); continue; }
      if (!controlOk) {
        console.log(`⚠️  ${c.id} ${p} — КОНТРОЛЬ не прошёл, проверка недостоверна`);
        continue;
      }
      if (c.state === "FIXED") {
        regressions++;
        console.log(`🔴 РЕГРЕССИЯ ${c.id} ${p} → ${r.status} · ${c.what}`);
      } else {
        pending++;
        console.log(`⏳ ${c.id} ${p} → ${r.status} · ещё не выкачено · ${c.what}`);
      }
    }
  }
  console.log(`\nитого: ok ${ok}, ждут выкатки ${pending}, регрессий ${regressions}`);
  process.exitCode = regressions > 0 ? 1 : 0;
})();
