/**
 * Negation-aware keyword matching for user-submitted prose.
 * ─────────────────────────────────────────────────────────
 *
 * Scoring code across the platform reads free text by testing for a keyword and
 * treating a hit as evidence the thing exists. That reads a denial as a claim:
 *
 *   "We have no patents and no proprietary technology."  -> mentionsPatent = true
 *   "Pre-launch. No revenue, no users."                  -> "revenue cited", +18
 *
 * Both were live defects in QVenture — the first credited a moat to a plan that
 * explicitly disclaimed one, the second let pre-launch companies outscore ones
 * with real adoption. The fix is the same everywhere: before accepting a match,
 * look at the words immediately before it.
 *
 * This is deliberately a narrow lexical check, not sentiment analysis. It catches
 * the direct "no X" / "without X" / "not yet X" constructions that appear in
 * pitch text, and nothing subtler. It will not catch "we looked at patents and
 * decided against filing" — that needs a model, not a regex, and pretending
 * otherwise would be worse than the honest limit.
 */

/**
 * Words that, appearing just before a keyword, invert its meaning.
 *
 * Russian added 2026-07-27: the platform is Russian-first, so until then this
 * check was blind on most of its actual input — «выручки нет» and «без патентов»
 * read as claims, exactly the defect the module exists to prevent. Safe for the
 * existing QVenture caller: its patterns are English-only (`revenue`, `patents`,
 * `mrr`), so a Russian negator can never change a match it makes.
 */
const NEGATORS = [
  "no", "not", "never", "without", "zero", "none", "lacks", "lack", "lacking",
  "aren't", "arent", "isn't", "isnt", "hasn't", "hasnt", "haven't", "havent",
  "don't", "dont", "doesn't", "doesnt", "yet to", "awaiting", "absent",
  "pre-launch", "prelaunch", "pre-revenue", "prerevenue",
  // рус. — частицы и предлоги отрицания, плюс формы «отсутствует/нехватка»
  "не", "нет", "ни", "без", "нету", "отсутствует", "отсутствуют", "отсутствие",
  "лишён", "лишена", "лишено", "нехватка", "не хватает", "пока нет", "ещё нет",
  "еще нет", "никаких", "никакого", "никакой",
];

/** How far back to look for a negator, in characters. */
const LOOKBEHIND = 40;

/**
 * A contrastive conjunction closes the negation it follows: in "no revenue yet,
 * but revenue starts in Q3" the second clause is a claim, not part of the denial.
 *
 * Without this the scope ended only at the lookbehind limit, so whether a claim
 * survived depended on how many words sat between the denial and it — "no revenue
 * in year one, but revenue reached $40k" was credited while the shorter "no
 * revenue yet, but revenue starts in Q3" was not. Length is not meaning.
 */
// Границы — lookaround по буквам, а НЕ `\b`: в JS `\b` определён через
// ASCII-класс слова и на кириллице не срабатывает вовсе, поэтому «но» и
// «однако» с `\b` не находились бы.
const CONTRAST_RE =
  /(?<!\p{L})(but|however|although|though|whereas|nevertheless|instead|но|однако|зато|хотя|тогда как|тем не менее|вместо)(?!\p{L})/giu;

const NEGATOR_RE = new RegExp(
  String.raw`(?<!\p{L})(${NEGATORS.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?!\p{L})[^.;!?]{0,30}$`,
  "iu"
);

/**
 * Отрицатели, которые в русском стоят ПОСЛЕ слова: «выручки нет», «удержания
 * нет», «патентов нет». Английский так почти не строит, поэтому исходный
 * lookbehind этого класса не видел вовсе — проверено 27.07: «Удержания нет»
 * читалось как утверждение об удержании.
 *
 * Окно намеренно узкое: допускается не больше одного слова между ключевым и
 * отрицателем и НИ ОДНОЙ запятой. Иначе «удержание есть, а роста нет» отняло бы
 * удержание — отрицание там относится к другому слову.
 */
const POST_NEGATOR_RE =
  /^[\s]*(?:\p{L}+[\s]+){0,1}(нет|нету|отсутствует|отсутствуют|не наблюдается)(?!\p{L})/iu;

/**
 * True when `pattern` matches somewhere in `text` in a non-negated position.
 *
 * Every match is checked, so "no revenue yet, but $40k MRR booked" still counts:
 * the second occurrence is unnegated even though the first is not. A sentence
 * boundary stops the lookbehind, so a negation in the previous sentence does not
 * suppress a genuine claim in this one.
 */
export function mentionsUnnegated(text: string, pattern: RegExp): boolean {
  if (!text) return false;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  for (const m of text.matchAll(re)) {
    if (m.index === undefined) continue;
    let before = text.slice(Math.max(0, m.index - LOOKBEHIND), m.index);
    // Keep only what follows the last contrastive turn — anything before it
    // belongs to the clause being contradicted, not to this claim.
    const contrasts = [...before.matchAll(CONTRAST_RE)];
    const lastContrast = contrasts[contrasts.length - 1];
    if (lastContrast?.index !== undefined) {
      before = before.slice(lastContrast.index + lastContrast[0].length);
    }
    if (NEGATOR_RE.test(before)) continue;
    // Постпозитивное отрицание: «удержания нет». Смотрим короткий хвост до
    // первой запятой — дальше отрицание уже относится к другому члену.
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 30).split(",")[0];
    if (POST_NEGATOR_RE.test(after)) continue;
    return true;
  }
  return false;
}

/** True when the text negates every occurrence of the pattern (and has at least one). */
export function mentionsOnlyNegated(text: string, pattern: RegExp): boolean {
  if (!text) return false;
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const found = [...text.matchAll(re)];
  return found.length > 0 && !mentionsUnnegated(text, pattern);
}
