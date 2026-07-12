/**
 * Kids AI — content safety layer (defense-in-depth).
 *
 * The `POST /api/kids-ai/ask` endpoint sends a child's free-text question to an
 * LLM. A system prompt is the first guard, but a system prompt alone can be
 * defeated by prompt-injection inside the question. For a product aimed at
 * 5-8 year olds we add two more layers:
 *
 *   1. INPUT screening  — if the child's question hits a clear-harm topic we
 *      never call the LLM at all; we return a gentle "ask a grown-up" reply.
 *      (Guaranteed-safe AND saves the LLM spend.)
 *   2. OUTPUT screening — if a model reply somehow contains a blocked term we
 *      replace it with the same gentle reply.
 *
 * Design bias: for a kids product, OVER-blocking is the safe failure mode — a
 * false positive just tells the child to ask a parent. So the matcher favours
 * recall, but the stem list is curated to avoid egregious false positives on
 * innocent kid vocabulary (warm, skill, scissors/ножницы, grapes/виноград,
 * head/голова, soccer-goal/гол, dragon/дракон).
 *
 * Boundary handling: JS `\b` is ASCII-only and breaks on Cyrillic, so each stem
 * is matched as a word-prefix preceded by a non-letter (or start) and followed
 * by any letters — this catches inflections (наркотик→наркотики) while a
 * leading letter (skill→"kill") blocks mid-word hits.
 */

export type KidsLang = "ru" | "en" | "kz";

// Curated clear-harm stems. Each is a *word prefix*: it matches the stem plus
// any trailing letters, but only when preceded by a non-letter or line start.
// Kept deliberately conservative — see the false-positive notes in the header.
const UNSAFE_STEMS: string[] = [
  // ─ weapons / violence (en)
  "gun", "shoot", "weapon", "knife", "knive", "kill", "murder", "bomb", "grenade",
  // ─ weapons / violence (ru) — no "нож" (→ножницы), no "стрел" (→стрелка), no "драк" (→дракон)
  // "уби*" forms are enumerated (убить/убил/убит/убьёт) rather than a bare
  // "уби" stem, which would wrongly catch убирать / уборка (tidy up).
  "оруж", "пистолет", "ружь", "граната", "бомб",
  "убий", "убей", "убива", "убить", "убил", "убит", "убь", "войн",
  // ─ weapons / violence (kz)
  "қару", "мылтық", "пышақ", "өлтір", "соғыс",
  // ─ drugs / alcohol / tobacco (en)
  "drug", "cocaine", "heroin", "weed", "alcohol", "beer", "vodka", "whiskey",
  "drunk", "cigarette", "vape", "smok",
  // ─ drugs / alcohol / tobacco (ru) — no "вино" (→виноград)
  "наркотик", "героин", "кокаин", "алкогол", "водк", "пиво", "сигарет",
  "куриль", "вейп", "табак", "пьян",
  // ─ drugs / alcohol / tobacco (kz)
  "есірткі", "арақ", "темекі",
  // ─ sexual / adult (en)
  "sex", "porn", "nude", "naked", "penis", "vagina",
  // ─ sexual / adult (ru) — "голы" not "гол" (→голова/голос/гол)
  "секс", "порн", "обнаж", "голы", "гениталь", "пенис",
  // ─ sexual / adult (kz)
  "жыныс порн",
  // ─ self-harm / suicide (en) — explicit only; plain "die" is left to the system prompt
  "suicide", "kill myself", "cut myself",
  // ─ self-harm / suicide (ru)
  "суицид", "самоуб", "порезать себя",
];

// Build one matcher per stem. `u` flag for correct unicode letter classes.
// Preceded by start-or-nonletter, then the stem, then any letters.
const LETTER = "[a-zа-яёқғңүұһөәі]";
const UNSAFE_RES: RegExp[] = UNSAFE_STEMS.map((stem) => {
  const s = stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^${LETTER.slice(1, -1)}])${s}${LETTER}*`, "iu");
});

/**
 * Returns true if the text contains a clear-harm term. Case-insensitive,
 * inflection-aware, boundary-guarded against innocent-word collisions.
 */
export function containsUnsafe(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  for (const re of UNSAFE_RES) {
    if (re.test(t)) return true;
  }
  return false;
}

/**
 * Gentle, age-appropriate redirect shown when input or output is blocked.
 * Deliberately warm and non-scary — never names the blocked topic.
 */
export function gentleRedirect(lang: KidsLang): string {
  if (lang === "en") {
    return "That's a big-kid question — let's ask a grown-up you trust! 😊 " +
      "Want to try a question about animals, space, or numbers instead?";
  }
  if (lang === "kz") {
    return "Бұл сұрақты сенетін үлкен адамнан сұраған дұрыс! 😊 " +
      "Жануарлар, ғарыш немесе сандар туралы сұрап көрейік пе?";
  }
  return "Это лучше спросить у взрослого, которому ты доверяешь! 😊 " +
    "А хочешь, спросим про животных, космос или числа?";
}
