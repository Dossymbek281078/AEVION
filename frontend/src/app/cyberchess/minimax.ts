/* AEVION CyberChess — the bundled search used by the sub-Stockfish levels.

   Lifted verbatim out of page.tsx (no behaviour change) so that the weak-bot
   move choice can be exercised end-to-end outside React: humanBot.ts decides
   *which* move to play, this decides *how good* each move is, and a headless
   harness can now play real games with both. */

import { Chess, type PieceSymbol } from "chess.js";

export const PV: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const PP=[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PN=[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PB=[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const PR=[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const PQ=[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const PK=[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30];

export const PST: Record<PieceSymbol, number[]> = { p: PP, n: PN, b: PB, r: PR, q: PQ, k: PK };

/** Static evaluation in centipawns, always from White's point of view. */
export function ev(c:Chess){let s=0;const b=c.board();for(let r=0;r<8;r++)for(let j=0;j<8;j++){const q=b[r][j];if(!q)continue;s+=(q.color==="w"?1:-1)*(PV[q.type]+(PST[q.type]?.[(q.color==="w"?r*8+j:(7-r)*8+j)]||0))}return s}

/** Alpha-beta minimax over `ev`. `mx` = side to move is White. */
export function mm(c:Chess,d:number,a:number,b:number,mx:boolean):number{if(!d)return ev(c);const mv=c.moves({verbose:true});if(!mv.length)return c.isCheckmate()?(mx?-1e5:1e5):0;if(mx){let v=-Infinity;for(const m of mv){c.move(m);v=Math.max(v,mm(c,d-1,a,b,false));c.undo();a=Math.max(a,v);if(b<=a)break}return v}let v=Infinity;for(const m of mv){c.move(m);v=Math.min(v,mm(c,d-1,a,b,true));c.undo();b=Math.min(b,v);if(b<=a)break}return v}
