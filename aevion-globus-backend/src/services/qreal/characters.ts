// QReal — реестр персонажей сцены. Закрывает дрейф идентичности между кадрами.
//
// Откуда берётся дрейф: раскадровку пишет LLM ПОКАДРОВО, и субъект каждого
// кадра описывается заново. «7yo boy, tousled hair, oversized sweater» в кадре 2
// превращается в «little boy running» в кадре 4 — движок получает два разных
// описания и рисует два разных лица. По нашей же спеке (раздел 2.1) это
// публично признанное узкое место ВСЕХ конкурентов, и именно его мы объявляем
// своей нишей.
//
// Решение: собрать субъекты в персонажей, выбрать одно каноническое описание
// и подставлять ЕГО во все кадры, где персонаж занят. Модель перестаёт
// угадывать — она получает одинаковый текст.
//
// Здесь только чистые функции: группировка и подстановка тестируются без сети
// и без БД (scripts/qreal-characters.test.mjs).

export type CharacterKind = "human" | "child" | "animal" | "bird" | "nature" | "object";

export type Character = {
  id: string;
  kind: CharacterKind;
  /** Короткая метка для UI: «мальчик», «алабай». Выводится из описания. */
  name: string;
  /** Каноническое описание — единственный текст, который уходит в промты. */
  canonical: string;
  /** Референс-кадры для движков, умеющих reference-to-video. */
  refImages: string[];
  /** В каких кадрах занят (id кадров) — чтобы UI показывал охват. */
  shotIds: string[];
};

type SubjectLike = { kind: string; description: string };
type ShotLike = { id: string; subjects: SubjectLike[] };

/** Идентичность важна для живых субъектов. Пейзаж и реквизит тоже дрейфуют,
 *  но их расхождение зритель прощает — лицо не прощает. Держим список узким,
 *  чтобы не плодить «персонажей» из травы и посуды. */
const IDENTITY_KINDS = new Set(["human", "child", "animal", "bird"]);

// Слова, которые есть почти в любом описании и потому ничего не различают.
const STOP = new Set([
  "the", "a", "an", "and", "with", "of", "in", "on", "at", "to", "from", "for",
  "his", "her", "its", "their", "is", "are", "be", "as", "by",
  "и", "в", "на", "с", "у", "по", "из", "не", "его", "её", "их",
]);

export function tokens(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Похожесть двух описаний: доля общих значимых слов от более короткого.
 *  Берём min, а не объединение: «7yo boy» и «7yo boy, tousled hair, sweater» —
 *  один и тот же мальчик, хотя по Жаккару они далеки. */
export function similarity(a: string, b: string): number {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / Math.min(A.size, B.size);
}

const MATCH_THRESHOLD = 0.34;

/** Каноническим считаем самое ПОДРОБНОЕ описание группы: оно несёт больше
 *  зацепок для модели (возраст, одежда, повадка), а короткое всегда можно
 *  вывести из подробного, наоборот — нет. */
function pickCanonical(descriptions: string[]): string {
  return descriptions.reduce((best, d) => (tokens(d).length > tokens(best).length ? d : best), descriptions[0]);
}

/** Метка для UI: первые два значимых слова канонического описания. */
function deriveName(canonical: string): string {
  const t = tokens(canonical).slice(0, 2);
  return t.length ? t.join(" ") : "персонаж";
}

/** Субъекты всех кадров → персонажи. Детерминированно: одинаковый вход даёт
 *  одинаковые id, иначе реестр «прыгал» бы при каждой пересборке раскадровки. */
export function deriveCharacters(shots: ShotLike[]): Character[] {
  const groups: Array<{ kind: string; descriptions: string[]; shotIds: string[] }> = [];

  for (const shot of shots || []) {
    for (const subj of shot.subjects || []) {
      if (!IDENTITY_KINDS.has(subj.kind)) continue;
      const desc = String(subj.description || "").trim();
      if (!desc) continue;

      // Ребёнок и взрослый — разные kind, но LLM их путает; сравниваем внутри
      // «человеческой» группы, чтобы «7yo boy» из human и из child слились.
      const human = subj.kind === "human" || subj.kind === "child";
      const g = groups.find((x) => {
        const sameFamily = human ? x.kind === "human" || x.kind === "child" : x.kind === subj.kind;
        return sameFamily && x.descriptions.some((d) => similarity(d, desc) >= MATCH_THRESHOLD);
      });

      if (g) {
        g.descriptions.push(desc);
        if (!g.shotIds.includes(shot.id)) g.shotIds.push(shot.id);
        // child точнее human: ребёнок, названный «человеком», всё равно ребёнок.
        if (subj.kind === "child") g.kind = "child";
      } else {
        groups.push({ kind: subj.kind, descriptions: [desc], shotIds: [shot.id] });
      }
    }
  }

  return groups.map((g, i) => {
    const canonical = pickCanonical(g.descriptions);
    return {
      id: `ch-${i + 1}`,
      kind: g.kind as CharacterKind,
      name: deriveName(canonical),
      canonical,
      refImages: [],
      shotIds: g.shotIds,
    };
  });
}

/** Какой персонаж соответствует субъекту кадра. null — если это разовый
 *  субъект (пейзаж, реквизит) или совпадений нет. */
export function matchCharacter(subj: SubjectLike, characters: Character[]): Character | null {
  if (!IDENTITY_KINDS.has(subj.kind)) return null;
  const human = subj.kind === "human" || subj.kind === "child";
  let best: { c: Character; score: number } | null = null;
  for (const c of characters) {
    const sameFamily = human ? c.kind === "human" || c.kind === "child" : c.kind === subj.kind;
    if (!sameFamily) continue;
    const score = similarity(c.canonical, subj.description);
    if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { c, score };
  }
  return best?.c ?? null;
}

/** Описания субъектов кадра, где узнанные персонажи заменены каноническим
 *  текстом. Разовые субъекты остаются как есть — им нечего стабилизировать. */
export function subjectLines(subjects: SubjectLike[], characters: Character[]): string[] {
  return (subjects || []).map((s) => {
    const c = matchCharacter(s, characters);
    return c ? `${c.kind}: ${c.canonical}` : `${s.kind}: ${s.description}`;
  });
}

/** Директива консистентности. Без неё движок получает одинаковый текст, но всё
 *  равно волен трактовать его заново; явное указание «тот же персонаж, что и в
 *  предыдущих кадрах» заметно снижает дрейф на моделях с мульти-шотом. */
export function consistencyDirective(shotCharacters: Character[]): string {
  if (!shotCharacters.length) return "";
  const names = shotCharacters.map((c) => c.canonical).join("; ");
  return (
    ` Character continuity: the same individuals appear across all shots of this scene — ${names}. ` +
    "Keep face, build, hair, clothing and markings identical to the other shots; do not reinterpret them."
  );
}

/** Референс-каст кадра для движков с reference-to-video.
 *
 *  Seedance адресует опорные картинки прямо в тексте промта — `@Image1`,
 *  `@Image2` (схема сверена по каталогу fal 2026-07-26). Поэтому мало
 *  положить URL в `image_urls`: если в промте на них не сослаться, модель
 *  их проигнорирует. Здесь нумерация и текст собираются вместе, чтобы
 *  порядок в массиве и номера в промте не разъехались.
 *
 *  Возвращает пустой imageUrls, если ни у одного персонажа кадра нет
 *  референсов — тогда вызывающий код останется на обычном text-to-video. */
export function referenceCast(
  subjects: SubjectLike[],
  characters: Character[]
): { imageUrls: string[]; lines: string[] } {
  const imageUrls: string[] = [];
  const lines = (subjects || []).map((s) => {
    const c = matchCharacter(s, characters);
    if (!c) return `${s.kind}: ${s.description}`;
    const first = c.refImages?.[0];
    // Один референс на персонажа: 9 слотов делятся на весь каст, и лицо
    // фиксирует первый кадр, а не количество ракурсов.
    if (!first || imageUrls.length >= 9) return `${c.kind}: ${c.canonical}`;
    imageUrls.push(first);
    return `${c.kind}: ${c.canonical} (@Image${imageUrls.length})`;
  });
  return { imageUrls, lines };
}

/** Персонажи, занятые в конкретном кадре. */
export function charactersInShot(subjects: SubjectLike[], characters: Character[]): Character[] {
  const out: Character[] = [];
  for (const s of subjects || []) {
    const c = matchCharacter(s, characters);
    if (c && !out.includes(c)) out.push(c);
  }
  return out;
}
