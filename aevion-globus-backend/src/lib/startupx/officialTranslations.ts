/**
 * Официальные переводы заявок самой AEVION на бирже (только они).
 * Переводит команда AEVION. Публикованный текст заявки заморожен, а contentHash
 * считается от русского оригинала: этот файл их не трогает и в базу ничего не пишет.
 * Перевод подставляется только в ответ GET при ?lang=en; чужие заявки не переводятся.
 */
export interface OfficialTranslation {
  title: string;
  description: string;
}

export const OFFICIAL_TRANSLATIONS: Record<number, { en: OfficialTranslation }> = {
  21: {
    en: {
      title: "AEVION — a planet of modules on a shared trust layer",
      description:
        "Who it is for: small and medium businesses, authors and developers in Kazakhstan and Central Asia. " +
        "Problem: authors' rights, signatures, contracts and AI tools currently have to be pieced together from scattered services, " +
        "while proof of authorship and priority is kept by hand and gets lost. " +
        "How it works: AEVION is a platform of modules on a shared trust layer, with integration between them: " +
        "authorship (QRight), signature (QSign), registry and certificates (Bureau), apps from a description (DevHub), " +
        "parallel AI agents (Multichat), idea analysis (QVenture), air corridors (QSkyway). " +
        "On September 20, 2026 eight modules open at once. " +
        "Monetization: subscription — Lite $19, Medium $29, Full $49, Universe $149 per month, and Enterprise plans; " +
        "paid add-on modules from $9 per month (32 of 44 modules). " +
        "Unlike a set of scattered competitor services, the modules rest on a single circuit: " +
        "the author's record, signature and certificate are verified through one link. " +
        "We are looking for an investor to launch the modules and enter the Central Asian markets. " +
        "Every number on the site comes from the module's own response, not from a presentation.",
    },
  },
};

export type ListingLike = { id: number; title: string; description: string };

/** Перевод для заявки или null. */
export function officialTranslationFor(id: number, lang: string): OfficialTranslation | null {
  if (lang !== "en") return null;
  if (!Object.prototype.hasOwnProperty.call(OFFICIAL_TRANSLATIONS, id)) return null;
  return OFFICIAL_TRANSLATIONS[id].en;
}

/** Без перевода возвращает тот же объект (байт в байт), с переводом — копию с подменой. */
export function withOfficialTranslation<T extends ListingLike>(view: T, lang: string): T | (T & { translated: true; originalLang: "ru" }) {
  const tr = officialTranslationFor(view.id, lang);
  if (!tr) return view;
  return { ...view, title: tr.title, description: tr.description, translated: true as const, originalLang: "ru" as const };
}
