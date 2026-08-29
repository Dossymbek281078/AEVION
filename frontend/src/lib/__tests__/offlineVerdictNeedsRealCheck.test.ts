// Офлайн-проверка объявляла пакет подлинным, не выполнив НИ ОДНОЙ
// криптографической проверки.
//
// Вердикт считался так (verifyBundle.ts):
//
//   if (allChecks.some(fail)) fail
//   else if (allChecks.every(skip)) fail
//   else pass
//
// а в `allChecks` входит `bundleShape` — «узнали формат пакета», который
// ставится в pass БЕЗУСЛОВНО. Значит достаточно узнать формат, чтобы
// `every(skip)` стало ложным и вердикт вышел «pass»: страница показывает
// «✅ Bundle verified offline» и рядом обещает «If the math passes, the
// certificate is authentic» — при том, что математика не считалась вовсе.
//
// Это ядро продукта: «доказательство переживёт AEVION» держится на том, что
// офлайн-проверка честна. Ложное «подлинно» здесь дороже любого падения.
import { describe, it, expect } from "vitest";
import { verifyAevionBundle } from "../verifyBundle";

/**
 * Пакет, который может собрать КТО УГОДНО: своё содержимое и честно
 * посчитанный SHA-256 от него. Подписей нет вовсе.
 *
 * Хеш содержимого самосогласован — он доказывает, что содержимое не менялось
 * ПОСЛЕ того, как хеш посчитали, но НЕ доказывает, что его заверял AEVION.
 * Заверение даёт подпись, а её здесь нет.
 */
async function selfMadeBundle(): Promise<any> {
  const inputs = {
    title: "Моя работа",
    description: "Текст, который я придумал сам",
    kind: "text",
    country: null,
    city: null,
  };
  const canonical = {
    description: inputs.description,
    kind: inputs.kind,
    title: inputs.title,
    country: null,
    city: null,
  };
  // Тот же порядок ключей, что у проверяющего: сортировка по имени.
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(canonical).sort()) sorted[k] = (canonical as any)[k];
  const bytes = new TextEncoder().encode(JSON.stringify(sorted));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const value = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    version: "2",
    certificate: {},
    proofs: { contentHash: { canonicalInputs: inputs, value } },
  };
}

describe("вердикт офлайн-проверки требует НАСТОЯЩЕЙ проверки", () => {
  it("самодельный пакет без подписей не может быть «verified»", async () => {
    const r = await verifyAevionBundle(await selfMadeBundle());
    // Контроль: хеш ДОЛЖЕН сойтись (иначе тест проверял бы не то), а подписей
    // нет вовсе — именно эту комбинацию и может собрать посторонний.
    expect(r.contentHash.status, "хеш не сошёлся — тест собран неверно").toBe("pass");
    expect(
      [r.aevionSignature.status, r.authorCosignature.status],
      "контроль: подписей в пакете нет",
    ).toEqual(["skip", "skip"]);
    expect(
      r.overall,
      "самодельный пакет объявлен подлинным: сошёлся только его собственный хеш",
    ).not.toBe("pass");
  });

  it("узнавание формата само по себе не вердикт", async () => {
    const r = await verifyAevionBundle(await selfMadeBundle());
    expect(r.bundleShape.status, "форму узнали — это ожидаемо").toBe("pass");
    expect(r.overall, "но одного узнавания формы мало").not.toBe("pass");
  });
});
