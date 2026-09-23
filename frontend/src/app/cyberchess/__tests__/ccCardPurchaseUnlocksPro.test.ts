// Купил CyberChess картой (Lemon Squeezy → AppSubscription) — получил Pro на странице.
// До 22.09.2026 isPro знал только AEV-лестницу магазина (chessy.owned.pro/ultimate): заплативший
// картой оставался с 4 уровнями ИИ и платными подсказками, как гость. Источник правды —
// GET /api/apps/access/check?app=cyberchess (Bearer) → { active } (тот же, что у /account).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");

describe("покупка картой включает Pro", () => {
  it("страница спрашивает права приложения у бэкенда с токеном", () => {
    expect(page).toContain('fetch("/api-backend/api/apps/access/check?app=cyberchess",{headers:{Authorization:`Bearer ${t}`}})');
  });
  it("isPro учитывает покупку картой", () => {
    expect(page).toContain('const isPro=!!chessy.owned.pro||!!chessy.owned.ultimate||platformApp==="active";');
  });
  it("три состояния: отказ сервера — «unknown», а не «не куплено»", () => {
    expect(page).toContain('if(!r.ok){if(!cancelled)sPlatformApp("unknown");return;}');
    expect(page).toContain('sPlatformApp(d?.active===true?"active":"none")');
    expect(page).toContain('}catch{if(!cancelled)sPlatformApp("unknown")}');
  });
  it("в магазине купившему картой показан статус вместо кнопки «Купить»", () => {
    expect(page).toContain('{platformApp==="active"');
    expect(page).toContain('data-cc-buy="shop-active"');
  });
  it("контроль: гость без токена — «none», ничего не спрашиваем", () => {
    expect(page).toContain('if(!t){if(!cancelled)sPlatformApp("none");return;}');
  });
});
