// Бейдж «Сделано в AEVION» — петля роста: каждый показ опубликованного сайта должен
// приводить людей. 28.09.2026 замер дал 0 пользователей DevHub при рабочей публикации.
import { describe, it, expect } from "vitest";
import { вставитьБейдж, нуженБейдж, разметкаБейджа, МЕТКА_БЕЙДЖА } from "../src/lib/aevionBadge";

const стр = (s: string[]) => s.join("");
const HTML_RU = стр(["<!DOCTYPE html><html lang=\"ru\"><head><title>Таймер</title></head>",
  "<body><h1>Таймер обратного отсчёта</h1><p>Нажмите старт, чтобы начать отсчёт времени</p></body></html>"]);
const HTML_EN = стр(["<!DOCTYPE html><html lang=\"en\"><head><title>Timer</title></head>",
  "<body><h1>Countdown timer</h1></body></html>"]);

describe("бейдж на опубликованном сайте", () => {
  it("ставится бесплатным и НЕ ставится платным", () => {
    expect(нуженБейдж("free")).toBe(true);
    expect(нуженБейдж(null)).toBe(true);
    expect(нуженБейдж(undefined)).toBe(true);
    expect(нуженБейдж("pro")).toBe(false);
    expect(нуженБейдж("PRO")).toBe(false);
    expect(нуженБейдж("enterprise")).toBe(false);
  });

  it("ссылка несёт метку канала — иначе переход уйдёт в «unattributed»", () => {
    expect(разметкаБейджа(HTML_EN)).toContain("/devhub?c=" + МЕТКА_БЕЙДЖА);
    expect(МЕТКА_БЕЙДЖА).toBe("badge");
  });

  it("вставляется ПЕРЕД </body>, разметка остаётся целой", () => {
    const out = вставитьБейдж(HTML_RU);
    expect(out.indexOf("data-aevion-badge")).toBeLessThan(out.toLowerCase().lastIndexOf("</body>"));
    expect(out).toContain("<h1>Таймер обратного отсчёта</h1>");
    expect(out.endsWith("</html>")).toBe(true);
  });

  it("повторная публикация НЕ плодит второй бейдж", () => {
    const один = вставитьБейдж(HTML_RU);
    const два = вставитьБейдж(один);
    expect(два).toBe(один);
    expect((два.match(/data-aevion-badge/g) || []).length).toBe(1);
  });

  it("язык подписи берётся у страницы", () => {
    expect(вставитьБейдж(HTML_RU)).toContain("Сделано в AEVION");
    expect(вставитьБейдж(HTML_EN)).toContain("Built with AEVION");
  });

  it("без </body> бейдж всё равно попадает на страницу", () => {
    const out = вставитьБейдж("<h1>hi</h1>");
    expect(out).toContain("data-aevion-badge");
    expect(out.startsWith("<h1>hi</h1>")).toBe(true);
  });

  it("ни скриптов, ни cookie, ни слежки за посетителем чужого сайта", () => {
    const out = вставитьБейдж(HTML_EN);
    for (const запрет of ["<script", "cookie", "fetch(", "onload", "localStorage"]) {
      expect(out.toLowerCase().includes(запрет.toLowerCase()), запрет).toBe(false);
    }
  });
});
