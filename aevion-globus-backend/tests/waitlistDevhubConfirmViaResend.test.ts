import { describe, it, expect, vi, beforeEach } from "vitest";

/*
 * 30.10.2026: подтверждение раннего доступа DevHub шло через Brevo (трекер sendibt3.com, спам в Gmail),
 * а «Ваш сайт в AEVION DevHub» через Resend — и счётчик healthz письма Resend из provisioning не считал.
 * Теперь DevHub-подтверждение идёт через provisioning.sendEmail (Resend), Brevo не вызывается.
 * Учёт в healthz делает сам sendEmail (c3e154c41, тест provisioningSendCountsInEmailHealth) —
 * здесь проверяется, что waitlist идёт именно через него.
 */
const { резенд, бревo } = vi.hoisted(() => ({
  резенд: [] as Array<{ to: string; subject: string; html: string; text: string }>,
  бревo: [] as unknown[],
}));

beforeEach(() => {
  резенд.length = 0; бревo.length = 0;
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.BREVO_API_KEY = "brevo_test_key";
  vi.resetModules();
});

function подменитьСеть() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
    if (String(url).includes("api.resend.com")) {
      const b = JSON.parse(init.body);
      резенд.push(b);
      return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
    }
    if (String(url).includes("api.brevo.com")) {
      бревo.push(init.body);
      return new Response(JSON.stringify({ messageId: "<b1>" }), { status: 201 });
    }
    throw new Error("неожиданный URL " + url);
  }));
}

describe("waitlist DevHub: Resend, не Brevo, и счётчик healthz", () => {
  it("source=devhub: письмо через Resend (text+html), Brevo не вызван", async () => {
    подменитьСеть();
        const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    const ok = await sendWaitlistConfirm("probe-produkt+x@mailprobe.dev", "devhub");
    expect(ok).toBe(true);
    expect(бревo).toHaveLength(0);
    expect(резенд).toHaveLength(1);
    expect(резенд[0].to).toBe("probe-produkt+x@mailprobe.dev");
    expect(резенд[0].subject).toContain("DevHub Studio");
    expect(резенд[0].html.length).toBeGreaterThan(0);
    expect(резенд[0].text).toContain("Отписаться");
    expect(резенд[0].html + резенд[0].text).not.toContain("sendibt");
  });

  it("не-DevHub источник по-прежнему идёт через Brevo", async () => {
    подменитьСеть();
        const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    expect(await sendWaitlistConfirm("probe-produkt+y@mailprobe.dev", "go")).toBe(true);
    expect(резенд).toHaveLength(0);
    expect(бревo).toHaveLength(1);
  });

  it("Resend отказал — запас Brevo, письмо не теряется", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string }) => {
      if (String(url).includes("api.resend.com")) return new Response(JSON.stringify({ message: "no" }), { status: 422 });
      бревo.push(init.body);
      return new Response(JSON.stringify({ messageId: "<b2>" }), { status: 201 });
    }));
    const { sendWaitlistConfirm } = await import("../src/lib/constitutionBrevo");
    expect(await sendWaitlistConfirm("probe-produkt+z@mailprobe.dev", "devhub")).toBe(true);
    expect(бревo).toHaveLength(1);
  });
});
