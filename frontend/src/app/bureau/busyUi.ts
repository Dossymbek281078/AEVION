// Busy-ярлыки Bureau — словарём, один на модуль (класс «busy быстрее
// доводчика», назначение 07.09, рецепт GEN_UI.busy*). Зеркальный случай:
// страницы англоязычные, busy-секунды по-английски видел русский
// посетитель. Idle-подписи не трогаем — стабильный текст кроет доводчик.
export const BU_BUSY: Record<
  string,
  { creating: string; sendingInvite: string; claiming: string; hashing: string; searching: string }
> = {
  en: {
    creating: "Creating…",
    sendingInvite: "Sending…",
    claiming: "Claiming…",
    hashing: "Computing SHA-256…",
    searching: "Searching registry…",
  },
  ru: {
    creating: "Создаю…",
    sendingInvite: "Отправляю…",
    claiming: "Забираю…",
    hashing: "Считаю SHA-256…",
    searching: "Ищу в реестре…",
  },
  kk: {
    creating: "Құрылуда…",
    sendingInvite: "Жіберілуде…",
    claiming: "Алынуда…",
    hashing: "SHA-256 есептелуде…",
    searching: "Тізілімнен ізделуде…",
  },
};
