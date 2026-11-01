// Подмена поставщика видна человеку (решение Оркестратора 31.10.2026): выбрал GPT, ответил Claude —
// над ответом пометка на языке сайта; совпало или ничего не выбрано — пометки нет. Тексты сбоя — на ru/en/kk.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { пометкаПодмены, chatText, chatLang } from "../podmena";

const P = [
  { id: "anthropic", name: "Claude (Anthropic)" },
  { id: "openai", name: "GPT (OpenAI)" },
  { id: "gemini", name: "Gemini (Google)" },
];
const CYR = /[А-Яа-яЁё]/;
const KK = /[ӘәҒғҚқҢңӨөҰұҮүҺһІі]/;

describe("пометка подмены поставщика", () => {
  it("выбрал GPT, ответил Claude — пометка на ru/en/kk", () => {
    expect(пометкаПодмены("openai", "anthropic", "Claude (Anthropic)", P, "ru")).toBe("Ответил Claude (Anthropic): GPT (OpenAI) сейчас недоступна.");
    expect(пометкаПодмены("openai", "anthropic", "Claude (Anthropic)", P, "en")).toBe("Answered by Claude (Anthropic): GPT (OpenAI) is unavailable right now.");
    expect(пометкаПодмены("gemini", "anthropic", "Claude (Anthropic)", P, "kk")).toBe("Claude (Anthropic) жауап берді: Gemini (Google) қазір қолжетімсіз.");
  });

  it("совпало, ничего не выбрано или сервер не сказал, кто ответил, — пометки нет", () => {
    expect(пометкаПодмены("anthropic", "anthropic", "Claude (Anthropic)", P, "ru")).toBeNull();
    expect(пометкаПодмены("", "anthropic", "Claude (Anthropic)", P, "ru")).toBeNull();
    expect(пометкаПодмены("openai", undefined, undefined, P, "ru")).toBeNull();
  });

  it("неизвестный id — показывается как есть, а не пустое место", () => {
    expect(пометкаПодмены("grok", "anthropic", undefined, P, "en")).toBe("Answered by Claude (Anthropic): grok is unavailable right now.");
  });

  it("тексты сбоя и «не подключены»: en без кириллицы, ru по-русски, kk с казахскими буквами", () => {
    expect(chatText("en").offline + chatText("en").notConfigured).not.toMatch(CYR);
    expect(chatText("ru").offline).toMatch(CYR);
    expect(chatText("ru").offline).not.toMatch(KK);
    expect(chatText("kk").offline).toMatch(KK);
    expect(chatLang("de")).toBe("en");
  });

  it("клиент подставляет пометку и не шлёт её на сервер; английский текст сбоя больше не зашит", () => {
    const src = readFileSync(join(__dirname, "..", "QCoreAIClient.tsx"), "utf8");
    expect(src).toMatch(/пометкаПодмены\(selectedProvider, data\?\.mode/);
    expect(src).toMatch(/nextMsgs\.map\(\(\{ role, content \}\) => \(\{ role, content \}\)\)/);
    expect(src).toMatch(/data-qcore-podmena/);
    expect(src).not.toMatch(/"I am currently offline/);
    expect(src).not.toMatch(/>\s*Not configured\s*</);
  });
});

describe("тексты шапки и возможностей /qcoreai на языке сайта", () => {
  const keys = ["subtitle", "selectProvider", "askLabel", "askPlaceholder", "capsTitle"] as const;

  it("ru и kk — без английской шапки, en — как было", () => {
    for (const k of keys) {
      expect(chatText("ru")[k]).toMatch(CYR);
      expect(chatText("kk")[k]).toMatch(CYR);
      expect(chatText("en")[k]).not.toMatch(CYR);
    }
    expect(chatText("kk").askPlaceholder).toMatch(KK);
    expect(chatText("en").askPlaceholder).toBe("Ask QCoreAI anything...");
  });

  it("возможности: четыре пункта на каждом языке, поставщики не обещаны сверх подключённых", () => {
    for (const l of ["ru", "en", "kk"] as const) {
      const caps = chatText(l).caps;
      expect(caps).toHaveLength(4);
      for (const c of caps) {
        expect(c.t.length).toBeGreaterThan(0);
        expect(c.d.length).toBeGreaterThan(0);
      }
      const all = caps.map((c) => c.t + " " + c.d).join(" ");
      expect(all).not.toMatch(/DeepSeek|Grok|GPT-4|5 AI providers/);
    }
  });
});

describe("чат /qcoreai без входа не шлёт модель и показывает отказ сервера", () => {
  const src = readFileSync(join(__dirname, "../QCoreAIClient.tsx"), "utf8");
  it("provider и model уходят только при токене", () => {
    expect(src).toMatch(/if \(signedIn\) \{\s*if \(selectedProvider\) body\.provider = selectedProvider;\s*if \(selectedModel\) body\.model = selectedModel;\s*\}/);
    expect(src.split("body.provider = selectedProvider").length - 1).toBe(1); // одно место — под проверкой входа
  });
  it("402/400/503 с message и loginUrl показываются как есть, а не как «ИИ не отвечает»", () => {
    expect(src).toMatch(/res\.status === 402[\s\S]{0,200}data\?\.loginUrl[\s\S]{0,200}content: data\.message/);
  });
});
