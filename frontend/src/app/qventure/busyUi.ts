// Busy-ярлыки QVenture — словарём, один на модуль (класс «busy быстрее
// доводчика», назначение 07.09, рецепт GEN_UI.busy*). Случай смешанный:
// на главной busy по-русски (видел EN-посетитель), в batch — по-английски
// (видел русский). Idle-подписи не трогаем — кроет доводчик.
export const QV_BUSY: Record<
  string,
  { analyzing: string; extracting: string; parsing: string; parsingBoth: string }
> = {
  ru: { analyzing: "Анализирую…", extracting: "Читаем презентацию…", parsing: "Разбираем…", parsingBoth: "Разбираем оба…" },
  en: { analyzing: "Analyzing…", extracting: "Reading the deck…", parsing: "Analyzing…", parsingBoth: "Analyzing both…" },
  kk: { analyzing: "Талдануда…", extracting: "Презентация оқылуда…", parsing: "Талдануда…", parsingBoth: "Екеуі де талдануда…" },
};
