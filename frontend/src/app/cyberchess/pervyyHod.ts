import { track } from "@/lib/track";

/**
 * «Первый ход сделан» — ступень между «попробовали» и «решил».
 *
 * Повод 12.10.2026 (воронка 14 дней, канал youtube): 167 живых заходов на
 * /cyberchess?puzzle=, 1 живое решение. Ступень «попробовали» уходит АВТОМАТОМ
 * при заходе по ссылке (22 из 22 сессий — см. память про отправителей событий),
 * поэтому между приходом и решением не было ни одной ступени, которую делает
 * ЧЕЛОВЕК. Нельзя было сказать, трогал ли он доску вообще: не понял, что ходить
 * надо; не смог (ввод); или ходил и ошибался. Это событие отвечает на первый
 * вопрос; на третий отвечает puzzle_wrong_move.
 *
 * Считается один раз на контекст: на задачу — по её id (ключ `pz:<id>`), на
 * партию — ключ `game`, который newG сбрасывает. Многоходовая задача после
 * ответа соперника остаётся той же задачей — второй ход не «первый».
 */
export type PamyatPervogoHoda = { current: string };

export type KontekstPervogoHoda = "puzzle" | "game";

export function klyuchPervogoHoda(kontekst: KontekstPervogoHoda, puzzleId?: string | null): string {
  return kontekst === "puzzle" ? `pz:${puzzleId ?? ""}` : "game";
}

/**
 * Шлёт событие, если для этого ключа ещё не слали. Возвращает true, если
 * отправило — тесту и приёмке важно именно это, а не «вызвали».
 * `otpravit` подменяется в тесте; в проде — общий track().
 */
export function otmetitPervyyHod(
  pamyat: PamyatPervogoHoda,
  kontekst: KontekstPervogoHoda,
  puzzleId?: string | null,
  otpravit: typeof track = track,
): boolean {
  const klyuch = klyuchPervogoHoda(kontekst, puzzleId);
  if (pamyat.current === klyuch) return false;
  pamyat.current = klyuch;
  otpravit({
    type: "feature_use",
    source: "cyberchess/board",
    meta: { feature: "first_move", app: "cyberchess", kontekst },
  });
  return true;
}
