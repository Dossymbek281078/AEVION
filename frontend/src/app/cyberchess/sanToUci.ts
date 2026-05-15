// SAN <-> UCI conversion helpers for Lichess Opening Explorer integration.
//
// The Lichess Explorer `play=` param expects UCI move list (e.g. "e2e4,e7e5,g1f3").
// Our RepertoireBranch.moves stores SAN (human-readable, e.g. "e4", "e5", "Nf3").
// These helpers bridge the two formats using chess.js (already in repo deps).

import { Chess } from "chess.js";

export type ChessMoveLite = {
  from: string;
  to: string;
  promotion?: string;
};

/**
 * Convert an array of SAN moves to UCI move strings.
 *
 * Each UCI string is `from + to (+ promotion?)`, e.g. "e2e4", "e7e8q".
 *
 * @param sanMoves Array of SAN moves like ["e4", "e5", "Nf3"]
 * @param startFen Optional starting FEN (defaults to standard startpos)
 * @returns Array of UCI strings. May be SHORTER than input if some SAN is invalid
 *          (invalid SAN is skipped with a console.warn and conversion stops there
 *          since chess.js position is no longer valid for subsequent moves).
 */
export function sanToUci(sanMoves: string[], startFen?: string): string[] {
  const chess = startFen ? new Chess(startFen) : new Chess();
  const uci: string[] = [];

  for (let i = 0; i < sanMoves.length; i++) {
    const san = sanMoves[i];
    try {
      const m = chess.move(san);
      if (!m) {
        // eslint-disable-next-line no-console
        console.warn(`[sanToUci] Invalid SAN at index ${i}: "${san}" — stopping conversion.`);
        break;
      }
      const promo = m.promotion ? m.promotion : "";
      uci.push(`${m.from}${m.to}${promo}`);
    } catch (e) {
      // chess.js throws on invalid SAN in some versions
      // eslint-disable-next-line no-console
      console.warn(
        `[sanToUci] chess.move threw for SAN at index ${i}: "${san}" — stopping conversion.`,
        e
      );
      break;
    }
  }

  return uci;
}

/**
 * Convert an array of UCI moves back to SAN.
 *
 * Useful for importing foreign repertoires that store UCI, or when displaying
 * raw UCI from Lichess data in human-readable form.
 *
 * @param uciMoves Array of UCI moves like ["e2e4", "e7e5", "g1f3"]
 * @param startFen Optional starting FEN (defaults to standard startpos)
 * @returns Array of SAN strings. May be SHORTER than input if some UCI is invalid.
 */
export function uciToSan(uciMoves: string[], startFen?: string): string[] {
  const chess = startFen ? new Chess(startFen) : new Chess();
  const san: string[] = [];

  for (let i = 0; i < uciMoves.length; i++) {
    const u = uciMoves[i];
    if (!u || u.length < 4) {
      // eslint-disable-next-line no-console
      console.warn(`[uciToSan] Invalid UCI at index ${i}: "${u}" — stopping conversion.`);
      break;
    }
    const from = u.slice(0, 2);
    const to = u.slice(2, 4);
    const promotion = u.length > 4 ? u.slice(4, 5) : undefined;
    try {
      const m = chess.move({ from, to, promotion } as ChessMoveLite);
      if (!m) {
        // eslint-disable-next-line no-console
        console.warn(`[uciToSan] Invalid UCI at index ${i}: "${u}" — stopping conversion.`);
        break;
      }
      san.push(m.san);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[uciToSan] chess.move threw for UCI at index ${i}: "${u}" — stopping conversion.`,
        e
      );
      break;
    }
  }

  return san;
}
