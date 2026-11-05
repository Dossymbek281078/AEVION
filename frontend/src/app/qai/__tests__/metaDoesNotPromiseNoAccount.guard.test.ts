// «Обещает = делает». Замер 5.11.2026 на проде: /qai закрыт стеной (402 гостю, модуль входит только в «Планету»),
// а meta description говорил «No account required» — поисковик и превью обещали бесплатный вход без аккаунта.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("meta /qai не обещает доступ без аккаунта", () => {
  const src = readFileSync(join(__dirname, "../layout.tsx"), "utf8");
  it("нет «No account required» / «free» в layout", () => {
    expect(src).not.toMatch(/No account required|no sign-?up|free to use/i);
  });
  it("description называет план, который открывает модуль", () => {
    expect(src).toMatch(/Planet/);
  });
});
