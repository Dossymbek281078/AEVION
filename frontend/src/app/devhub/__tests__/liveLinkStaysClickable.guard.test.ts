/**
 * После «Выкатить» живой адрес кликается и не исчезает.
 *
 * ПОВОД (20.10.2026, путь гостя на проде 1463×724, прибор
 * ПРИЛОЖЕНИЯ/devhub-2026-10-20-put-Prilozheniya/put-gostya-devhub.mjs): сайт
 * собрался за 15 с, выкатился за 20 с — а адрес человек получил только тостом,
 * простым текстом (ссылок на pages.dev на странице 0 за 200 с), и тост гас
 * через 4 с. Ссылка с «Открыть» жила во вкладке «Выкатки», куда переключала
 * лишь кнопка-подсказка в чате, но не верхняя «Выкатить».
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "../[id]/page.tsx"), "utf8");

describe("DevHub: живой адрес после выкатки", () => {
  it("тост рисует адреса ссылками, а не текстом", () => {
    const toast = SRC.slice(SRC.indexOf("function Toast("), SRC.indexOf("function Toast(") + 1500);
    expect(toast).toContain("{withLinks(message)}");
    const wl = SRC.slice(SRC.indexOf("function withLinks("), SRC.indexOf("function Toast("));
    expect(wl).toMatch(/<a [^>]*href=\{url\}[^>]*target="_blank"/);
    // точка в конце фразы адресу не принадлежит — иначе ссылка ведёт на «…pages.dev.»
    expect(wl).toContain(".replace(/[.,;:!?)]+$/");
  });

  it("успешная выкатка Pages открывает вкладку «Выкатки»", () => {
    const i = SRC.indexOf("setPagesResult({ liveUrl: d.liveUrl");
    expect(i, "ветка успеха выкатки не найдена — сторож проверял бы пустоту").toBeGreaterThan(0);
    const j = SRC.indexOf("showToast(", i);
    expect(SRC.slice(i, j)).toContain('setActiveTab("deployments")');
  });

  it("после выкатки Pages страница опрашивает проект до live, а не перечитывает один раз", () => {
    const i = SRC.indexOf("setPagesResult({ liveUrl: d.liveUrl");
    const j = SRC.indexOf("Публикация на Cloudflare Pages не удалась", i);
    const ветка = SRC.slice(i, j);
    expect(ветка).toContain("const pollPages = async");
    expect(ветка).toMatch(/st === "live" \|\| st === "error" \|\| pagesTries >= 36/);
    expect(ветка).toContain("setTimeout(pollPages, 5000)");
  });

  it("тост с адресом живёт дольше 4 с", () => {
    const d = SRC.slice(SRC.indexOf("const drainToasts"), SRC.indexOf("const drainToasts") + 3000);
    expect(d).toMatch(/https\?:.*\n.*setTimeout\(drainToasts, сАдресом \? 20000/);
  });
});
