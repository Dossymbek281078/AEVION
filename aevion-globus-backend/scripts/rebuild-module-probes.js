#!/usr/bin/env node
/**
 * Пересобрать набор проб для prod-module-surface.js.
 *
 * Зачем скрипт, а не описание в шапке: набор протухает молча. Появится новый
 * модуль — пробы у него не будет, проверка честно скажет «все на месте», просто
 * их станет 88 из 130 вместо 88 из 95. Пересборка должна быть командой.
 *
 *   node scripts/rebuild-module-probes.js            # показать, что изменится
 *   node scripts/rebuild-module-probes.js --write    # записать набор
 *
 * Как выбирается проба. Из index.ts берутся точки монтирования и имя роутера,
 * из файла роутера — ручки GET без параметров, каждая проверяется на живом
 * проде. Годится ответ, ОТЛИЧНЫЙ от 404: express отвечает 404 и на
 * несуществующий путь внутри живого модуля, поэтому 404 не доказывает ничего.
 *
 * Три ловушки разбора, каждая стоила модулей в наборе (14.08.2026):
 *   • кавычки бывают обе — `router.get('/leaderboard')` пропускался, и
 *     cyberchess-daily выглядел модулем «без ручек», хотя его проба даёт 200;
 *   • роутеры зовутся по-своему — шаблон на `router.get` нашёл ручки у 6
 *     модулей из 105, надёжный признак — путь, начинающийся со слэша;
 *   • посредник при монтировании бывает вызовом со скобками:
 *     app.use("/api/qcoreai", requireModule("qcoreai"), qcoreaiRouter).
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(__dirname, "prod-module-probes.json");
const BASE = (process.env.BASE || "https://api.aevion.app").replace(/\/+$/, "");
const WRITE = process.argv.includes("--write");

const idx = fs.readFileSync(path.join(ROOT, "src", "index.ts"), "utf-8");

const imports = new Map();
for (const m of idx.matchAll(
  /import\s+(?:\{\s*([\w,\s]+?)\s*\}|(\w+))\s+from\s+["']\.\/routes\/([\w-]+)["']/g,
)) {
  for (const n of (m[1] || m[2] || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    imports.set(n, path.join(ROOT, "src", "routes", `${m[3]}.ts`));
  }
}

const modules = [];
for (const m of idx.matchAll(/app\.use\(["'](\/api\/[^"']+)["']\s*,([^;]*?)\);/g)) {
  const ids = [...m[2].matchAll(/([A-Za-z_$][\w$]*)\s*(?:,|$)/g)].map((x) => x[1]);
  const file = imports.get(ids[ids.length - 1] || "");
  let routes = [];
  if (file && fs.existsSync(file)) {
    routes = [...fs.readFileSync(file, "utf-8").matchAll(/[\w$]+\.get\(\s*["']([^"']+)["']/g)]
      .map((r) => r[1])
      .filter((p) => p.startsWith("/") && !p.includes(":") && !p.includes("*"));
  }
  modules.push({
    base: m[1],
    candidates: [...new Set(routes)].slice(0, 6).map((p) => m[1] + (p === "/" ? "" : p)),
  });
}

(async () => {
  const jobs = [];
  for (const mod of modules) for (const url of mod.candidates) jobs.push({ base: mod.base, url });
  const res = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (i < jobs.length) {
        const j = jobs[i++];
        try {
          const r = await fetch(BASE + j.url, { signal: AbortSignal.timeout(15000) });
          res.push({ ...j, status: r.status });
        } catch {
          res.push({ ...j, status: 0 });
        }
      }
    }),
  );

  if (res.length && res.every((r) => r.status === 0)) {
    console.error("Прод не ответил ни разу — набор не пересобираю, чтобы не записать пустой.");
    process.exitCode = 2;
    return;
  }

  const best = new Map();
  for (const r of res) {
    const good = r.status !== 404 && r.status !== 0;
    const cur = best.get(r.base);
    if (!cur || (good && !cur.good)) best.set(r.base, { ...r, good });
  }
  const probes = [...best.values()]
    .filter((x) => x.good)
    .map((x) => ({ base: x.base, url: x.url, expect: x.status }))
    .sort((a, b) => (a.base < b.base ? -1 : 1));

  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf-8")) : [];
  const P = new Set(prev.map((x) => x.base));
  const N = new Set(probes.map((x) => x.base));
  const added = [...N].filter((b) => !P.has(b));
  const gone = [...P].filter((b) => !N.has(b));

  console.log(`точек монтирования: ${modules.length}, проб получилось: ${probes.length} (было ${prev.length})`);
  if (added.length) console.log(`  добавились: ${added.join(", ")}`);
  // Исчезновение пробы двусмысленно: модуль убрали из кода ЛИБО он сейчас не на
  // проде. Пересборка на «чужой» сборке молча сузила бы набор — поэтому говорим
  // об этом вслух, а не просто записываем.
  if (gone.length) {
    console.log(`  ⚠️  пропали из набора: ${gone.join(", ")}`);
    console.log("      это либо удалённые модули, либо модули, которых нет в ТЕКУЩЕЙ сборке прода.");
    console.log("      Проверьте, чья ветка на проде, прежде чем записывать: node C:\\Users\\user\\aevion-deploy-check.mjs");
  }

  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(probes, null, 1), "utf-8");
    console.log(`\nзаписано: ${OUT}`);
    console.log("Не забудьте обновить копию вне репозитория (её читает страница состояния):");
    console.log("  copy scripts\\prod-module-probes.json C:\\Users\\user\\aevion-module-probes.json");
  } else {
    console.log("\n(ничего не записано — добавьте --write)");
  }
})();
