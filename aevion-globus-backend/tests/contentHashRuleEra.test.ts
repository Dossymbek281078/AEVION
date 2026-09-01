// Сертификат, выданный по правилу v1, обязан проверяться по правилу v1.
//
// ЗАМЕР 27.08.2026 по публичному реестру: 4 сертификата из 5 совпадали с
// правилом v1 и получали от ручки «hash mismatch» — то есть платформа
// обвиняла в подделке записи, которые сама же и выдала. Пятый («Test Patent»)
// не совпал ни с одним из десяти перебранных правил и остаётся невоспроизводимым.
//
// Опасность обратного свойства: принимая старое правило, легко принять и
// подделку. Поэтому здесь ровно столько же тестов на то, что подделка
// по-прежнему ловится — включая правку страны и города, которых правило v1
// НЕ покрывает, и это ограничение названо прямо, а не спрятано.

import { describe, expect, it } from "vitest";
import {
  canonicalContentHash,
  legacyContentHashV1,
  verifyContentHash,
} from "../src/lib/contentHash";

const FIELDS = {
  title: "Степной рассвет",
  description: "фотография, снята на рассвете",
  kind: "photo",
  country: "KZ",
  city: "Алматы",
};

describe("круг замыкается по обоим правилам", () => {
  it("выдали по нынешнему правилу — сошлось как v2", () => {
    const stored = canonicalContentHash(FIELDS);
    expect(verifyContentHash(FIELDS, stored)).toEqual({
      valid: true,
      rule: "v2",
    });
  });

  it("выдали по прежнему правилу — сошлось как v1", () => {
    const stored = legacyContentHashV1(FIELDS);
    expect(verifyContentHash(FIELDS, stored)).toEqual({
      valid: true,
      rule: "v1",
    });
  });

  it("правила РАЗНЫЕ — иначе весь разбор бессмыслен", () => {
    // Отрицательный контроль на сам приём: если бы два правила давали
    // одинаковый хеш, «сошлось по v1» ничего не означало бы.
    expect(legacyContentHashV1(FIELDS)).not.toBe(canonicalContentHash(FIELDS));
  });

  it("два правила НИКОГДА не совпадают — поэтому порядок проб ничего не решает", () => {
    // Здесь стоял тест «порядок проб: сперва v2». Мутация 27.08.2026
    // перевернула порядок в verifyContentHash — и тест остался ЗЕЛЁНЫМ.
    // Причина не в тесте, а в предмете: v1 сериализует три поля обычным
    // JSON.stringify, v2 — пять полей с сортировкой ключей, то есть строки
    // различаются всегда и совпасть могут только коллизией SHA-256.
    // Значит проверять надо это свойство, а не порядок: пока оно держится,
    // «сошлось по v1» однозначно означает выдачу по v1.
    const inputs = [
      { title: "t", description: "d", kind: "photo" },
      { title: "t", description: "d", kind: "photo", country: null, city: null },
      { title: "", description: "", kind: "other", country: "", city: "" },
      FIELDS,
      { title: "Музыка 1", description: "Музыка 1", kind: "music" },
    ];
    for (const inp of inputs) {
      expect(
        legacyContentHashV1(inp),
        `правила совпали на ${JSON.stringify(inp)} — «сошлось по v1» перестало что-либо означать`,
      ).not.toBe(canonicalContentHash(inp));
    }
  });
});

describe("подделка ловится обоими правилами", () => {
  const tamper: Array<[string, Record<string, unknown>]> = [
    ["подменили название", { title: "Другое название" }],
    ["подменили описание", { description: "другое описание" }],
    ["подменили вид работы", { kind: "music" }],
  ];

  it.each(tamper)("%s → не сошлось ни одним правилом (выдан по v2)", (_n, over) => {
    const stored = canonicalContentHash(FIELDS);
    expect(verifyContentHash({ ...FIELDS, ...over }, stored)).toEqual({
      valid: false,
      rule: null,
    });
  });

  it.each(tamper)("%s → не сошлось ни одним правилом (выдан по v1)", (_n, over) => {
    const stored = legacyContentHashV1(FIELDS);
    expect(verifyContentHash({ ...FIELDS, ...over }, stored)).toEqual({
      valid: false,
      rule: null,
    });
  });

  it("правка страны у сертификата v2 ловится", () => {
    const stored = canonicalContentHash(FIELDS);
    expect(verifyContentHash({ ...FIELDS, country: "RU" }, stored).valid).toBe(
      false,
    );
  });

  it("⚠️ правка страны у сертификата v1 НЕ ловится — и это надо показывать", () => {
    // Не дефект проверки, а свойство правила: страна и город в хеш v1 не
    // входили. Тест закрепляет ограничение, чтобы оно не потерялось: ручка
    // отдаёт contentHashRule, и страница обязана назвать это человеку.
    const stored = legacyContentHashV1(FIELDS);
    const v = verifyContentHash({ ...FIELDS, country: "RU", city: "Москва" }, stored);
    expect(v).toEqual({ valid: true, rule: "v1" });
  });

  it("случайный хеш не сходится ни одним правилом", () => {
    expect(verifyContentHash(FIELDS, "0".repeat(64))).toEqual({
      valid: false,
      rule: null,
    });
  });
});

describe("правило v1 воспроизводит РЕАЛЬНЫЕ значения из публичного реестра", () => {
  // Поля и ЗАПИСАННЫЙ хеш сняты с прода 27.08.2026 —
  // GET https://api.aevion.app/api/pipeline/verify/<id>. Это не синтетика
  // собственного изготовления: если правило воспроизведено неверно, тест
  // покраснеет на настоящих данных реестра.
  const REAL: Array<[string, { title: string; description: string; kind: string }, string]> = [
    [
      "cert-2bc929b3eec31e53",
      { title: "v2 smoke test", description: "after deploy of hardening commits", kind: "other" },
      "af0862af3da92a72c73a28cca49e8d9ff03f87b2a9fdcc7123ef8ff545752b95",
    ],
    [
      "cert-54825970871a4eb6",
      { title: "Музыка 1", description: "Музыка 1", kind: "music" },
      "3817f739a83d341987b6eb3fdc147744314b8099e105ccc3f13050b3068c5df9",
    ],
    [
      "cert-d45d64500ba70b75",
      { title: "smoke test", description: "post-v2 deploy check", kind: "other" },
      "fb6d42c3a3cbf40e669da361016ea6e37260d94d20b66a574b844f63e7b3bb91",
    ],
    [
      "cert-f7ac411b5a1929ad",
      { title: "1", description: "1", kind: "music" },
      "a0d36c60f7b40385401234cac758dfb8c1e071bf483c37ddd987ab74ebf7c8b9",
    ],
  ];

  it.each(REAL)("%s сходится по правилу v1", (_id, fields, stored) => {
    expect(verifyContentHash(fields, stored)).toEqual({ valid: true, rule: "v1" });
  });

  it("нынешнее правило на тех же полях даёт ДРУГОЙ хеш", () => {
    // Без этого предыдущий тест мог бы проходить по случайному совпадению
    // правил. Здесь названо, почему прод и показывал «hash mismatch».
    for (const [, fields, stored] of REAL) {
      expect(canonicalContentHash(fields)).not.toBe(stored);
    }
  });

  it("«Test Patent» не сходится НИ ОДНИМ правилом — и это честный отказ", () => {
    // Пятая запись реестра. Её хеш не воспроизводится ни нынешним правилом,
    // ни прежним, ни восемью другими перебранными 27.08.2026. Принимать её
    // было бы нечем, и вердикт «не сошлось» — правильный ответ.
    const fields = {
      title: "Test Patent",
      description: "Testing IP Bureau certificate",
      kind: "idea",
    };
    const stored = "24d475bea2ae8a647cb0de81c4fe726bee4cae0e2d0e9cfc108153cd9d43e63c";
    expect(verifyContentHash(fields, stored)).toEqual({ valid: false, rule: null });
  });
});
