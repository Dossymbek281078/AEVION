import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 08.09.2026. Голосовой коуч (cyberchessVoiceCoach.ts) зовёт Anthropic (/ask,
 * /comment) и ДОРОГОЙ ElevenLabs TTS (/tts, /broadcast). До этой правки он
 * ограничивал расход ТОЛЬКО по clientIp — а на Railway clientIp схлопывается в
 * ~7 внутренних адресов («ИТОГ ЗАМЕРА 28.08» в lib/rateLimit.ts: «считать
 * посетителя по адресу НЕЧЕМ»). То есть настоящего платформенного потолка
 * расхода у него НЕ было, в отличие от текстового коуча (anonCoachCeiling в
 * coach.ts) — тот же класс, что сосед уже закрыл, здесь не был перенесён
 * (§detector_blind_zone, §the_wall_guards_doors). На бесплатном публичном
 * запуске это money-burn.
 *
 * Сторож держит платформенный потолок на месте: снять его — молчаливая потеря
 * денег, которую не видно ни в одном прогоне продукта. Сорс-уровень (как
 * economyIsHonest на фронте) — быстрый и устойчивый к падению воркеров.
 */

const SRC = path.join(__dirname, "..", "src", "routes", "cyberchessVoiceCoach.ts");
const src = () => fs.readFileSync(SRC, "utf-8");

describe("голосовой коуч: платформенный потолок расхода на анонимов", () => {
  it("импортирует rateLimit и isAnonymousRequest (механизм потолка)", () => {
    const s = src();
    expect(s).toMatch(/import\s*\{[^}]*\brateLimit\b[^}]*\}\s*from\s*['"]\.\.\/lib\/rateLimit['"]/);
    expect(s).toMatch(/isAnonymousRequest/);
  });

  it("определяет ОБЩИЙ потолок анонимов (anon-корзина), а не только по clientIp", () => {
    const s = src().replace(/\s+/g, " ");
    // Ключ анонима сводится к одной общей корзине "anon" — иначе clientIp
    // схлопывается и потолка нет.
    expect(s).toMatch(/isAnonymousRequest\(req\)\s*\?\s*["']anon["']/);
    expect(s).toMatch(/rateLimit\(\{/);
  });

  it("потолок применён ко ВСЕМ четырём платным ручкам (/ask,/comment,/tts,/broadcast)", () => {
    const s = src().replace(/\s+/g, " ");
    for (const route of ["/comment", "/ask", "/tts", "/broadcast"]) {
      // router.post('<route>', <ceiling middleware>, async ...) — между путём и
      // async-обработчиком обязан стоять middleware-потолок (Ceiling).
      const re = new RegExp(`router\\.post\\(\\s*['"]${route}['"]\\s*,\\s*anonVoice[A-Za-z]*Ceiling`);
      expect(s, `на ${route} нет платформенного потолка`).toMatch(re);
    }
  });
});
