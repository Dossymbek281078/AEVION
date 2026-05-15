#!/usr/bin/env node
/**
 * AEVION Demo Screenshot Capture
 *
 * Запускает Playwright, проходит по всем 9 разделам демо,
 * делает скриншоты 1920×1080. Скриншоты сохраняются в
 * scripts/demo-record/screenshots/
 *
 * Требования:
 *   cd frontend && npx playwright install --with-deps chromium
 *
 * Запуск:
 *   node scripts/demo-record/01-screenshot.mjs
 *   node scripts/demo-record/01-screenshot.mjs https://aevion.app  (против прода)
 */

// Playwright is installed in frontend/node_modules
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("../../frontend/node_modules/playwright");
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dir, "screenshots");
const BASE = process.argv[2] || "https://aevion.app";

mkdirSync(OUT, { recursive: true });

// Задержки в мс для каждого шага (дать странице загрузиться + анимации)
const STEPS = [
  {
    id: "01-opening",
    url: "/",
    delay: 4000,
    label: "Главная / Globus",
    scroll: 0,
    description: "Кликаем на несколько узлов Globus"
  },
  {
    id: "02-qright",
    url: "/qright",
    delay: 3000,
    label: "QRight — реестр IP",
    scroll: 300,
  },
  {
    id: "03-qsign",
    url: "/qsign",
    delay: 3000,
    label: "QSign — постквантовая подпись",
    scroll: 200,
  },
  {
    id: "04-bureau-payment",
    url: "/bureau",
    delay: 3500,
    label: "Bureau — выбор тарифа",
    scroll: 400,
  },
  {
    id: "05-bureau-cert",
    url: "/bureau",
    delay: 3500,
    label: "Bureau — Trust Graph",
    scroll: 800,
  },
  {
    id: "06-aec-reward",
    url: "/bank",
    delay: 3000,
    label: "Bank — AEC кошелёк",
    scroll: 300,
  },
  {
    id: "07-awards-planet",
    url: "/awards/music",
    delay: 3000,
    label: "Awards + Planet",
    scroll: 400,
  },
  {
    id: "08-bank",
    url: "/bank",
    delay: 3000,
    label: "Bank — Trust Score",
    scroll: 600,
  },
  {
    id: "09-closing",
    url: "/",
    delay: 2000,
    label: "Закрытие — Globus",
    scroll: 0,
  },
];

console.log(`\n🎬 AEVION Demo Screenshot Capture`);
console.log(`   BASE: ${BASE}`);
console.log(`   OUT:  ${OUT}\n`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});

const page = await context.newPage();

// Закрываем cookie-баннеры если есть
page.on("dialog", (d) => d.accept().catch(() => {}));

for (const step of STEPS) {
  const url = BASE + step.url;
  process.stdout.write(`  → ${step.id} (${step.label})... `);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(step.delay);

    if (step.scroll > 0) {
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: "smooth" }), step.scroll);
      await page.waitForTimeout(800);
    }

    // Закрываем всплывашки/банеры если есть
    const closeBtn = page.locator('[aria-label="close"], .modal-close, [data-dismiss="modal"]').first();
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    }

    const outPath = resolve(OUT, `${step.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`✓`);
  } catch (e) {
    console.log(`✗ (${e.message.slice(0, 60)})`);
    // Сохраняем пустой экран чтобы не ломать FFmpeg
    const outPath = resolve(OUT, `${step.id}.png`);
    await page.screenshot({ path: outPath, fullPage: false }).catch(() => {});
  }
}

await browser.close();

console.log(`\n✅ Скриншоты готовы в: ${OUT}`);
console.log(`   Следующий шаг: node scripts/demo-record/02-build-presentation.mjs\n`);
