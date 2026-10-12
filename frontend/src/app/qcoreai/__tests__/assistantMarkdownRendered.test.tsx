/*
 * Ответ QCoreAI показывается отрисованным, а не сырым Markdown, — и при этом
 * модель не может вставить свою разметку. Замер прода 12.10.2026 (окно
 * Приложения-31.12): гость спрашивал «Что такое AEVION?» и видел «**QRight**».
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown } from "@/lib/build/markdown";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "QCoreAIClient.tsx"), "utf8");

describe("QCoreAI: ответ модели отрисован и безопасен", () => {
  it("жирный и список становятся разметкой, звёздочки не видны", () => {
    const html = renderMarkdown("Модули:\n\n- **QRight** — реестр\n- **QSign** — подписи");
    expect(html).toContain("<strong>QRight</strong>");
    expect(html).toContain("<li>");
    expect(html).not.toContain("**");
  });

  it("HTML из ответа модели экранируется, а не исполняется", () => {
    const html = renderMarkdown('<img src=x onerror="alert(1)"> **ok**');
    expect(html).not.toMatch(/<img/i);
    expect(html).toContain("&lt;img");
  });

  it("чат отдаёт ответ ассистента через renderMarkdown, а текст человека — как есть", () => {
    expect(SRC).toMatch(/dangerouslySetInnerHTML: \{ __html: renderMarkdown\(m\.content\) \}/);
    expect(SRC).toMatch(/m\.role === "assistant"\s*\?\s*\{ dangerouslySetInnerHTML/);
    expect(SRC).toMatch(/: \{ children: m\.content \}/);
  });
});
