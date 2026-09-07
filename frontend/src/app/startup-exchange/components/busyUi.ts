// Busy-ярлыки биржи стартапов — словарём, один на модуль (класс «busy
// быстрее доводчика», назначение 07.09, рецепт GEN_UI.busy*). Здесь прямой
// случай: страницы русскоязычные, busy-секунды по-русски видел EN-посетитель
// (страница волны 10.09). Idle-подписи не трогаем — кроет доводчик.
export const SX_BUSY: Record<
  string,
  { saving: string; sending: string; computing: string; publishing: string }
> = {
  ru: { saving: "Сохраняю…", sending: "Отправляю…", computing: "Считаю…", publishing: "Публикую…" },
  en: { saving: "Saving…", sending: "Sending…", computing: "Computing…", publishing: "Publishing…" },
  kk: { saving: "Сақталуда…", sending: "Жіберілуде…", computing: "Есептелуде…", publishing: "Жариялануда…" },
};
