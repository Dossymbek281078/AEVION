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
