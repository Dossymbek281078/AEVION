import { describe, test, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Потолок токенов у ПОТОКОВОЙ и НЕ-потоковой ветви одного провайдера обязан
 * совпадать. Живой случай: #842 (22.07.2026) чинил обрезанные ответы
 * подъёмом max_tokens до 8192 — и поднял только callAnthropic; streamAnthropic
 * остался на 4096, то есть тот же вопрос тому же провайдеру в стриме
 * обрывался вдвое раньше, молча. Найдено 06.09 при разборе плана стриминга
 * генерации DevHub. Класс — «починил аналог, а не все ветви» (§15е).
 *
 * Сторож читает ЧИСЛА из исходника, а не закрепляет «8192»: следующий
 * подъём предела не должен его красить, рассинхрон ветвей — должен.
 */
const SRC = fs.readFileSync(
  path.resolve(__dirname, "..", "src", "services", "qcoreai", "providers.ts"),
  "utf8",
);

function fnBody(name: string): string {
  // Стримеры — генераторы (`function* имя(`), обычный якорь их не видит:
  // первый прогон сторожа упал ровно на этом.
  let i = SRC.indexOf(`function ${name}(`);
  if (i < 0) i = SRC.indexOf(`function* ${name}(`);
  expect(i, `функция ${name} не найдена — сторож смотрит не туда`).toBeGreaterThan(0);
  // До следующего объявления функции того же уровня — достаточно для чисел.
  const rest = SRC.slice(i);
  const j = rest.indexOf("\nasync function", 10);
  return j > 0 ? rest.slice(0, j) : rest;
}

function num(body: string, re: RegExp, what: string): number {
  const m = body.match(re);
  expect(m, `${what}: число не найдено — форма записи сменилась, поправьте сторож`).toBeTruthy();
  return Number(m![1]);
}

describe("потолки токенов: стрим = не-стрим", () => {
  test("anthropic: max_tokens совпадает у обеих ветвей", () => {
    const call = num(fnBody("callAnthropic"), /max_tokens:\s*maxTokens\s*\?\?\s*(\d+)/, "callAnthropic");
    const stream = num(fnBody("streamAnthropic"), /max_tokens:\s*(\d+)/, "streamAnthropic");
    expect(stream, "потоковая ветвь anthropic отстала от не-потоковой — ответы в стриме обрежутся раньше").toBe(call);
  });

  test("gemini: maxOutputTokens совпадает у обеих ветвей", () => {
    const call = num(fnBody("callGemini"), /maxOutputTokens:\s*maxTokens\s*\?\?\s*(\d+)/, "callGemini");
    const stream = num(fnBody("streamGemini"), /maxOutputTokens:\s*(\d+)/, "streamGemini");
    expect(stream, "потоковая ветвь gemini разошлась с не-потоковой").toBe(call);
  });

  test("прибор работает: числа настоящие, а не совпавшие нули", () => {
    const call = num(fnBody("callAnthropic"), /max_tokens:\s*maxTokens\s*\?\?\s*(\d+)/, "callAnthropic");
    expect(call).toBeGreaterThanOrEqual(4096);
  });
});
