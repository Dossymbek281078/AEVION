import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { VERIFIED_CONTACT_HREF, verifiedCta, verifiedContactLabel } from "../verifiedCta";

/**
 * 20.10.2026, окно «Приложения», по слову оркестратора. На проде kyc=stub, страница апгрейда
 * честно говорит «не может быть завершён», а реестр /bureau и /bureau/cert звали «Upgrade to
 * Verified» на каждом сертификате — тупик, повторённый N раз. Сторож держит оба режима:
 * при заглушке — обращение, при живом поставщике — апгрейд; незнание (null) не прячет.
 */
const BUREAU = readFileSync(join(__dirname, "..", "page.tsx"), "utf8");
const CERT = readFileSync(join(__dirname, "..", "cert", "[certId]", "page.tsx"), "utf8");

describe("кнопка Verified следует режиму проверки личности", () => {
  test("stub и misconfigured → обращение; live и неизвестно → апгрейд", () => {
    expect(verifiedCta("stub", "cert-1")).toEqual({ kind: "contact", href: VERIFIED_CONTACT_HREF });
    expect(verifiedCta("misconfigured", "cert-1").kind).toBe("contact");
    expect(verifiedCta("live", "cert-1")).toEqual({ kind: "upgrade", href: "/bureau/upgrade/cert-1" });
    expect(verifiedCta(null, "cert-1").kind).toBe("upgrade");
    expect(verifiedCta(undefined, "cert-1").kind).toBe("upgrade");
    expect(verifiedCta("live", "a b").href).toBe("/bureau/upgrade/a%20b");
    expect(VERIFIED_CONTACT_HREF).toBe("/pricing/contact?topic=bureau");
  });

  test("подпись обращения на языке страницы, en — запасной", () => {
    expect(verifiedContactLabel("ru")).toContain("напишите нам");
    expect(verifiedContactLabel("kk")).toContain("жазыңыз");
    expect(verifiedContactLabel("de")).toBe("Verified — ask us");
  });

  test("реестр /bureau: обе ветви через verifiedCta(kycMode, …), прямой href на апгрейд не остался", () => {
    expect(BUREAU).toContain('verifiedCta(kycMode, cert.id).kind === "contact"');
    expect(BUREAU).toContain('verifiedCta(kycMode, cert.id).kind === "upgrade"');
    expect(BUREAU).toContain('data-verified-cta="contact"');
    expect(BUREAU).not.toContain("href={`/bureau/upgrade/${cert.id}`}");
  });

  test("/bureau/cert: режим читается с /api/bureau/health на сервере, обе ветви через cta", () => {
    expect(CERT).toContain("/api/bureau/health");
    expect(CERT).toContain("const cta = verifiedCta(kycMode, certId);");
    expect(CERT).toContain('cta.kind === "contact"');
    expect(CERT).toContain('cta.kind === "upgrade"');
    expect(CERT).not.toContain("href={`/bureau/upgrade/${certId}`}");
  });
});
