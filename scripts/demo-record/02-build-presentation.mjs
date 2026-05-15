#!/usr/bin/env node
/**
 * AEVION Demo Presentation Builder
 *
 * Собирает HTML-презентацию из скриншотов + MP3 файлов.
 * Открой в Chrome → нажми F → старт автоматический.
 * Запиши экран через OBS/Loom/Windows Game Bar (Win+G).
 *
 * Запуск:
 *   node scripts/demo-record/02-build-presentation.mjs
 *
 * Выход:
 *   scripts/demo-record/demo-presentation.html
 */

import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS = resolve(__dir, "screenshots");
const AUDIO = resolve(__dir, "../../assets/demo/voiceover-ru");
const OUT = resolve(__dir, "demo-presentation.html");

// Секции демо
const SECTIONS = [
  {
    id: "01-opening",
    audio: "01-opening.mp3",
    title: "Добро пожаловать в AEVION",
    subtitle: "Операционная система доверия для цифровых авторов",
  },
  {
    id: "02-qright",
    audio: "02-qright.mp3",
    title: "QRight — реестр IP",
    subtitle: "SHA-256 + временная метка за 3 секунды",
  },
  {
    id: "03-qsign",
    audio: "03-qsign.mp3",
    title: "QSign — постквантовая подпись",
    subtitle: "ML-DSA-65 · NIST FIPS 204 · защита до 2035+",
  },
  {
    id: "04-bureau-payment",
    audio: "04-bureau-pay.mp3",
    title: "Bureau — оплата сертификата",
    subtitle: "Stripe → Bureau cert · Verified / Notarized / Gold",
  },
  {
    id: "05-bureau-cert",
    audio: "05-bureau-after.mp3",
    title: "Bureau — Trust Graph",
    subtitle: "Каждый cert добавляет ребро в граф доверия",
  },
  {
    id: "06-aec-reward",
    audio: "06-aec-reward.mp3",
    title: "AEC — автоматические роялти",
    subtitle: "Bronze 50 · Silver 150 · Gold 500 · Platinum 1000 AEC",
  },
  {
    id: "07-awards-planet",
    audio: "07-awards-planet.mp3",
    title: "Awards + Planet Compliance",
    subtitle: "Та же compliance-логика в культурной витрине",
  },
  {
    id: "08-bank",
    audio: "08-bank.mp3",
    title: "AEVION Bank",
    subtitle: "AEC кошелёк · Trust Score · роялти-история",
  },
  {
    id: "09-closing",
    audio: "09-closing.mp3",
    title: "Попробуйте прямо сейчас",
    subtitle: "aevion.app · Первые 10 reference customers — бесплатно",
  },
];

// Конвертируем файлы в base64 для self-contained HTML
function toBase64(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path).toString("base64");
}

// Получаем приблизительную длину MP3 из размера файла (CBR 128kbps)
function estimateDuration(path) {
  if (!existsSync(path)) return 10;
  const size = statSync(path).size;
  return Math.ceil(size * 8 / 128000) + 1; // +1 сек буфер
}

console.log("\n🎬 Building AEVION Demo Presentation...\n");

const slides = SECTIONS.map((sec) => {
  const imgPath = resolve(SCREENSHOTS, `${sec.id}.png`);
  const audioPath = resolve(AUDIO, sec.audio);

  const imgB64 = toBase64(imgPath);
  const audioB64 = toBase64(audioPath);
  const duration = estimateDuration(audioPath);

  if (!imgB64) console.warn(`  ⚠ Screenshot missing: ${sec.id}.png`);
  if (!audioB64) console.warn(`  ⚠ Audio missing: ${sec.audio}`);
  else console.log(`  ✓ ${sec.id} (${duration}s)`);

  return { ...sec, imgB64, audioB64, duration };
});

const totalDuration = slides.reduce((s, sl) => s + sl.duration, 0);
console.log(`\n  Total duration: ~${Math.round(totalDuration)}s (~${Math.round(totalDuration/60)}min)`);

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=1920">
<title>AEVION Demo</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0f172a;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    width: 1920px; height: 1080px;
    overflow: hidden;
    color: white;
  }
  #slide {
    position: relative;
    width: 1920px; height: 1080px;
  }
  #screenshot {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    transition: opacity 0.5s ease;
  }
  #overlay {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    padding: 32px 48px;
    background: linear-gradient(transparent, rgba(0,0,0,0.85));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  #title {
    font-size: 36px;
    font-weight: 800;
    color: #f8fafc;
    text-shadow: 0 2px 8px rgba(0,0,0,0.8);
  }
  #subtitle {
    font-size: 20px;
    color: #94a3b8;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }
  #progress-bar {
    position: absolute;
    bottom: 0; left: 0;
    height: 4px;
    background: #10b981;
    transition: width 0.1s linear;
    z-index: 10;
  }
  #counter {
    position: absolute;
    top: 20px; right: 24px;
    font-size: 14px;
    color: rgba(255,255,255,0.5);
    font-mono: monospace;
  }
  #start-screen {
    position: fixed; inset: 0;
    background: #0f172a;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    z-index: 100;
  }
  #start-screen h1 {
    font-size: 64px;
    font-weight: 900;
    background: linear-gradient(135deg, #10b981, #3b82f6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  #start-screen p { font-size: 20px; color: #64748b; }
  #start-btn {
    margin-top: 24px;
    padding: 20px 60px;
    font-size: 24px;
    font-weight: 700;
    background: #10b981;
    color: #022c22;
    border: none;
    border-radius: 16px;
    cursor: pointer;
    transition: transform 0.1s;
  }
  #start-btn:hover { transform: scale(1.05); }
  #end-screen {
    position: fixed; inset: 0;
    background: linear-gradient(135deg, #0f172a, #1e1b4b);
    display: none;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 24px;
    z-index: 100;
  }
  #end-screen h1 {
    font-size: 72px;
    font-weight: 900;
    color: #10b981;
  }
  #end-screen p { font-size: 28px; color: #94a3b8; }
  #end-screen a {
    font-size: 32px;
    color: #10b981;
    text-decoration: none;
    border-bottom: 2px solid #10b981;
  }
</style>
</head>
<body>

<div id="start-screen">
  <h1>AEVION</h1>
  <p>Операционная система доверия · ~${Math.round(totalDuration/60)} минут</p>
  <button id="start-btn" onclick="startDemo()">▶ Начать демо</button>
  <p style="font-size:14px;color:#334155;margin-top:8px">
    Начни запись экрана → нажми кнопку
  </p>
</div>

<div id="slide">
  <img id="screenshot" src="" alt="">
  <div id="progress-bar" style="width:0%"></div>
  <div id="counter">1 / ${slides.length}</div>
  <div id="overlay">
    <div id="title"></div>
    <div id="subtitle"></div>
  </div>
</div>

<div id="end-screen">
  <h1>aevion.app</h1>
  <p>Первые 10 reference customers — бесплатно</p>
  <a href="https://aevion.app" target="_blank">→ Попробовать прямо сейчас</a>
</div>

<audio id="audio" preload="auto"></audio>

<script>
const SLIDES = ${JSON.stringify(slides.map(s => ({
  title: s.title,
  subtitle: s.subtitle,
  duration: s.duration,
  img: s.imgB64 ? `data:image/png;base64,${s.imgB64}` : "",
  audio: s.audioB64 ? `data:audio/mpeg;base64,${s.audioB64}` : "",
})))};

let current = 0;
let progressInterval = null;
let elapsed = 0;

function showSlide(idx) {
  const s = SLIDES[idx];
  const img = document.getElementById("screenshot");
  const title = document.getElementById("title");
  const subtitle = document.getElementById("subtitle");
  const audio = document.getElementById("audio");
  const counter = document.getElementById("counter");
  const progress = document.getElementById("progress-bar");

  img.style.opacity = "0";
  setTimeout(() => {
    img.src = s.img;
    img.style.opacity = "1";
  }, 200);

  title.textContent = s.title;
  subtitle.textContent = s.subtitle;
  counter.textContent = (idx + 1) + " / " + SLIDES.length;

  // Audio
  audio.src = s.audio;
  audio.play().catch(() => {});

  // Progress bar
  clearInterval(progressInterval);
  elapsed = 0;
  progress.style.width = "0%";
  const totalMs = s.duration * 1000;
  progressInterval = setInterval(() => {
    elapsed += 100;
    progress.style.width = Math.min(100, (elapsed / totalMs * 100)) + "%";
  }, 100);

  // Auto-advance when audio ends
  audio.onended = () => {
    clearInterval(progressInterval);
    progress.style.width = "100%";
    setTimeout(() => {
      if (idx + 1 < SLIDES.length) {
        current = idx + 1;
        showSlide(current);
      } else {
        document.getElementById("end-screen").style.display = "flex";
      }
    }, 800);
  };
}

function startDemo() {
  document.getElementById("start-screen").style.display = "none";
  showSlide(0);
}

// Keyboard navigation (space = next, left/right = nav)
document.addEventListener("keydown", (e) => {
  if (e.key === " " || e.key === "ArrowRight") {
    if (current + 1 < SLIDES.length) { current++; showSlide(current); }
  } else if (e.key === "ArrowLeft") {
    if (current > 0) { current--; showSlide(current); }
  }
});
</script>
</body>
</html>`;

writeFileSync(OUT, html, "utf8");

console.log(`\n✅ Презентация готова: ${OUT}`);
console.log(`\n📋 Инструкция по записи:`);
console.log(`   1. Открой файл в Chrome (двойной клик)`);
console.log(`   2. Нажми F11 (полный экран)`);
console.log(`   3. Запусти запись экрана:`);
console.log(`      • Windows: Win+G → Record`);
console.log(`      • Mac: Cmd+Shift+5`);
console.log(`      • OBS: Start Recording`);
console.log(`   4. Нажми кнопку "▶ Начать демо"`);
console.log(`   5. Презентация автоматически переходит по слайдам`);
console.log(`   6. В конце — останови запись`);
console.log(`\n⚡ Альтернатива (если есть FFmpeg):`);
console.log(`   node scripts/demo-record/03-ffmpeg-assemble.mjs`);
console.log(``);
