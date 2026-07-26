/**
 * StartupX — guessing the sector from the description
 * ───────────────────────────────────────────────────
 * The submit form offers "Определить автоматически" as the default. Nothing
 * used to do the determining: an unset sector resolved straight to the generic
 * fallback, whose own source note reads "no sector-specific report". So the
 * founder who trusted the default got market numbers explicitly documented as
 * *not* being about their market — and the screen said the opposite.
 *
 * This closes that gap honestly. It is a keyword vote, not a classifier: it
 * says which sector the words point at, how strongly, and whether it was sure.
 * When it is not sure it returns `other` and the analysis says so, instead of
 * quietly presenting a fallback as a finding.
 *
 * Keywords are bilingual — most founders here write in Russian, and a detector
 * that only reads English would push every Russian listing into the fallback,
 * which is the same failure in a new coat.
 */

import { listSectors, resolveSector, type SectorProfile } from "../qventure/sectors";

/**
 * Sector ids that actually exist. Needed because the shared resolver looks up
 * its table with `SECTORS[key]`, and every JavaScript object answers to
 * `constructor`, `toString`, `valueOf` and `__proto__`. Measured: a listing
 * submitted with sector "constructor" came back with label `undefined`,
 * TAM `undefined` and a market score of 0 — a confidently wrong analysis with
 * nothing failing anywhere.
 *
 * Anything the resolver returns is checked against this set before it is
 * allowed to stand for a market.
 */
const KNOWN_SECTOR_IDS = new Set(listSectors().map((s) => s.id));

/** The resolver's answer, or null when the input names no real sector. */
export function safeResolveSector(input: string | undefined): SectorProfile | null {
  const resolved = resolveSector(input) as SectorProfile | undefined;
  if (!resolved || typeof resolved.id !== "string" || !KNOWN_SECTOR_IDS.has(resolved.id)) return null;
  return resolved;
}

/** The generic fallback profile — always a real row. */
function fallbackSector(): SectorProfile {
  return safeResolveSector("other") ?? (resolveSector("other") as SectorProfile);
}

/** Unicode-aware left boundary — `\b` never matches before a Cyrillic letter. */
const EDGE = "(?<![\\p{L}\\p{N}_])";

function cues(...words: string[]): RegExp {
  return new RegExp(`${EDGE}(?:${words.join("|")})`, "giu");
}

/**
 * Two or more distinct cues from one sector beat a single mention, so a fintech
 * plan that says "как Uber для платежей" is not filed under logistics.
 */
const SECTOR_CUES: Record<string, RegExp> = {
  fintech: cues(
    "платеж", "эквайринг", "банк", "кредит", "займ", "страхован", "инвестиц", "брокер", "кошел[её]к",
    "транзакц", "комисси[яю] за перевод", "финтех",
    "fintech", "payments?", "banking", "lending", "credit", "insurance", "wallet", "neobank", "acquiring",
  ),
  healthtech: cues(
    "пациент", "клиник", "врач", "диагност", "медицин", "телемедицин", "здоровь", "госпитал",
    "healthtech", "patients?", "clinics?", "telehealth", "medical", "diagnosis", "ehr", "hospital",
  ),
  biotech: cues(
    "препарат", "молекул", "клиническ(?:ое|их) исследован", "терапи", "геном", "биотех", "вакцин",
    "biotech", "therapeutics?", "clinical trials?", "molecule", "genomic", "drug discovery", "vaccine",
  ),
  climate: cues(
    "углеродн", "выбросы co2", "солнечн(?:ая|ые) панел", "ветрогенератор", "энергоэффективн",
    "возобновляем", "переработк[аи] отходов",
    "carbon", "emissions", "renewable", "solar", "wind (?:power|farm)", "battery storage", "cleantech",
  ),
  ai_infra: cues(
    "инференс", "векторн(?:ая|ой) баз", "обучение модел", "gpu", "мл-?платформ", "mlops",
    "inference", "vector (?:db|database)", "model training", "fine-?tun", "llm ops", "mlops", "gpu cluster",
  ),
  ai_app: cues(
    "ии-?ассистент", "ai-?ассистент", "ии-?помощник", "ai-?помощник", "нейросет", "нейронн(?:ая|ой) сет",
    "генери(?:рует|руем) текст", "чат-?бот",
    "распознаван", "ai (?:assistant|copilot|agent)", "gpt", "chatbot", "generative",
  ),
  cybersecurity: cues(
    "кибербезопасн", "уязвимост", "шифрован", "фишинг", "антивирус", "соответстви[ея] требованиям безопасн",
    "cybersecurity", "vulnerabilit", "encryption", "phishing", "zero trust", "penetration test", "soc 2",
  ),
  edtech: cues(
    "студент", "ученик", "курс", "обучен", "школ", "университет", "тренаж[её]р", "экзамен",
    "edtech", "students?", "courses?", "learning", "school", "university", "training", "exam",
  ),
  logistics: cues(
    "перевозчик", "груз", "склад", "доставк", "логистик", "маршрут", "фур", "цепочк[аи] поставок",
    "logistics", "freight", "cargo", "warehouse", "delivery", "shipping", "supply chain", "carriers?",
  ),
  proptech: cues(
    "недвижимост", "аренд[аы] квартир", "жиль[ёе]", "застройщик", "риэлтор", "объект[аы] недвижимости",
    "proptech", "real estate", "rentals?", "landlord", "tenant", "property manage",
  ),
  ecommerce: cues(
    "интернет-?магазин", "товар", "корзин[аы]", "чек[- ]?аут", "маркетплейс товаров", "розниц",
    "e-?commerce", "online store", "checkout", "dtc", "retail", "shopify",
  ),
  marketplace: cues(
    "маркетплейс", "площадк[аи] где", "исполнител(?:и|ей) и заказчик", "свод(?:им|ит) продавц",
    "комисси[яю] с сделк", "двусторонн(?:ий|яя) рынок",
    "marketplace", "two-?sided", "buyers? and sellers?", "take rate", "matching supply",
  ),
  gaming: cues(
    "игрок", "игров(?:ая|ой|ые)", "гейм", "турнир", "киберспорт",
    "gaming", "players?", "game", "esports", "tournament",
  ),
  agtech: cues(
    "фермер", "урожай", "агро", "посев", "теплиц", "животноводств", "продукт(?:ы|ов) питания",
    "agtech", "farmers?", "crop", "harvest", "greenhouse", "food production",
  ),
  space: cues(
    "спутник", "орбит", "ракет", "космическ", "дрон[ыа] дальн",
    "satellites?", "orbital", "launch vehicle", "aerospace", "space",
  ),
  consumer: cues(
    "социальн(?:ая|ой) сет", "лент[аы] контента", "подписчик", "блогер", "стрим",
    "social (?:app|network)", "creators?", "followers?", "influencer", "community app",
  ),
  saas: cues(
    "b2b", "корпоративн(?:ый|ые) клиент", "рабочий процесс", "crm", "erp", "интеграц[ияи] с",
    "saas", "workflow", "dashboard for teams", "per seat", "enterprise software",
  ),
};

export interface SectorDetection {
  sector: SectorProfile;
  /** Where the sector came from — surfaced in the analysis, never hidden. */
  origin: "declared" | "detected" | "fallback";
  /** Distinct cue words that voted for the winner (empty when not detected). */
  evidence: string[];
}

/** Distinct matched cues, deduplicated and lowercased. */
function countCues(text: string, re: RegExp): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) seen.add(m[0].toLowerCase());
  return Array.from(seen);
}

/**
 * Pick the sector for a listing.
 *
 * A declared sector always wins — the founder knows their market better than a
 * keyword list. Detection needs at least two distinct cues and a clear lead
 * over the runner-up; anything weaker is reported as a fallback rather than
 * dressed up as a finding.
 */
export function detectSector(declared: string | undefined, description: string): SectorDetection {
  if (declared && declared.trim()) {
    const resolved = safeResolveSector(declared);
    // The resolver answers `other` for anything it does not recognise, and an
    // object-prototype key (constructor, __proto__) makes it answer with
    // something that is not a sector at all. Neither may be presented as the
    // founder's choice.
    if (resolved && resolved.id !== "other") return { sector: resolved, origin: "declared", evidence: [] };
  }

  const text = description ?? "";
  if (!text.trim()) return { sector: fallbackSector(), origin: "fallback", evidence: [] };

  const scored = Object.entries(SECTOR_CUES)
    .map(([id, re]) => ({ id, hits: countCues(text, re) }))
    .filter((s) => s.hits.length > 0)
    .sort((a, b) => b.hits.length - a.hits.length);

  const best = scored[0];
  const runnerUp = scored[1];
  const decisive = Boolean(
    best && best.hits.length >= 2 && (!runnerUp || best.hits.length > runnerUp.hits.length),
  );

  if (!decisive) {
    return { sector: fallbackSector(), origin: "fallback", evidence: best?.hits ?? [] };
  }
  return {
    sector: safeResolveSector(best.id) ?? fallbackSector(),
    origin: "detected",
    evidence: best.hits.slice(0, 5),
  };
}
