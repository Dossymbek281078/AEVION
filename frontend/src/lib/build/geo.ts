// Location + work-mode taxonomy for QBuild search/profile forms.
// Mirrors the WORK_MODES/EDUCATION_LEVELS/WORK_REGIONS_KZ constants in
// aevion-globus-backend/src/lib/build/index.ts (kept in sync manually —
// frontend and backend are separate packages, same pattern as
// ShiftPreference/AvailabilityType already duplicated in lib/build/api.ts).

export type WorkMode = "ON_SITE" | "REMOTE" | "HYBRID" | "FIELD_WORK" | "FLY_IN_FLY_OUT";
export const WORK_MODES: WorkMode[] = ["ON_SITE", "REMOTE", "HYBRID", "FIELD_WORK", "FLY_IN_FLY_OUT"];
export const WORK_MODE_LABELS: Record<WorkMode, string> = {
  ON_SITE: "На объекте",
  REMOTE: "Удалённо",
  HYBRID: "Гибрид",
  FIELD_WORK: "Разъездная работа",
  FLY_IN_FLY_OUT: "Вахта",
};

export type EducationLevel = "SECONDARY" | "VOCATIONAL" | "BACHELOR" | "MASTER" | "OTHER";
export const EDUCATION_LEVELS: EducationLevel[] = ["SECONDARY", "VOCATIONAL", "BACHELOR", "MASTER", "OTHER"];
export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  SECONDARY: "Среднее",
  VOCATIONAL: "Среднее специальное / колледж",
  BACHELOR: "Бакалавриат",
  MASTER: "Магистратура",
  OTHER: "Другое",
};

export const WORK_REGIONS_KZ: { slug: string; label: string }[] = [
  { slug: "almaty-city", label: "Алматы" },
  { slug: "astana-city", label: "Астана" },
  { slug: "shymkent-city", label: "Шымкент" },
  { slug: "abai", label: "Абайская область" },
  { slug: "akmola", label: "Акмолинская область" },
  { slug: "aktobe", label: "Актюбинская область" },
  { slug: "almaty-region", label: "Алматинская область" },
  { slug: "atyrau", label: "Атырауская область" },
  { slug: "east-kazakhstan", label: "Восточно-Казахстанская область" },
  { slug: "zhambyl", label: "Жамбылская область" },
  { slug: "zhetysu", label: "Жетысуская область" },
  { slug: "west-kazakhstan", label: "Западно-Казахстанская область" },
  { slug: "karaganda", label: "Карагандинская область" },
  { slug: "kostanay", label: "Костанайская область" },
  { slug: "kyzylorda", label: "Кызылординская область" },
  { slug: "mangystau", label: "Мангистауская область" },
  { slug: "pavlodar", label: "Павлодарская область" },
  { slug: "north-kazakhstan", label: "Северо-Казахстанская область" },
  { slug: "turkestan", label: "Туркестанская область" },
  { slug: "ulytau", label: "Улытауская область" },
];

export function regionLabel(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return WORK_REGIONS_KZ.find((r) => r.slug === slug)?.label ?? slug;
}

/*
 * Подписи по языку страницы (29.10.2026). До этого регионы, режим работы и образование
 * показывались только по-русски при любом языке сайта. Значение, уходящее на сервер
 * (slug / WorkMode / EducationLevel), не меняется — переводится только подпись.
 * ⚠️ kk — черновик, нужна вычитка носителя. Язык без словаря → en.
 */
type GeoLang = "ru" | "en" | "kk";
function geoLang(lang: string | null | undefined): GeoLang {
  return lang === "ru" || lang === "kk" ? lang : "en";
}

export const REGION_LABELS: Record<GeoLang, Record<string, string>> = {
  ru: Object.fromEntries(WORK_REGIONS_KZ.map((r) => [r.slug, r.label])),
  en: {
    "almaty-city": "Almaty",
    "astana-city": "Astana",
    "shymkent-city": "Shymkent",
    abai: "Abai Region",
    akmola: "Akmola Region",
    aktobe: "Aktobe Region",
    "almaty-region": "Almaty Region",
    atyrau: "Atyrau Region",
    "east-kazakhstan": "East Kazakhstan Region",
    zhambyl: "Zhambyl Region",
    zhetysu: "Zhetysu Region",
    "west-kazakhstan": "West Kazakhstan Region",
    karaganda: "Karaganda Region",
    kostanay: "Kostanay Region",
    kyzylorda: "Kyzylorda Region",
    mangystau: "Mangystau Region",
    pavlodar: "Pavlodar Region",
    "north-kazakhstan": "North Kazakhstan Region",
    turkestan: "Turkestan Region",
    ulytau: "Ulytau Region",
  },
  kk: {
    "almaty-city": "Алматы",
    "astana-city": "Астана",
    "shymkent-city": "Шымкент",
    abai: "Абай облысы",
    akmola: "Ақмола облысы",
    aktobe: "Ақтөбе облысы",
    "almaty-region": "Алматы облысы",
    atyrau: "Атырау облысы",
    "east-kazakhstan": "Шығыс Қазақстан облысы",
    zhambyl: "Жамбыл облысы",
    zhetysu: "Жетісу облысы",
    "west-kazakhstan": "Батыс Қазақстан облысы",
    karaganda: "Қарағанды облысы",
    kostanay: "Қостанай облысы",
    kyzylorda: "Қызылорда облысы",
    mangystau: "Маңғыстау облысы",
    pavlodar: "Павлодар облысы",
    "north-kazakhstan": "Солтүстік Қазақстан облысы",
    turkestan: "Түркістан облысы",
    ulytau: "Ұлытау облысы",
  },
};

export const WORK_MODE_LABELS_BY_LANG: Record<GeoLang, Record<WorkMode, string>> = {
  ru: WORK_MODE_LABELS,
  en: { ON_SITE: "On site", REMOTE: "Remote", HYBRID: "Hybrid", FIELD_WORK: "Field work", FLY_IN_FLY_OUT: "Rotational shifts" },
  kk: { ON_SITE: "Нысанда", REMOTE: "Қашықтан", HYBRID: "Аралас", FIELD_WORK: "Жүріп-тұрып жұмыс", FLY_IN_FLY_OUT: "Вахталық әдіс" },
};

export const EDUCATION_LEVEL_LABELS_BY_LANG: Record<GeoLang, Record<EducationLevel, string>> = {
  ru: EDUCATION_LEVEL_LABELS,
  en: { SECONDARY: "Secondary school", VOCATIONAL: "Vocational / college", BACHELOR: "Bachelor's degree", MASTER: "Master's degree", OTHER: "Other" },
  kk: { SECONDARY: "Орта білім", VOCATIONAL: "Арнаулы орта / колледж", BACHELOR: "Бакалавриат", MASTER: "Магистратура", OTHER: "Басқа" },
};

/** Подпись региона на языке страницы; неизвестный slug показывается как есть. */
export function regionLabelIn(slug: string | null | undefined, lang: string | null | undefined): string | null {
  if (!slug) return null;
  return REGION_LABELS[geoLang(lang)][slug] ?? slug;
}

export function workModeLabelIn(mode: string | null | undefined, lang: string | null | undefined): string | null {
  if (!mode) return null;
  return WORK_MODE_LABELS_BY_LANG[geoLang(lang)][mode as WorkMode] ?? mode;
}

export function educationLabelIn(level: string | null | undefined, lang: string | null | undefined): string | null {
  if (!level) return null;
  return EDUCATION_LEVEL_LABELS_BY_LANG[geoLang(lang)][level as EducationLevel] ?? level;
}
