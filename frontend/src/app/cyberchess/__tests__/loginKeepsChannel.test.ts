import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ссылкаВхода } from "@/app/auth/loginHref";
import { адресВозврата } from "@/app/auth/returnTo";

/**
 * 2.11.2026 (прод 5c84234b1): «Войти» на /cyberchess вело на голый `/auth?next=/cyberchess`, и
 * метка ?c=probe-apps терялась (на /bureau — `/auth?next=%2Fbureau%3Fc%3Dprobe-apps&c=probe-apps`).
 * Теперь все три «Войти» страницы и ссылка панели глубокого анализа идут через useСсылкаВхода.
 */
const читать = (p: string) => readFileSync(join(process.cwd(), "src/app/cyberchess", p), "utf8");

describe("CyberChess: «Войти» не теряет метку канала", () => {
  it("ссылкаВхода для /cyberchess: метка в /auth и в возврате", () => {
    const href = ссылкаВхода("/cyberchess", null, "probe-apps");
    expect(href).toBe("/auth?next=%2Fcyberchess%3Fc%3Dprobe-apps&c=probe-apps");
    expect(адресВозврата(href.slice(href.indexOf("?")))).toBe("/cyberchess?c=probe-apps");
  });
  it("в page.tsx и DeepAnalysisPanel.tsx нет голого /auth?next=/cyberchess", () => {
    for (const f of ["page.tsx", "DeepAnalysisPanel.tsx"]) {
      const src = читать(f);
      expect(src, f).not.toContain("/auth?next=/cyberchess");
      expect(src, f).toContain('useСсылкаВхода("/cyberchess")');
    }
    expect((читать("page.tsx").match(/ccLoginHref/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
