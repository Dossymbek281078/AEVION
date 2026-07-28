import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DRAWING_TOPICS, drawingTopicMetadata } from "../smeta-trainer/data/drawingsTopics";

/**
 * 28.07.2026 Search Console показал: 662 страницы aevion.app не в индексе против
 * 428 в индексе. Крупнейший кусок — 305 страниц практикума по чертежам, которые
 * отдавали ОДИН И ТОТ ЖЕ <title> «Сметный тренажёр — AEVION» и одно описание,
 * потому что метаданные приходили из общего layout. Тексты у страниц разные
 * (пересечение слов между двумя соседними — 14%), но первые два сигнала, которые
 * читает поисковик, были идентичны у всех трёхсот.
 *
 * Теперь у каждой страницы свой layout с заголовком из реестра. Этот тест держит
 * связку: реестр в hub — единственный источник, а страница без своего layout
 * молча вернётся к общему заголовку и снова сольётся с остальными.
 */

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRACTICE_DIR = join(APP_DIR, "smeta-trainer", "drawings-practice");
const HUB = join(PRACTICE_DIR, "hub", "page.tsx");

/** id тем, как они перечислены в реестре MODULES внутри хаба. */
function hubIds(): string[] {
  const src = readFileSync(HUB, "utf8");
  const start = src.indexOf("const MODULES: Module[] = [");
  const end = src.indexOf("\n];", start);
  const body = src.slice(start, end);
  return Array.from(body.matchAll(/\{\s*id:\s*"([a-z0-9-]+)"/g)).map((m) => m[1]);
}

/** Папки практикума, у которых есть своя страница. */
function practiceFolders(): string[] {
  return readdirSync(PRACTICE_DIR).filter(
    (entry) =>
      entry !== "hub" &&
      statSync(join(PRACTICE_DIR, entry)).isDirectory() &&
      existsSync(join(PRACTICE_DIR, entry, "page.tsx")),
  );
}

const HUB_IDS = hubIds();
const FOLDERS = practiceFolders();

describe("практикум по чертежам — у каждой страницы свой заголовок", () => {
  it("реестр тем не разошёлся с хабом", () => {
    expect(DRAWING_TOPICS.map((t) => t.id).sort()).toEqual([...HUB_IDS].sort());
  });

  it("сканируется настоящий набор страниц, а не пустой список", () => {
    expect(FOLDERS.length).toBeGreaterThan(250);
  });

  it("у каждой страницы есть свой layout с метаданными", () => {
    const missing = FOLDERS.filter((f) => !existsSync(join(PRACTICE_DIR, f, "layout.tsx")));
    expect(missing).toEqual([]);
  });

  it("layout ссылается на свою же папку, а не на соседнюю", () => {
    const wrong = FOLDERS.filter((folder) => {
      const src = readFileSync(join(PRACTICE_DIR, folder, "layout.tsx"), "utf8");
      return !src.includes(`drawingTopicMetadata("${folder}")`);
    });
    expect(wrong).toEqual([]);
  });

  it("заголовки уникальны — иначе смысла в правке нет", () => {
    const titles = FOLDERS.map((f) => drawingTopicMetadata(f).title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("неизвестный id даёт общий заголовок без описания (негативный тест)", () => {
    const fallback = drawingTopicMetadata("no-such-topic-28072026");
    expect(fallback.title).toBe("Практикум по чертежам — сметный тренажёр AEVION");
    expect("description" in fallback).toBe(false);
  });
});
