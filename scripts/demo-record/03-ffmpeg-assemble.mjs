#!/usr/bin/env node
/**
 * AEVION Demo FFmpeg Assembler
 *
 * Собирает финальный MP4 из скриншотов + MP3.
 * Требует FFmpeg: https://ffmpeg.org/download.html
 * Windows: winget install ffmpeg
 *
 * Запуск:
 *   node scripts/demo-record/03-ffmpeg-assemble.mjs
 *
 * Выход:
 *   scripts/demo-record/AEVION_DEMO.mp4
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, statSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = resolve(__dir, "screenshots");
const AUDIO = resolve(__dir, "../../assets/demo/voiceover-ru");
const TEMP = resolve(__dir, "temp");
const OUT = resolve(__dir, "AEVION_DEMO.mp4");

// Проверяем FFmpeg
try {
  execSync("ffmpeg -version", { stdio: "pipe" });
} catch {
  console.error("❌ FFmpeg не найден. Установи:");
  console.error("   Windows: winget install ffmpeg");
  console.error("   Mac:     brew install ffmpeg");
  console.error("   Linux:   sudo apt install ffmpeg");
  process.exit(1);
}

const SECTIONS = [
  { id: "01-opening",       audio: "01-opening.mp3" },
  { id: "02-qright",        audio: "02-qright.mp3" },
  { id: "03-qsign",         audio: "03-qsign.mp3" },
  { id: "04-bureau-payment",audio: "04-bureau-pay.mp3" },
  { id: "05-bureau-cert",   audio: "05-bureau-after.mp3" },
  { id: "06-aec-reward",    audio: "06-aec-reward.mp3" },
  { id: "07-awards-planet", audio: "07-awards-planet.mp3" },
  { id: "08-bank",          audio: "08-bank.mp3" },
  { id: "09-closing",       audio: "09-closing.mp3" },
];

mkdirSync(TEMP, { recursive: true });
const segments = [];

console.log("\n🎬 Assembling AEVION Demo with FFmpeg\n");

for (const sec of SECTIONS) {
  const img = resolve(SCREENSHOTS, `${sec.id}.png`);
  const aud = resolve(AUDIO, sec.audio);

  if (!existsSync(img)) { console.warn(`  ⚠ Missing: ${sec.id}.png`); continue; }
  if (!existsSync(aud)) { console.warn(`  ⚠ Missing: ${sec.audio}`); continue; }

  const outSeg = resolve(TEMP, `${sec.id}.mp4`);
  process.stdout.write(`  → ${sec.id}... `);

  // Конвертируем PNG+MP3 в MP4 сегмент
  // -loop 1: показываем изображение в цикле
  // -i aud: накладываем аудио
  // -shortest: обрезаем по длине аудио
  // fade-in/out: плавное появление (0.3s)
  const r = spawnSync("ffmpeg", [
    "-y",
    "-loop", "1", "-i", img,
    "-i", aud,
    "-c:v", "libx264", "-tune", "stillimage",
    "-c:a", "aac", "-b:a", "192k",
    "-pix_fmt", "yuv420p",
    "-vf", `scale=1920:1080,fade=t=in:st=0:d=0.3,fade=t=out:st=$(ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${aud}")-0.3:d=0.3`,
    "-shortest",
    outSeg,
  ], { stdio: "pipe", encoding: "utf8" });

  if (r.status !== 0) {
    // Простой fallback без fade
    const r2 = spawnSync("ffmpeg", [
      "-y",
      "-loop", "1", "-i", img,
      "-i", aud,
      "-c:v", "libx264", "-tune", "stillimage",
      "-c:a", "aac", "-b:a", "192k",
      "-pix_fmt", "yuv420p",
      "-vf", "scale=1920:1080",
      "-shortest",
      outSeg,
    ], { stdio: "pipe" });
    if (r2.status !== 0) { console.log("✗ SKIP"); continue; }
  }

  segments.push(outSeg);
  console.log("✓");
}

if (segments.length === 0) {
  console.error("\n❌ Нет сегментов для сборки");
  process.exit(1);
}

// Создаём concat list
const concatFile = resolve(TEMP, "concat.txt");
writeFileSync(concatFile, segments.map(s => `file '${s.replace(/\\/g, "/")}'`).join("\n"));

console.log(`\n  Concatenating ${segments.length} segments...`);

const final = spawnSync("ffmpeg", [
  "-y",
  "-f", "concat", "-safe", "0",
  "-i", concatFile,
  "-c", "copy",
  OUT,
], { stdio: "inherit" });

if (final.status === 0) {
  const size = Math.round(statSync(OUT).size / 1024 / 1024 * 10) / 10;
  console.log(`\n✅ Готово: ${OUT} (${size} MB)`);
  console.log(`\n📤 Загрузи на YouTube (unlisted) и добавь ссылку в:`);
  console.log(`   - docs/AEVION_DEMO_SCRIPT.md`);
  console.log(`   - docs/press/PRESS_RELEASE.md`);
  console.log(`   - docs/press/EMAIL_REFERENCE_CUSTOMER.md`);
} else {
  console.error("\n❌ FFmpeg concat failed");
}

// Cleanup temp
try { rmSync(TEMP, { recursive: true }); } catch {}
