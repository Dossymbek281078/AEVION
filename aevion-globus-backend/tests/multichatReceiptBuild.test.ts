import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";

import { buildReceipt } from "../src/services/multichat/receipt";
import { buildDissentMap } from "../src/services/multichat/dissent";
import { canonicalHash } from "../src/lib/qsignV2/canonicalize";

// Выдача чека: проверяется СВОЙСТВО, ради которого чек и существует — подмена того,
// что человек прочитал, обязана менять хеш. В самом коде про список «что проверить»
// написано прямо: «не покрыть её чеком значило бы оставить единственное место, где
// совет можно подменить незаметно». Утверждение сильное, а теста под ним не было.
//
// Проверяем не наличие полей, а неотличимость подделки: меняем по одному разряду и
// смотрим, сдвинулся ли хеш.

const ANSWERS = [
  { agentId: "analyst", role: "аналитик", provider: "anthropic", model: "claude", ok: true, reply: "Стоимость 12000 долларов, срок 6 недель." },
  { agentId: "writer", role: "автор", provider: "openai", model: "gpt", ok: true, reply: "Около 12000 долларов и 6 недель." },
  { agentId: "critic", role: "критик", provider: "gemini", model: "gemini", ok: true, reply: "Реально 30000 долларов и не меньше 12 недель." },
];

const base = (answers = ANSWERS, prompt = "Оцени проект") =>
  buildReceipt({
    conversationId: "c-1",
    prompt,
    answers: answers as never,
    dissent: buildDissentMap(answers as never),
    askedAt: "2026-08-19T10:00:00.000Z",
  });

const h = (r: unknown) => canonicalHash(r).hash;

describe("чек делает подделку заметной", () => {
  const original = h(base());

  test("одинаковый вход — одинаковый хеш (иначе сравнивать нечего)", () => {
    // Отрицательный контроль на первом конце: если хеш «плывёт» сам, все проверки
    // ниже покажут расхождение по любой причине и ничего не докажут.
    expect(h(base())).toBe(original);
  });

  test("подменён ОТВЕТ агента — хеш другой, даже при ТОЙ ЖЕ длине", () => {
    // Длина здесь критична. Первая версия теста меняла ответ на текст другой
    // длины — и проходила даже когда мутация обнуляла replyHash полностью:
    // расхождение давало поле replyChars, а не хеш. Тест был зелёным по другой
    // причине, чем заявлял. Мутация это и показала.
    const from = ANSWERS.find((a) => a.agentId === "critic")!.reply;
    const to = from.replace("30000", "13000"); // та же длина, другое содержимое
    expect(to.length).toBe(from.length);
    expect(to).not.toBe(from);
    const tampered = ANSWERS.map((a) => (a.agentId === "critic" ? { ...a, reply: to } : a));
    expect(h(base(tampered))).not.toBe(original);
  });

  test("хеш ответа ВЫВЕДЕН из ответа агента", () => {
    // Третья попытка, и предыдущие две проходили по чужой причине. Подмена ответа —
    // даже той же длины — меняет карту расхождений, а она входит в чек: хеш сдвигался
    // из-за карты, а не из-за replyHash. Мутация «replyHash: null» проходила дважды.
    // Единственная надёжная проверка — сравнить с хешем самого текста.
    const r = base();
    for (const a of ANSWERS) {
      const p = r.panel.find((x) => x.agentId === a.agentId)!;
      expect(p.replyHash).toBe(createHash("sha256").update(a.reply, "utf8").digest("hex"));
      expect(p.replyChars).toBe(a.reply.length);
    }
  });

  test("подменён ВОПРОС — хеш другой, при той же длине", () => {
    const from = "Оцени проект";
    const to = "Оцени приект"; // та же длина
    expect(to.length).toBe(from.length);
    expect(h(base(ANSWERS, to))).not.toBe(h(base(ANSWERS, from)));
  });

  test("хеш совета ВЫВЕДЕН из его текста, а не поставлен как попало", () => {
    // Первая версия подменяла textHash прямо в объекте чека и смотрела, сдвинулся
    // ли хеш. Это доказывало лишь чувствительность канонизации к полю — и
    // проходило, даже когда buildReceipt ставил в textHash константу. Проверять
    // надо ВЫВОД: хеш обязан совпадать с хешем того самого текста.
    const answers = ANSWERS;
    const map = buildDissentMap(answers as never);
    const r = base(answers);
    expect(r.dissent.checks.length).toBeGreaterThan(0);
    expect(r.dissent.checks.length).toBe(map.checks.length);
    for (let i = 0; i < map.checks.length; i++) {
      expect(r.dissent.checks[i].textHash).toBe(
        createHash("sha256").update(map.checks[i].text, "utf8").digest("hex"),
      );
      expect(r.dissent.checks[i].kind).toBe(map.checks[i].kind);
    }
  });

  test("подмена текста совета меняет чек: хеши разных текстов различны", () => {
    // Второй конец того же свойства — на случай, если хеш начнут считать от чего-то
    // постоянного: два разных текста обязаны давать разные хеши в чеке.
    const hashes = new Set(base().dissent.checks.map((c) => c.textHash));
    expect(hashes.size).toBe(base().dissent.checks.length);
  });

  test("советы переставлены местами — хеш другой: порядок и есть приоритет", () => {
    const r = base();
    const reordered = JSON.parse(JSON.stringify(r));
    expect(reordered.dissent.checks.length).toBeGreaterThan(1);
    reordered.dissent.checks.reverse();
    expect(h(reordered)).not.toBe(original);
  });

  test("вердикт подменён — хеш другой", () => {
    const r = JSON.parse(JSON.stringify(base()));
    r.dissent.verdict = "consensus";
    expect(h(r)).not.toBe(original);
  });
});

describe("счётчики чека сходятся с составом панели", () => {
  test("ответивших плюс упавших равно числу вызовов", () => {
    const withFailure = [...ANSWERS.slice(0, 2), { agentId: "critic", ok: false, reply: "", error: "таймаут" }];
    const r = base(withFailure as never);
    expect(r.cost.calls).toBe(3);
    expect(r.cost.answered + r.cost.failed).toBe(r.cost.calls);
    expect(r.cost.failed).toBe(1);
  });

  test("у упавшего агента хеша ответа нет — нечего подтверждать", () => {
    const withFailure = [...ANSWERS.slice(0, 2), { agentId: "critic", ok: false, reply: "", error: "таймаут" }];
    const r = base(withFailure as never);
    const critic = r.panel.find((p) => p.agentId === "critic")!;
    expect(critic.replyHash).toBeNull();
    expect(critic.ok).toBe(false);
  });

  test("состав панели совпадает с тем, кого спрашивали", () => {
    const r = base();
    expect(r.panel.map((p) => p.agentId)).toEqual(["analyst", "writer", "critic"]);
    expect(r.panel.map((p) => p.provider)).toEqual(["anthropic", "openai", "gemini"]);
  });
});
