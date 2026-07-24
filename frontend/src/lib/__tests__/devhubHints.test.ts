import { describe, it, expect } from "vitest";
import { shouldOfferDbHint, shouldOfferDeployHint } from "../devhubHints";

const base = { userText: "", projectDescription: "", filePaths: [] as string[], historyHasHint: false };

describe("shouldOfferDbHint", () => {
  it("fires on data-shaped prompts in Russian and English", () => {
    expect(shouldOfferDbHint({ ...base, userText: "трекер привычек с календарём" })).toBe(true);
    expect(shouldOfferDbHint({ ...base, userText: "an inventory app for a small shop" })).toBe(true);
  });

  it("fires off the project description when the prompt itself is vague", () => {
    expect(shouldOfferDbHint({ ...base, userText: "make it pretty", projectDescription: "учёт заказов" })).toBe(true);
  });

  it("stays silent for non-data ideas", () => {
    expect(shouldOfferDbHint({ ...base, userText: "a landing page with a hero and pricing" })).toBe(false);
  });

  it("never offers twice and never offers when a schema already exists", () => {
    expect(shouldOfferDbHint({ ...base, userText: "todo app", historyHasHint: true })).toBe(false);
    expect(shouldOfferDbHint({ ...base, userText: "todo app", filePaths: ["db/schema.sql"] })).toBe(false);
  });
});

describe("shouldOfferDeployHint", () => {
  it("offers once for an undeployed static project and never for other stacks", () => {
    expect(shouldOfferDeployHint({ stack: "static", deployUrl: null, historyHasDeployHint: false })).toBe(true);
    expect(shouldOfferDeployHint({ stack: "static", deployUrl: "https://x.pages.dev", historyHasDeployHint: false })).toBe(false);
    expect(shouldOfferDeployHint({ stack: "static", deployUrl: null, historyHasDeployHint: true })).toBe(false);
    expect(shouldOfferDeployHint({ stack: "react", deployUrl: null, historyHasDeployHint: false })).toBe(false);
  });
});
