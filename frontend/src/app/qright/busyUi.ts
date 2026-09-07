// Busy-ярлыки QRight — словарём (класс «busy быстрее доводчика»,
// назначение 07.09, рецепт GEN_UI.busy*). Один словарь на модуль:
// три файла страниц берут его отсюда, чтобы переводы не разъехались.
// Страницы англоязычные — зеркальный случай: busy-секунды по-английски
// видел русский посетитель. Idle-подписи не трогаем (кроет доводчик).
export const QR_BUSY: Record<
  string,
  { adding: string; revoking: string; saving: string; retrying: string }
> = {
  en: { adding: "Adding…", revoking: "Revoking…", saving: "Saving…", retrying: "Retrying…" },
  ru: { adding: "Добавляю…", revoking: "Отзываю…", saving: "Сохраняю…", retrying: "Повторяю…" },
  kk: { adding: "Қосылуда…", revoking: "Кері қайтарылуда…", saving: "Сақталуда…", retrying: "Қайталануда…" },
};
