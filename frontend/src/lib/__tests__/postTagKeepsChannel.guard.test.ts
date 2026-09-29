import { describe, test, expect } from "vitest";
import { channelFrom, postFrom } from "../products";

/**
 * Сторож: подметка поста не отбирает канал.
 *
 * 🔴 Замер 30.09.2026. Instagram — единственный канал, приводящий людей до цен
 * (12 человек из 304 заходов), и трафик идёт рывками, то есть постами. Но у всех
 * ссылок ОДНА метка `?c=ig`, поэтому «какой пост сработал» ответить нечем.
 *
 * Опасность была не в отсутствии ответа, а в попытке его получить: до этой правки
 * метка `ig-post3` в список не входила, `channelFrom` возвращал null, и переход
 * терял КАНАЛ — попадал в «прямые заходы». Разметив посты своими силами, окно
 * публикаций сделало бы Instagram похожим на умерший канал, а «прямые» — на
 * выросший. Поэтому здесь проверяется ИМЕННО это: канал остаётся.
 */
describe("подметка поста", () => {
  test("канал определяется по префиксу", () => {
    expect(channelFrom("ig-kartinka3")).toBe("instagram");
    expect(channelFrom("yt-video7")).toBe("youtube");
    expect(channelFrom("ig")).toBe("instagram");
  });

  test("пост читается отдельно", () => {
    expect(postFrom("ig-kartinka3")).toBe("kartinka3");
    expect(postFrom("yt-video_7")).toBe("video_7");
    expect(postFrom("ig"), "без подметки поста нет").toBeNull();
  });

  test("КОНТРОЛЬ: выдуманный префикс по-прежнему НЕ канал", () => {
    // Иначе любая строка в адресе заводила бы новый канал, и отчёт по каналам
    // стал бы мусорным.
    for (const метка of ["vymysel-post1", "constructor-x", "-ig", "ig_post1"]) {
      expect(channelFrom(метка), `«${метка}» принято за канал`).toBeNull();
    }
  });

  test("КОНТРОЛЬ: унаследованные свойства не становятся каналом", () => {
    // Замер 02.09.2026: channelFrom("constructor") возвращал ФУНКЦИЮ Object.
    expect(channelFrom("constructor")).toBeNull();
    expect(postFrom("constructor-x")).toBeNull();
  });

  test("КОНТРОЛЬ: мусор в посте отбрасывается, канал остаётся", () => {
    // Строка из адреса уезжает в отчёты, поэтому должна быть скучной.
    expect(channelFrom("ig-Пост №3 <b>"), "канал потерян из-за мусора в посте").toBe("instagram");
    expect(postFrom("ig-Пост №3 <b>"), "мусор попал в отчёт как имя поста").toBeNull();
    expect(postFrom(`ig-${"a".repeat(41)}`), "слишком длинное имя поста принято").toBeNull();
  });
});
