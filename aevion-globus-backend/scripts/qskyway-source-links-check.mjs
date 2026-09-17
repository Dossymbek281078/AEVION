// Живы ли ссылки на первоисточники правил (sourceUrl каждого permission-слоя).
//
// Повод (16.09.2026): ссылка Амстердама ведёт в папку цикла AIRAC eAIP LVNL
// (`AIRAC%20AMDT%2009-2026_2026_09_03`), которая сменится 01.10.2026 — и
// подписанный документ обоснования будет ссылаться на 404. У eAIP LVNL нет
// стабильного корня (корень — заглушка Azure, /web/ — 403), так что ловить
// это можно только опросом. То же для BAF, CAAS, Казаэронавигации и WFS
// Austro Control.
//
// Коды: 0 — все отвечают, 1 — есть мёртвые (названы), 2 — сеть не ответила
// ни по одной (не «всё в порядке»). Браузерный User-Agent обязателен: eAIP
// LVNL отвечает 403 на всё остальное.
//
//   node scripts/qskyway-source-links-check.mjs
import fs from "node:fs";
import path from "node:path";

const dir = new URL("../src/routes/", import.meta.url);
const files = fs.readdirSync(dir).filter((f) => /^qskyway\.permission\..+\.ts$/.test(f));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36";
const rows = [];
for (const f of files) {
  const text = fs.readFileSync(path.join(dir.pathname.replace(/^\/([A-Za-z]:)/, "$1"), f), "utf8");
  // Ключ бывает и в кавычках (Токио — JSON-литерал), и голый.
  const m = text.match(/"?sourceUrl"?:\s*"([^"]+)"/);
  if (!m) { rows.push({ f, url: "(нет sourceUrl)", status: "—", ok: false }); continue; }
  // Шаблон тайлов MLIT (Токио) — подставляем настоящий тайл над Ниси-Синдзюку (z14).
  const url = m[1].replace("{z}", "14").replace("{x}", "14549").replace("{y}", "6450");
  try {
    // eAIP LVNL стоит за WAF: без Accept и Accept-Language отвечает 403, а с
    // Accept-Encoding: identity — снова 403 (замер 16.09, четыре набора заголовков).
    const r = await fetch(url, {
      // Ровно этот Accept: с добавками (application/json, image/png, */*) WAF снова
      // отвечает 403; WFS и тайлы на Accept не смотрят.
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml", "Accept-Language": "en" },
      signal: AbortSignal.timeout(60_000), redirect: "follow",
    });
    let status = r.status, ok = r.ok;
    // WAF eAIP LVNL пускает curl с тем же User-Agent и отбивает node-fetch с теми
    // же заголовками (замер 16.09: curl 200, fetch 403 подряд) — отпечаток
    // клиента, не заголовки. 403 перепроверяем curl-ом, чтобы не объявить
    // живую ссылку мёртвой; настоящий 404 curl подтвердит.
    if (status === 403) {
      const { spawnSync } = await import("node:child_process");
      const c = spawnSync("curl", ["-s", "-o", process.platform === "win32" ? "NUL" : "/dev/null", "-w", "%{http_code}", "--max-time", "60", "-A", UA, url], { encoding: "utf8" });
      const code = Number((c.stdout || "").trim());
      if (Number.isFinite(code) && code > 0) { status = `${code} (curl; fetch 403)`; ok = code >= 200 && code < 400; }
    }
    rows.push({ f, url, status, ok });
  } catch (e) {
    rows.push({ f, url, status: `ошибка: ${e.message}`, ok: false, net: true });
  }
}
for (const r of rows) console.log(`${r.ok ? "OK " : "❌ "} ${r.status}  ${r.f}  ${r.url}`);
const dead = rows.filter((r) => !r.ok);
if (rows.length && dead.length === rows.length && rows.every((r) => r.net)) { console.log("СПРОСИТЬ НЕ УДАЛОСЬ: ни один хост не ответил"); process.exitCode = 2; }
else if (dead.length) { console.log(`МЁРТВЫХ ССЫЛОК: ${dead.length} из ${rows.length}`); process.exitCode = 1; }
else console.log(`все ${rows.length} ссылок на первоисточники живы`);
