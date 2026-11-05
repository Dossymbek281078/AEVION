/**
 * Официальные переводы заявок самой AEVION на бирже (только они).
 * Переводит команда AEVION. Публикованный текст заявки заморожен, а contentHash
 * считается от русского оригинала: этот файл их не трогает и в базу ничего не пишет.
 * Перевод подставляется только в ответ GET при ?lang=en; чужие заявки не переводятся.
 * contentHash (content_hash в ответе) — от исходного русского текста в базе, а не от показанного:
 * правка ru-фразы и перевод его не меняют; страница заявки хеш только показывает и по тексту не сверяет.
 */
export interface OfficialTranslation {
  title: string;
  description: string;
  geography?: string;
}

export const OFFICIAL_TRANSLATIONS: Record<number, { en: OfficialTranslation }> = {
  21: {
    en: {
      geography: "Kazakhstan, Astana",
      title: "AEVION — a planet of modules on a shared trust layer",
      description:
        "Who it is for: small and medium businesses, authors and developers in Kazakhstan and Central Asia. " +
        "Problem: authors' rights, signatures, contracts and AI tools currently have to be pieced together from scattered services, " +
        "while proof of authorship and priority is kept by hand and gets lost. " +
        "How it works: AEVION is a platform of modules on a shared trust layer, with integration between them: " +
        "authorship (QRight), signature (QSign), registry and certificates (Bureau), apps from a description (DevHub), " +
        "parallel AI agents (Multichat), idea analysis (QVenture), air corridors (QSkyway). " +
        "On September 20, 2026 eight modules opened at once. " +
        "Monetization: subscription — Lite $19, Medium $29, Full $49, Universe $149 per month, and Enterprise; " +
        "paid add-on modules from $9 per month (32 of 44 modules). " +
        "Unlike a set of scattered competitor services, the modules rest on one shared core: " +
        "the author's record, signature and certificate are verified through one link. " +
        "We are looking for an investor to launch the modules and enter the Central Asian markets. " +
        "Every number on the site comes from the module's own response, not from a presentation.",
    },
  },
};

/**
 * Поправка русского показа (lang=ru и без lang): текст в базе заморожен, меняется только ответ GET.
 * Фраза про 20 сентября 2026 — в прошедшем времени, остальное слово в слово.
 */
export const OFFICIAL_RU_FIXES: Record<number, { description: Array<[string, string]> }> = {
  21: {
    description: [
      ["20 сентября 2026 открываются восемь модулей разом", "20 сентября 2026 открылись восемь модулей разом"],
    ],
  },
};

export type ListingLike = { id: number; title: string; description: string; geography?: string | null };

/** Перевод для заявки или null. */
export function officialTranslationFor(id: number, lang: string): OfficialTranslation | null {
  if (lang !== "en") return null;
  if (!Object.prototype.hasOwnProperty.call(OFFICIAL_TRANSLATIONS, id)) return null;
  return OFFICIAL_TRANSLATIONS[id].en;
}

/** Без перевода возвращает тот же объект (байт в байт), с переводом — копию с подменой. */
export function withOfficialTranslation<T extends ListingLike>(view: T, lang: string): T | (T & { translated: true; originalLang: "ru" }) {
  const tr = officialTranslationFor(view.id, lang);
  if (!tr) {
    if (lang === "en" || !Object.prototype.hasOwnProperty.call(OFFICIAL_RU_FIXES, view.id)) return view;
    let description = view.description;
    for (const [from, to] of OFFICIAL_RU_FIXES[view.id].description) description = description.split(from).join(to);
    return description === view.description ? view : { ...view, description };
  }
  return {
    ...view,
    title: tr.title,
    description: tr.description,
    ...(tr.geography !== undefined ? { geography: tr.geography } : {}),
    translated: true as const,
    originalLang: "ru" as const,
  };
}
