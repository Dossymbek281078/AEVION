import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Обучающее видео посадочной: файл обязан быть ВЕБ-копией, а не мастером.
 *
 * Замер 07.09.2026, который и породил сторожа: генеративный сервис отдал
 * ссылку на мастер — 202 563 318 байт (193 МиБ), 2560x1440, 13.3 Мбит/с на
 * 120 секунд. Ссылка живая, кадры красивые, размер даже назван в
 * сопроводительной записке — и всё равно на посадочной это значит, что
 * человек с телефона качает 193 МБ своим трафиком. `preload="none"`
 * откладывает беду до клика, но не отменяет её.
 *
 * Непригодность такого файла НЕ ПАДАЕТ: страница собирается, тесты зелёные,
 * видео проигрывается у того, кто мерил на кабеле. Поэтому граница записана
 * числом здесь.
 *
 * Потолок 25 МБ выбран с запасом к нынешним 14.3 МБ (720p, CRF 28 с
 * подавлением зерна): место для пересжатия в лучшем качестве есть, а мастер
 * или любой его недосжатый потомок в него не влезает.
 */
const PUBLIC = path.join(__dirname, "..", "..", "..", "..", "public", "devhub");
const VIDEO = path.join(PUBLIC, "howto-ru.mp4");
const POSTER = path.join(PUBLIC, "howto-poster.jpg");
const MAX_VIDEO = 25 * 1024 * 1024;
const MAX_POSTER = 400 * 1024;

describe("обучающее видео пригодно для веба", () => {
  test("файл видео на месте — иначе секция показывает отказ вместо ролика", () => {
    expect(fs.existsSync(VIDEO), `нет ${VIDEO}`).toBe(true);
  });

  test("видео не тяжелее 25 МБ (мастер сюда не влезает по устройству)", () => {
    const mb = fs.statSync(VIDEO).size / 1048576;
    expect(
      fs.statSync(VIDEO).size,
      `видео весит ${mb.toFixed(1)} МБ — это мастер, а не веб-копия; пересжать ffmpeg (720p, crf 28, hqdn3d)`,
    ).toBeLessThanOrEqual(MAX_VIDEO);
  });

  test("постер на месте и лёгкий — он грузится ВСЕГДА, в отличие от видео", () => {
    expect(fs.existsSync(POSTER), `нет ${POSTER}`).toBe(true);
    expect(fs.statSync(POSTER).size).toBeLessThanOrEqual(MAX_POSTER);
  });

  test("страница ссылается ровно на эти файлы (иначе сторож стережёт не то)", () => {
    const page = fs.readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8");
    expect(page, "путь видео на странице разошёлся со сторожем").toContain('src="/devhub/howto-ru.mp4"');
    expect(page, "путь постера на странице разошёлся со сторожем").toContain('poster="/devhub/howto-poster.jpg"');
  });
});
