import { describe, expect, test } from "vitest";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { identityVerdict, rateLimitHint } = require("../scripts/qskyway-smoke.js");

/**
 * Смоук обязан отличить СВОЙ сервер от соседского.
 *
 * ПОВОД (29.08.2026). Смоук прошёл 153/153 при том, что бэкенда этой
 * ветки не было запущено вовсе: на порту 4001 сидел сервер соседней
 * сессии. Прежние проверки его пропустили — и это не недосмотр автора.
 * Он знал про общий порт (в файле записан потерянный на этом час
 * 27.07) и построил защиту, но защита спрашивала СПОСОБНОСТЬ: «это
 * QSkyway? есть ли фича?». Способность у всех 18 worktree одинаковая —
 * это один репозиторий. Проверка пропускала ровно тот случай, против
 * которого написана.
 *
 * Цена не только в ложном зелёном: смоук БРОНИРУЕТ слоты, то есть
 * пишет в чужой процесс. Соседняя сессия увидит брони, которых не
 * делала, и пойдёт искать их источник.
 *
 * Часть случаев ниже руками не воспроизвести, не подняв вторую сессию,
 * поэтому решение вынесено в чистую функцию и проверяется таблицей.
 */
describe("смоук отличает свой сервер от чужого", () => {
  test("сервер не назвал ветку, порт по умолчанию — отказ", () => {
    const v = identityVerdict({ branch: "unknown" }, { baseIsExplicit: false, localBranch: "feat/mine" });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("unidentified");
  });

  test("поля ветки нет вовсе — тот же отказ, а не молчаливое согласие", () => {
    const v = identityVerdict({}, { baseIsExplicit: false, localBranch: "feat/mine" });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("unidentified");
  });

  test("ветка чужая, порт по умолчанию — отказ с другой причиной", () => {
    const v = identityVerdict({ branch: "feat/theirs" }, { baseIsExplicit: false, localBranch: "feat/mine" });
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("other-branch");
  });

  test("ветка совпала — пропускаем", () => {
    const v = identityVerdict({ branch: "feat/mine" }, { baseIsExplicit: false, localBranch: "feat/mine" });
    expect(v.ok).toBe(true);
  });

  test("BASE задан явно — оператор знает, куда целится", () => {
    // Осознанный выбор пропускать: указать адрес руками и есть заявление
    // «я знаю, что это за сервер». Запрещать здесь значило бы сломать
    // прогон против превью и стенда, и сторожа просто отключили бы.
    for (const health of [{ branch: "unknown" }, { branch: "feat/theirs" }]) {
      expect(identityVerdict(health, { baseIsExplicit: true, localBranch: "feat/mine" }).ok).toBe(true);
    }
  });

  test("git не ответил — сравнение веток отключается, но отказ неопознанному остаётся", () => {
    // «Не смог спросить» это не «совпадает». Слабеет одна проверка из
    // двух, а не обе: иначе поломка git тихо открывала бы дверь.
    expect(identityVerdict({ branch: "feat/theirs" }, { baseIsExplicit: false, localBranch: "" }).ok).toBe(true);
    expect(identityVerdict({ branch: "unknown" }, { baseIsExplicit: false, localBranch: "" }).ok).toBe(false);
  });

  test("сообщение об отказе называет цену, а не только факт", () => {
    const v = identityVerdict({ branch: "unknown" }, { baseIsExplicit: false, localBranch: "feat/mine" });
    // Отказ без причины читается как придирка сторожа, и его обходят.
    expect(v.message).toContain("БРОНИРУЕТ");
  });
});

describe("смоук называет предел частоты своим именем", () => {
  test("429 объясняется, а не выглядит поломкой ветки", () => {
    const h = rateLimitHint(429);
    // Человек читает первую строку и решает, куда копать. Если там
    // «books up to capacity», он пойдёт искать регрессию у себя —
    // я сам перебрал два неверных диагноза именно так.
    expect(h).toContain("429");
    expect(h).toContain("не поломка ветки");
  });

  test("у настоящих отказов подсказки нет — иначе она обесценится", () => {
    for (const code of [200, 201, 400, 409, 500]) {
      expect(rateLimitHint(code), "подсказка про предел прилипла к коду " + code).toBe("");
    }
  });
});
