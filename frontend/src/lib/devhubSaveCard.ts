/**
 * Карточка «Сайт живой — сохраните его и получите своё имя» после адреса гостя DevHub
 * (волна 132б, 13.10.2026). Замер пути из Shorts: гость доходит до адреса за 44–60 с, а
 * следующего шага в кадре нет — ни имени, ни «сохранить». Карточка просит почту и шлёт её в
 * существующий лист ожидания (source devhub-guest + projectId), письмо уходит на data@.
 */
export const DEVHUB_SAVE_SOURCE = "devhub-guest";
export const DEVHUB_SAVE_FEATURE = "devhub_save_email";

/** Показывать, пока есть живой адрес и почта ещё не оставлена. */
export function pokazyvatKartochkuSokhraneniya(a: { address: string | null | undefined; saved: boolean }): boolean {
  if (a.saved) return false;
  return typeof a.address === "string" && /^https?:\/\/\S+/.test(a.address);
}

export function klyuchSokhraneniya(projectId: string): string {
  return `devhub_save_email_${projectId}`;
}

/** Канал для листа ожидания: только то, что пройдёт схему (строчные, ≤24). */
export function kanalDlyaLista(post: string | null | undefined): string | undefined {
  return post && /^[a-z0-9_-]{1,24}$/.test(post) ? post : undefined;
}
