import { describe, it, expect } from "vitest";
import { planFromMessage, extractAmountCents, extractEmail, TOOLS } from "./planner";

describe("planner — intent routing", () => {
  it("routes image requests to the image tool", () => {
    const p = planFromMessage("нарисуй кота в скафандре");
    expect(p.mode).toBe("action");
    expect(p.toolId).toBe("image");
    expect(p.params?.prompt).toContain("кота");
    expect(p.missing).toEqual([]);
  });

  it("routes english image requests too", () => {
    expect(planFromMessage("generate an image of a sunset").toolId).toBe("image");
  });

  it("routes text-to-speech requests", () => {
    const p = planFromMessage("озвучь этот текст");
    expect(p.toolId).toBe("tts");
    expect(p.params?.text).toBe("озвучь этот текст");
  });

  it("routes payment requests and extracts the amount", () => {
    const p = planFromMessage("выставь счёт на $25");
    expect(p.toolId).toBe("payment-link");
    expect(p.params?.amountCents).toBe(2500);
    expect(p.missing).toEqual([]);
  });

  it("routes email and flags a missing recipient", () => {
    const p = planFromMessage("отправь письмо другу");
    expect(p.toolId).toBe("email");
    expect(p.missing).toContain("to");
  });

  it("fills the recipient when an address is present", () => {
    const p = planFromMessage("отправь письмо на bob@example.com — привет");
    expect(p.toolId).toBe("email");
    expect(p.params?.to).toBe("bob@example.com");
    expect(p.missing).toEqual([]);
  });

  it("falls back to chat when no action intent is present", () => {
    const p = planFromMessage("объясни как работает RSA");
    expect(p.mode).toBe("chat");
    expect(p.toolId).toBeNull();
  });

  it("treats an empty message as chat", () => {
    const p = planFromMessage("   ");
    expect(p.mode).toBe("chat");
    expect(p.params).toBeNull();
  });

  it("respects tool priority — payment beats image when both match", () => {
    // "выставь счёт" (payment) + "картинку" (image); payment is higher priority.
    const p = planFromMessage("нарисуй картинку и выставь счёт на 30 долларов");
    expect(p.toolId).toBe("payment-link");
    expect(p.params?.amountCents).toBe(3000);
  });
});

describe("planner — extractors", () => {
  it("parses money amounts to cents", () => {
    expect(extractAmountCents("$12.50")).toBe(1250);
    expect(extractAmountCents("10 долларов")).toBe(1000);
    expect(extractAmountCents("5 usd")).toBe(500);
    expect(extractAmountCents("no money here")).toBeNull();
  });

  it("finds an email address", () => {
    expect(extractEmail("write to a.b+x@mail.co now")).toBe("a.b+x@mail.co");
    expect(extractEmail("no address")).toBe("");
  });
});

describe("planner — registry integrity", () => {
  it("every tool points at an existing DevHub/QCoreAI endpoint path", () => {
    for (const t of TOOLS) {
      expect(t.endpoint.startsWith("/api/")).toBe(true);
      expect(t.patterns.length).toBeGreaterThan(0);
      expect(typeof t.buildBody).toBe("function");
    }
  });
});
