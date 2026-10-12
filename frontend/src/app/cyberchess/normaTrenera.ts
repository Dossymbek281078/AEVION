/**
 * Что тренер говорит, когда сервер ответил 402 «норма на сегодня исчерпана».
 *
 * Повод 13.10.2026: спящая норма FREE_COACH_PER_DAY на бэкенде. До этого любой
 * не-ok от /api/coach/chat уходил в общий catch и подменялся ответом Stockfish —
 * человек не узнал бы ни о норме, ни о тарифе. Здесь отказ показывается
 * отказом: текст сервера и ссылка на подписку, без выдуманного хода.
 */
export const ССЫЛКА_НА_ТАРИФ_ШАХМАТ = "/pricing?app=cyberchess";

export function soobschenieONorme(
  otvet: { message?: unknown; upgradeUrl?: unknown; limit?: unknown } | null | undefined,
  origin: string,
): string {
  const текст = typeof otvet?.message === "string" && otvet.message.trim()
    ? otvet.message.trim()
    : "Бесплатная норма тренера на сегодня исчерпана.";
  const путь = typeof otvet?.upgradeUrl === "string" && otvet.upgradeUrl.startsWith("/") ? otvet.upgradeUrl : ССЫЛКА_НА_ТАРИФ_ШАХМАТ;
  return `🔒 ${текст}\n\nПодписка CyberChess снимает ограничение: ${origin}${путь}\n\nПартия, задачи и движок работают без нормы.`;
}
