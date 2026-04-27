"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import Piece from "./Pieces";
import AiCoach from "./AiCoach";
import { Btn, Card, Badge, Tabs as UiTabs, Modal, Icon, Spinner, SectionHeader, ChessyFloat } from "./ui";
import { COLOR as CC, SPACE, RADIUS, SHADOW, MOTION, Z } from "./theme";
import { computeGameDNA, type GameDNA } from "./gameDna";
import { ldRival, svRival, createRival, learnFromEncounter, rivalGreeting, rivalSummary, type RivalProfile } from "./aiRival";
import { ldTournament, svTournament, ldTrophies, svTrophies, createTournament, resolveBotMatches, applyPlayerResult, advanceBracket, nextPlayerMatch, finalPlace, placeReward, defeatedByPlayer, type Tournament, type Trophy, type Persona, PERSONAS } from "./tournament";
import { ldClones, svClones, fetchLichessGames, analyzeGames, profileToShareCode, shareCodeToProfile, clonePreferredMove, styleVerdict, type CloneProfile } from "./styleCloner";
import { generateReel, pickHighlights, estimateReelSeconds } from "./reelsGen";
import { GHOSTS, ghostBookMove, pickGhostStyleMove, type Ghost, type GhostId } from "./ghostMode";
import { todayHunt, applyGuess, showHint, giveUp, hintFor, simulatedLeaderboard, BRILLIANCIES, type BrilliancyHunt, type BrilliancyState } from "./brilliancy";
import { whisperPosition, whisperAndSpeak } from "./positionWhisper";
import { VARIANTS, fischer960Fen, asymmetricFen, twinKingsFen, twinKingsLossSide, rollDice, filterMovesByDice, pickReinforcement, atomicFen, applyExplosion, kothFen, kothWinner, threeCheckFen, knightRidersFen, pawnApocalypseFen, buildArmyFen, ARMY_PRESETS, randomVariant, getDailyVariantState, markDailyVariantPlayed, ldVariantStats, svVariantStats, recordVariantResult, VARIANT_TUTORIAL, VARIANT_ACH_REWARDS, variantAchKey, variantAchLabel, totalVariantGames, favoriteVariant, bestWinrateVariant, type VariantId, type ArmySlot, type VariantStats } from "./variants";
import { EMPTY_POOL, addToPool, removeFromPool, poolSize, isDropLegal, applyDrop, isDropAvailable, POOL_GLYPH, type DropPool } from "./powerDrop";

const FILES = "abcdefgh";
const PM: Record<string,string> = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
type TC = {name:string;ini:number;inc:number;cat:"Bullet"|"Blitz"|"Rapid"|"Classical"};
type AL = {name:string;elo:number;depth:number;color:string;rand:number;thinkMs:number};
type Pre = {from:Square;to:Square;pr?:"q"|"r"|"b"|"n"};

const TCS: TC[] = [
  // Bullet
  {name:"1+0",ini:60,inc:0,cat:"Bullet"},{name:"1+1",ini:60,inc:1,cat:"Bullet"},{name:"1+2",ini:60,inc:2,cat:"Bullet"},
  {name:"2+0",ini:120,inc:0,cat:"Bullet"},{name:"2+1",ini:120,inc:1,cat:"Bullet"},{name:"2+2",ini:120,inc:2,cat:"Bullet"},
  // Blitz
  {name:"3+0",ini:180,inc:0,cat:"Blitz"},{name:"3+1",ini:180,inc:1,cat:"Blitz"},{name:"3+2",ini:180,inc:2,cat:"Blitz"},
  {name:"5+0",ini:300,inc:0,cat:"Blitz"},{name:"5+1",ini:300,inc:1,cat:"Blitz"},{name:"5+2",ini:300,inc:2,cat:"Blitz"},
  // Rapid
  {name:"10+0",ini:600,inc:0,cat:"Rapid"},{name:"10+1",ini:600,inc:1,cat:"Rapid"},{name:"10+2",ini:600,inc:2,cat:"Rapid"},
  {name:"15+0",ini:900,inc:0,cat:"Rapid"},{name:"15+1",ini:900,inc:1,cat:"Rapid"},{name:"15+2",ini:900,inc:2,cat:"Rapid"},
];
const ALS: AL[] = [
  {name:"Beginner",elo:400,depth:1,color:"#94a3b8",rand:200,thinkMs:6000},
  {name:"Casual",elo:800,depth:2,color:"#10b981",rand:80,thinkMs:4500},
  {name:"Club",elo:1200,depth:3,color:"#3b82f6",rand:30,thinkMs:3000},
  {name:"Advanced",elo:1600,depth:4,color:"#a78bfa",rand:12,thinkMs:2000},
  {name:"Expert",elo:2000,depth:5,color:"#f87171",rand:5,thinkMs:1200},
  {name:"Master",elo:2400,depth:6,color:"#fbbf24",rand:2,thinkMs:600},
];
const SFD: Record<number,number> = {3:8,4:12,5:16};
const RANKS = [{min:0,t:"Beginner",i:"●"},{min:600,t:"Novice",i:"◆"},{min:900,t:"Amateur",i:"■"},{min:1200,t:"Club",i:"▲"},{min:1500,t:"Tournament",i:"★"},{min:1800,t:"CM",i:"✦"},{min:2000,t:"FM",i:"✧"},{min:2200,t:"IM",i:"✪"},{min:2400,t:"GM",i:"♛"}];

type Puzzle = {fen:string;sol:string[];name:string;r:number;theme:string;phase?:"Opening"|"Middlegame"|"Endgame";side?:"w"|"b";goal?:"Mate"|"Best move";mateIn?:number};

/* ═══ Stockfish with MultiPV ═══ */
type PVLine = {pv:number;cp:number;mate:number;depth:number;moves:string[]};
class SF{private w:Worker|null=null;private ok=false;private cb:((f:string,t:string,p?:string)=>void)|null=null;private ecb:((cp:number,mate:number)=>void)|null=null;private mpvCb:((lines:PVLine[])=>void)|null=null;private mpvLines:PVLine[]=[];
  init(){if(this.w)return;try{this.w=new Worker("/stockfish.js");this.w.onmessage=e=>{const l=String(e.data||"");
    if(l.startsWith("info")&&l.includes("score")){
      const cpM=l.match(/score cp (-?\d+)/);const mM=l.match(/score mate (-?\d+)/);
      const pvM=l.match(/multipv (\d+)/);const depM=l.match(/depth (\d+)/);
      const movesM=l.match(/ pv (.+)/);
      const cp=cpM?parseInt(cpM[1]):0;const mate=mM?parseInt(mM[1]):0;
      const pvNum=pvM?parseInt(pvM[1]):1;const depth=depM?parseInt(depM[1]):0;
      const moves=movesM?movesM[1].trim().split(" "):[];
      if(this.ecb)this.ecb(cp,mate);
      if(this.mpvCb){
        const idx=this.mpvLines.findIndex(x=>x.pv===pvNum);
        const line={pv:pvNum,cp,mate,depth,moves:moves.slice(0,10)};
        if(idx>=0)this.mpvLines[idx]=line;else this.mpvLines.push(line);
        this.mpvLines.sort((a,b)=>a.pv-b.pv);
      }
    }
    if(l.startsWith("bestmove")){
      if(this.mpvCb){this.mpvCb([...this.mpvLines]);this.mpvCb=null;this.mpvLines=[]}
      const m=l.split(" ")[1];if(m&&m.length>=4&&this.cb){this.cb(m.slice(0,2),m.slice(2,4),m.length>4?m[4]:undefined);this.cb=null}}
    if(l==="uciok"){this.ok=true;this.w!.postMessage("isready")}};this.w.postMessage("uci")}catch{this.w=null}}
  ready(){return this.ok&&!!this.w}
  go(fen:string,d:number,cb:(f:string,t:string,p?:string)=>void,ecb?:(cp:number,mate:number)=>void){if(!this.w)return cb("","");this.cb=cb;this.ecb=ecb||null;this.mpvCb=null;try{this.w.postMessage("stop")}catch{};this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  eval(fen:string,d:number,ecb:(cp:number,mate:number)=>void,done:()=>void){if(!this.w)return done();this.cb=()=>done();this.ecb=ecb;this.mpvCb=null;try{this.w.postMessage("stop")}catch{};this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  multiPV(fen:string,d:number,pvCount:number,cb:(lines:PVLine[])=>void){if(!this.w)return cb([]);this.cb=null;this.ecb=null;this.mpvCb=cb;this.mpvLines=[];try{this.w.postMessage("stop")}catch{};this.w.postMessage(`setoption name MultiPV value ${pvCount}`);this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  stop(){if(this.w){try{this.w.postMessage("stop")}catch{}}}
  terminate(){if(this.w){try{this.w.terminate()}catch{};this.w=null;this.ok=false;this.cb=null;this.ecb=null;this.mpvCb=null;this.mpvLines=[]}}}

/* ═══ Minimax ═══ */
const PV:Record<PieceSymbol,number>={p:100,n:320,b:330,r:500,q:900,k:0};
const PP=[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PN=[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PB=[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const PR=[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const PQ=[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const PK=[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30];
const PST:Record<PieceSymbol,number[]>={p:PP,n:PN,b:PB,r:PR,q:PQ,k:PK};
function ev(c:Chess){let s=0;const b=c.board();for(let r=0;r<8;r++)for(let j=0;j<8;j++){const q=b[r][j];if(!q)continue;s+=(q.color==="w"?1:-1)*(PV[q.type]+(PST[q.type]?.[(q.color==="w"?r*8+j:(7-r)*8+j)]||0))}return s}
function mm(c:Chess,d:number,a:number,b:number,mx:boolean):number{if(!d)return ev(c);const mv=c.moves({verbose:true});if(!mv.length)return c.isCheckmate()?(mx?-1e5:1e5):0;if(mx){let v=-Infinity;for(const m of mv){c.move(m);v=Math.max(v,mm(c,d-1,a,b,false));c.undo();a=Math.max(a,v);if(b<=a)break}return v}let v=Infinity;for(const m of mv){c.move(m);v=Math.min(v,mm(c,d-1,a,b,true));c.undo();b=Math.min(b,v);if(b<=a)break}return v}
function best(c:Chess,d:number,rn:number):Move|null{const mv=c.moves({verbose:true});if(!mv.length)return null;const sc=mv.map(m=>{c.move(m);const s=mm(c,Math.min(d,4)-1,-Infinity,Infinity,c.turn()==="w");c.undo();return{m,s:s+(Math.random()-.5)*rn}});sc.sort((a,b)=>c.turn()==="w"?b.s-a.s:a.s-b.s);return sc[0].m}

/* ═══ Sound — neutral percussive (filtered noise bursts, no melody) ═══ */
const MK="aevion_chess_mute_v1";
let _muted:boolean|null=null;
function isMuted(){if(_muted===null){try{_muted=typeof window!=="undefined"&&localStorage.getItem(MK)==="1"}catch{_muted=false}}return !!_muted}
function setMuted(v:boolean){_muted=v;try{localStorage.setItem(MK,v?"1":"0")}catch{}}
// Shared AudioContext — creating one per sound leaks and trips browser limits.
let _audioCtx:AudioContext|null=null;
function getAudioCtx():AudioContext|null{
  if(typeof window==="undefined")return null;
  if(!_audioCtx){try{_audioCtx=new(window.AudioContext||(window as any).webkitAudioContext)()}catch{_audioCtx=null}}
  if(_audioCtx&&_audioCtx.state==="suspended"){_audioCtx.resume().catch(()=>{})}
  return _audioCtx;
}
function snd(t:string){if(isMuted())return;try{
  const x=getAudioCtx();if(!x)return;const n=x.currentTime;
  // Generate short noise burst
  const dur = t==="capture"?0.12 : t==="check"?0.08 : t==="premove"?0.04 : t==="x"?0.25 : 0.05;
  const bufSize = Math.floor(x.sampleRate * dur);
  const buf = x.createBuffer(1, bufSize, x.sampleRate);
  const data = buf.getChannelData(0);
  // White noise with fast exponential decay envelope
  for(let i=0; i<bufSize; i++){
    const env = Math.exp(-i/(bufSize*0.2)); // sharp attack, quick decay
    data[i] = (Math.random()*2-1) * env;
  }
  const src = x.createBufferSource();
  src.buffer = buf;
  // Low-pass filter to remove harsh highs → wooden/tapping quality
  const filt = x.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = t==="capture" ? 800 : t==="check" ? 2000 : t==="premove" ? 1500 : 1200;
  filt.Q.value = 1;
  // High-pass to remove rumble
  const hp = x.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 200;
  const g = x.createGain();
  const vol = t==="premove"?0.15 : t==="capture"?0.3 : t==="x"?0.18 : 0.22;
  g.gain.setValueAtTime(vol, n);
  g.gain.exponentialRampToValueAtTime(0.001, n+dur);
  src.connect(hp); hp.connect(filt); filt.connect(g); g.connect(x.destination);
  src.start(n);
}catch{}}

/* ═══ Rating ═══ */
const RK="aevion_chess_rating_v2",SK="aevion_chess_stats_v2";
function ldR(){try{return parseInt(localStorage.getItem(RK)||"800")}catch{return 800}}
function svR(v:number){try{localStorage.setItem(RK,String(Math.round(v)))}catch{}}
function ldS(){try{return JSON.parse(localStorage.getItem(SK)||'{"w":0,"l":0,"d":0}')}catch{return{w:0,l:0,d:0}}}
function svS(v:{w:number;l:number;d:number}){try{localStorage.setItem(SK,JSON.stringify(v))}catch{}}
function gRank(e:number){return[...RANKS].reverse().find(r=>e>=r.min)||RANKS[0]}

/* ═══ Game History ═══ */
type SavedGame = {id:string;date:string;moves:string[];result:string;playerColor:"w"|"b";aiLevel:string;rating:number;tc:string;category:"Bullet"|"Blitz"|"Rapid"|"Classical";opening?:string};
const GK="aevion_chess_games_v1";
function loadGames():SavedGame[]{try{return JSON.parse(localStorage.getItem(GK)||"[]")}catch{return[]}}
function saveGame(g:SavedGame){try{const all=loadGames();all.unshift(g);if(all.length>200)all.length=200;localStorage.setItem(GK,JSON.stringify(all))}catch{}}

/* ═══ Chessy — in-game currency ═══ */
type ChessyState={v:1;balance:number;lifetime:number;lastDaily?:string;streak:number;welcome:boolean;owned:Record<string,boolean>;ach:Record<string,number>};
const CK="aevion_chessy_v1";
const CHESSY_DEFAULT:ChessyState={v:1,balance:0,lifetime:0,streak:0,welcome:false,owned:{},ach:{}};
function ldChessy():ChessyState{try{const s=localStorage.getItem(CK);if(!s)return {...CHESSY_DEFAULT};const r=JSON.parse(s);if(!r||r.v!==1)return {...CHESSY_DEFAULT};return {...CHESSY_DEFAULT,...r,owned:r.owned||{},ach:r.ach||{}}}catch{return {...CHESSY_DEFAULT}}}
function svChessy(s:ChessyState){try{localStorage.setItem(CK,JSON.stringify(s))}catch{}}
// Chessy transaction log (last 50 events) for shop "History" section
type ChessyLogEntry={ts:number;amount:number;reason:string;sign:1|-1};
const CLK="aevion_chessy_log_v1";
function ldChessyLog():ChessyLogEntry[]{try{const s=localStorage.getItem(CLK);if(!s)return [];const r=JSON.parse(s);return Array.isArray(r)?r.slice(0,50):[]}catch{return []}}
function svChessyLog(log:ChessyLogEntry[]){try{localStorage.setItem(CLK,JSON.stringify(log.slice(0,50)))}catch{}}
function todayKey(){const d=new Date();return`${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}
function daysSinceEpoch(){return Math.floor(Date.now()/86400000)}
// Deterministic daily-puzzle index — same for all users on the same day
function pickDailyIdx(total:number){if(total<=0)return 0;const n=daysSinceEpoch();let h=n*2654435761;h=(h^(h>>>16))>>>0;return h%total}
type DailyState={v:1;date:string;idx:number;solved:boolean};
const DK="aevion_daily_puzzle_v1";
function ldDaily():DailyState|null{try{const s=localStorage.getItem(DK);if(!s)return null;const r=JSON.parse(s);return r?.v===1?r:null}catch{return null}}
function svDaily(s:DailyState){try{localStorage.setItem(DK,JSON.stringify(s))}catch{}}

/* ═══ PGN utilities ═══ */
function buildPGN(moves:string[],meta:{white?:string;black?:string;result?:string;date?:string;event?:string}={}):string{
  const d=meta.date||new Date().toISOString().slice(0,10).replace(/-/g,".");
  const headers=[
    `[Event "${meta.event||"AEVION CyberChess"}"]`,
    `[Site "aevion.app/cyberchess"]`,
    `[Date "${d}"]`,
    `[White "${meta.white||"White"}"]`,
    `[Black "${meta.black||"Black"}"]`,
    `[Result "${meta.result||"*"}"]`,
  ];
  const body:string[]=[];
  for(let i=0;i<moves.length;i+=2){
    const n=i/2+1;const w=moves[i];const b=moves[i+1];
    body.push(b?`${n}. ${w} ${b}`:`${n}. ${w}`);
  }
  return headers.join("\n")+"\n\n"+body.join(" ")+(meta.result?` ${meta.result}`:" *");
}
// Parse SAN moves out of a PGN (ignoring headers, comments, variations, NAGs)
function parsePGN(pgn:string):string[]{
  // Strip headers [...]
  let body=pgn.replace(/^\s*\[[^\]]*\][^\n]*\n/gm,"");
  // Strip comments {...} and variations (...)
  body=body.replace(/\{[^}]*\}/g,"").replace(/\([^)]*\)/g,"");
  // Strip NAGs $1..$n and result tokens
  body=body.replace(/\$\d+/g,"").replace(/\b(1-0|0-1|1\/2-1\/2|\*)\b/g,"");
  // Strip move numbers "1." or "1..."
  body=body.replace(/\d+\.(\.\.)?/g,"");
  return body.split(/\s+/).filter(t=>t&&!/^\d+$/.test(t));
}
/* ═══ Endgame trainer — 12 classic positions ═══ */
type Endgame={name:string;fen:string;goal:"Win"|"Draw";side:"w"|"b";hint:string;reward:number};
const ENDGAMES:Endgame[]=[
  {name:"KQ vs K",fen:"4k3/8/8/8/8/8/4Q3/4K3 w - - 0 1",goal:"Win",side:"w",hint:"Отжимай чёрного короля к краю ферзём на «ход коня»: не ближе чем в 2 клетках. Когда король на краю — подведи своего и мат.",reward:15},
  {name:"KR vs K",fen:"4k3/8/8/8/8/8/4R3/4K3 w - - 0 1",goal:"Win",side:"w",hint:"Короля соперника гоняй на 8-ю горизонталь, свой король — в оппозицию. Ладья отрезает, короли друг против друга, потом мат ладьёй.",reward:20},
  {name:"Оппозиция: KP vs K (выигрыш)",fen:"4k3/8/8/8/8/4P3/4K3/8 w - - 0 1",goal:"Win",side:"w",hint:"Король перед пешкой — правило оппозиции. Если твой король на 6-й горизонтали впереди пешки — выигрыш, даже без темпа. Не торопи пешку.",reward:15},
  {name:"KP vs K (ничья)",fen:"4k3/8/8/4K3/4P3/8/8/8 b - - 0 1",goal:"Draw",side:"b",hint:"Чёрные держат оппозицию. Следи чтобы король соперника не прошёл на 6-ю горизонталь впереди пешки — тогда ничья.",reward:12},
  {name:"Lucena (ладейный)",fen:"1K6/1P1k4/8/8/8/8/6r1/2R5 w - - 0 1",goal:"Win",side:"w",hint:"Построй «мост»: ладья на 4-ю горизонталь, король выходит из-за пешки, ладья прикрывает от шахов. Классика теории.",reward:30},
  {name:"Philidor (ничья)",fen:"4k3/R7/4K3/4P3/8/8/8/5r2 b - - 0 1",goal:"Draw",side:"b",hint:"Держи ладью на 3-й (6-й для белых) горизонтали пока пешка не пойдёт. Когда пешка двинется — сразу за спину с шахом. Ничья по теории.",reward:25},
  {name:"Два слона против короля",fen:"8/8/4k3/8/8/2B5/1B2K3/8 w - - 0 1",goal:"Win",side:"w",hint:"Слоны контролируют две соседние диагонали — гоняй короля в угол. Твой король помогает. Занимает 15-20 ходов.",reward:25},
  {name:"Конь + слон (угол цвета слона)",fen:"8/8/4k3/8/8/3NB3/4K3/8 w - - 0 1",goal:"Win",side:"w",hint:"Король соперника должен оказаться в углу того же цвета, что слон. Техника W-manoeuvre коня — сложно, но изучаемо.",reward:40},
  {name:"Пешечный эндшпиль: треугольник",fen:"8/4k3/8/3KP3/8/8/8/8 w - - 0 1",goal:"Win",side:"w",hint:"Манёвр «треугольник» королём для передачи темпа. Цель — занять ключевое поле перед пешкой с оппозицией у соперника.",reward:18},
  {name:"Ферзь против ладьи",fen:"8/8/8/8/4k3/8/4r3/4K2Q w - - 0 1",goal:"Win",side:"w",hint:"Известная позиция Филидора. Оттесняй короля к краю и следи за шахами. Длинная техника — до 30-40 ходов.",reward:45},
  {name:"Ладья+пешка vs ладья (пешка f)",fen:"8/5pk1/8/8/8/5PK1/6R1/6r1 w - - 0 1",goal:"Win",side:"w",hint:"Крайние пешки f/h — тяжелее чем центральные. Короля за пешку и Lucena-мост. Если не получится — ничья.",reward:28},
  {name:"KBN vs K (мат слоном и конём)",fen:"8/8/8/4k3/8/8/1N1B4/4K3 w - - 0 1",goal:"Win",side:"w",hint:"Самый сложный основной мат. Король соперника должен оказаться в углу цвета СЛОНА. Маршрут коня — W-pattern.",reward:50},
];

const ACH_LABELS:Record<string,string>={
  first_win:"🏆 Первая победа",
  wins_10:"🎖 10 побед",
  wins_50:"🏅 50 побед",
  beat_expert:"⚔ Победа над Expert",
  beat_master:"👑 Победа над Master",
  puzzles_10:"🧩 10 пазлов",
  puzzles_50:"🧠 50 пазлов",
  puzzles_100:"🎯 100 пазлов",
  endgame_master:"🏰 Мастер эндшпилей",
};

/* ═══ Resume snapshot — autosave in-progress game ═══ */
type ResumeSnap={v:1;fen:string;hist:string[];fenHist:string[];pCol:"w"|"b";aiI:number;tcI:number;useCustom:boolean;customMin:number;customInc:number;timeP:number;timeA:number;capW:string[];capB:string[];ts:number};
const RSK="aevion_chess_resume_v1";
function loadResume():ResumeSnap|null{try{const s=localStorage.getItem(RSK);if(!s)return null;const r=JSON.parse(s);if(r?.v!==1||!Array.isArray(r.hist)||!r.fen)return null;return r as ResumeSnap}catch{return null}}
function saveResume(s:ResumeSnap){try{localStorage.setItem(RSK,JSON.stringify(s))}catch{}}
function clearResume(){try{localStorage.removeItem(RSK)}catch{}}

/* ═══ Timer ═══ */
function useTimer(ini:number,inc:number,act:boolean,onT:()=>void){const[t,sT]=useState(ini);const r=useRef<any>(null);useEffect(()=>{sT(ini)},[ini]);useEffect(()=>{if(r.current)clearInterval(r.current);if(act&&ini>0){r.current=setInterval(()=>sT(v=>{if(v<=1){clearInterval(r.current);onT();return 0}return v-1}),1000)}return()=>{if(r.current)clearInterval(r.current)}},[act,ini>0]);return{time:t,addInc:useCallback(()=>{if(inc>0)sT(v=>v+inc)},[inc]),reset:useCallback(()=>sT(ini),[ini]),setTime:useCallback((v:number)=>sT(v),[])}}
function fmt(s:number){return s<=0?"0:00":`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}
function pc(t:PieceSymbol,c:ChessColor){return PM[`${c}${t}`]||"?"}

/* ═══ Theme ═══ */
const T={bg:"#f3f4f6",surface:"#fff",border:"#e5e7eb",text:"#111827",dim:"#6b7280",accent:"#059669",gold:"#d97706",danger:"#dc2626",blue:"#2563eb",purple:"#7c3aed",sel:"rgba(5,150,105,0.45)",valid:"rgba(5,150,105,0.35)",cap:"rgba(220,38,38,0.35)",last:"rgba(217,119,6,0.25)",chk:"rgba(220,38,38,0.55)",pm:"rgba(37,99,235,0.35)",pmS:"rgba(37,99,235,0.5)"};

type BoardTheme = {name:string;light:string;dark:string;border:string;icon:string;premium?:string};
const BOARD_THEMES: BoardTheme[] = [
  {name:"Classic",light:"#f0d9b5",dark:"#b58863",border:"#b58863",icon:"♟"},
  {name:"Emerald",light:"#eeeed2",dark:"#769656",border:"#769656",icon:"🌿"},
  {name:"Ocean",light:"#dee3e6",dark:"#5b8baf",border:"#4a7a9b",icon:"🌊"},
  {name:"Purple",light:"#e8dff0",dark:"#9370ab",border:"#7b5e99",icon:"💜"},
  {name:"Wood",light:"#e6c89c",dark:"#a0724a",border:"#8b5e3c",icon:"🪵"},
  {name:"Dark",light:"#b0b0b0",dark:"#555555",border:"#444444",icon:"🌑"},
  {name:"Ice",light:"#e8f4f8",dark:"#7eb8d0",border:"#5a9ab5",icon:"❄️"},
  {name:"Rose",light:"#f5e6e0",dark:"#c47a6c",border:"#b06858",icon:"🌹"},
  // Premium (owned key in Chessy state)
  {name:"Neon",light:"#1a0b2e",dark:"#ff00e6",border:"#7c3aed",icon:"⚡",premium:"theme_neon"},
  {name:"Obsidian",light:"#1f2937",dark:"#0a0a0a",border:"#fbbf24",icon:"🖤",premium:"theme_obsidian"},
  {name:"Sakura",light:"#ffe0ec",dark:"#f472b6",border:"#ec4899",icon:"🌸",premium:"theme_sakura"},
];

/* ═══ StatusBar — game state badge with inline SVG icons ═══ */
type StatusBarProps = {over:string|null;chk:boolean;think:boolean;myT:boolean;useSF:boolean;pmsLen:number;histLen:number;rat:number;rkI:string};
function StatusBar({over,chk,think,myT,useSF,pmsLen,histLen,rat,rkI}:StatusBarProps){
  const isOver=!!over;
  const isWin=isOver&&over!.includes("You win");
  const sz={width:18,height:18,flexShrink:0};
  const bg=isOver?(isWin?"#ecfdf5":"#fef2f2"):chk?"#fef2f2":think?"#fffbeb":T.surface;
  const bc=isOver?(isWin?"#a7f3d0":"#fecaca"):chk?"#fecaca":T.border;
  const col=isOver?(isWin?T.accent:T.danger):chk?T.danger:think?T.gold:myT?T.accent:T.dim;
  const label=isOver?over:chk?"Check!":think?(useSF?"Stockfish thinking…":"AI thinking…"):myT?"Your move":"AI's turn";
  const icon=isOver?(isWin
      ? <svg viewBox="0 0 24 24" fill={col} style={sz}><path d="M7 3h10v3a5 5 0 0 1-5 5 5 5 0 0 1-5-5V3zm-3 1h3v2a3 3 0 0 1-3-3V4zm13 0h3v1a3 3 0 0 1-3 3V4zM9 13h6v2l2 5H7l2-5v-2z"/></svg>
      : <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" style={sz}><circle cx="12" cy="12" r="9"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>
    ):chk
      ? <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={sz}><path d="M12 3L2 20h20L12 3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17.5" r="0.9" fill={col} stroke="none"/></svg>
    :think
      ? <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" style={{...sz,animation:"spin 1.8s linear infinite"}}><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.5,14"/></svg>
    :myT
      ? <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={sz}><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
    : <svg viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={sz}><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="9" cy="13" r="1.4" fill={col} stroke="none"/><circle cx="15" cy="13" r="1.4" fill={col} stroke="none"/><line x1="12" y1="3" x2="12" y2="7"/></svg>;
  return (
    <div style={{
      padding:"12px 16px",borderRadius:12,background:bg,border:`1px solid ${bc}`,
      boxShadow:isOver?(isWin?"0 4px 14px rgba(5,150,105,0.18)":"0 4px 14px rgba(220,38,38,0.18)"):chk?"0 4px 14px rgba(220,38,38,0.15)":"0 1px 3px rgba(0,0,0,0.04)",
      transition:"all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      position:"relative",overflow:"hidden",
    }}>
      {/* Animated accent bar at top for game over */}
      {isOver && <div style={{position:"absolute",top:0,left:0,right:0,height:3,
        background:isWin?"linear-gradient(90deg,#10b981,#059669,#10b981)":"linear-gradient(90deg,#ef4444,#dc2626,#ef4444)",
        backgroundSize:"200% 100%",animation:"shimmer 2s linear infinite"}}/>}
      {isOver ? (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:8,fontWeight:900,fontSize:15,color:col}}>
            <span style={{animation:"pop 0.5s ease-out",display:"inline-flex"}}>{icon}</span>
            <span>{label}</span>
          </div>
          <div style={{fontSize:13,color:T.dim,marginTop:4,paddingLeft:26}}>{histLen} moves · {rat} {rkI}</div>
        </div>
      ) : (
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {icon}
          <span style={{fontWeight:700,fontSize:14,color:T.text}}>{label}</span>
          {pmsLen>0 && <span style={{
            padding:"3px 10px",borderRadius:RADIUS.full,fontSize:12,fontWeight:800,
            background:"linear-gradient(135deg,#dbeafe,#bfdbfe)",color:T.blue,marginLeft:"auto",
            boxShadow:"0 1px 3px rgba(37,99,235,0.2)",
            display:"inline-flex",alignItems:"center",gap:4
          }}>⚡ {pmsLen} premove{pmsLen>1?"s":""}</span>}
        </div>
      )}
    </div>
  );
}

/* ═══ Component ═══ */
export default function CyberChessPage(){
  const{showToast}=useToast();
  const[game,setGame]=useState(()=>new Chess());
  const[bk,sBk]=useState(0);
  const[boardTheme,sBoardTheme]=useState(()=>{try{const v=parseInt(localStorage.getItem("aevion_chess_theme_v1")||"0");return isNaN(v)||v<0||v>=BOARD_THEMES.length?0:v}catch{return 0}});
  const[muted,sMuted]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem(MK)==="1"}catch{return false}});
  useEffect(()=>{setMuted(muted)},[muted]);
  const[voiceListening,sVoiceListening]=useState(false);
  const voiceRecRef=useRef<any>(null);
  useEffect(()=>{try{localStorage.setItem("aevion_chess_theme_v1",String(boardTheme))}catch{}},[boardTheme]);
  const bT=BOARD_THEMES[boardTheme]||BOARD_THEMES[0];
  const[sel,sSel]=useState<Square|null>(null);
  const[vm,sVm]=useState<Set<string>>(new Set());
  const[lm,sLm]=useState<{from:string;to:string}|null>(null);
  const[over,sOver]=useState<string|null>(null);
  const[hist,sHist]=useState<string[]>([]);
  const[think,sThink]=useState(false);
  const[capW,sCapW]=useState<string[]>([]);
  const[capB,sCapB]=useState<string[]>([]);
  const[promo,sPromo]=useState<{from:Square;to:Square}|null>(null);
  const[pms,sPms]=useState<Pre[]>([]);
  const[pmSel,sPmSel]=useState<Square|null>(null);
  const pmsRef=useRef<Pre[]>([]);
  const pmSelRef=useRef<Square|null>(null);
  useEffect(()=>{pmsRef.current=pms},[pms]);
  useEffect(()=>{pmSelRef.current=pmSel},[pmSel]);
  const[pmLim,sPmLim]=useState(10);
  const[aiI,sAiI]=useState(2);
  const[pCol,sPCol]=useState<ChessColor>("w");
  const[tcI,sTcI]=useState(9); // 5+0 default
  const[customMin,sCustomMin]=useState(5);
  const[customInc,sCustomInc]=useState(0);
  const[useCustom,sUseCustom]=useState(false);
  const[showCustom,sShowCustom]=useState(false);
  const[on,sOn]=useState(false);
  const[setup,sSetup]=useState(true);
  // Board editor state (Coach tab)
  const[editorMode,sEditorMode]=useState(false);
  const[coachAIEnabled,sCoachAIEnabled]=useState(true);
  const[coachLevel,sCoachLevel]=useState<"beginner"|"intermediate"|"advanced">("intermediate");
  const[coachTipsExpanded,sCoachTipsExpanded]=useState(false);
  const[refiningAnalysis,sRefiningAnalysis]=useState(false);
  const[editorPiece,sEditorPiece]=useState<{type:"p"|"n"|"b"|"r"|"q"|"k";color:"w"|"b"}|null>(null);
  const[editorTurn,sEditorTurn]=useState<"w"|"b">("w");
  const[flip,sFlip]=useState(false);
  const[tab,sTab]=useState<"play"|"puzzles"|"analysis"|"coach">("play");
  const[pzI,sPzI]=useState(0);
  const[pzF,sPzF]=useState("all");
  const[sfOk,sSfOk]=useState(false);
  const[rat,sRat]=useState(800);
  const[sts,sSts]=useState({w:0,l:0,d:0});
  const[evalCp,sEvalCp]=useState(0);
  const[evalMate,sEvalMate]=useState(0);
  const[fenHist,sFenHist]=useState<string[]>([new Chess().fen()]);
  const[analyzing,sAnalyzing]=useState(false);
  // MultiPV
  const[mpvLines,sMpvLines]=useState<PVLine[]>([]);
  const[mpvCount,sMpvCount]=useState(3);
  const[mpvDepth,sMpvDepth]=useState(14);
  const[mpvRunning,sMpvRunning]=useState(false);
  const[analFen,sAnalFen]=useState("");
  // Guess Best Move
  const[guessMode,sGuessMode]=useState(false);
  const[guessBest,sGuessBest]=useState<string>(""); // best move UCI from engine
  const[guessResult,sGuessResult]=useState<"idle"|"correct"|"wrong">("idle");
  const[guessScore,sGuessScore]=useState({right:0,total:0});
  const[guessBestSan,sGuessBestSan]=useState("");
  // Opening detection
  type Opening = {eco:string;name:string;moves:string;desc:string};
  type OpeningIndexed = Opening & {fenKey:string;plyLen:number};
  const[openingsDb,sOpeningsDb]=useState<OpeningIndexed[]>([]);
  const openingMapRef=useRef<Map<string,OpeningIndexed>>(new Map());
  const[currentOpening,sCurrentOpening]=useState<Opening|null>(null);
  const[savedGames,sSavedGames]=useState<SavedGame[]>([]);
  const[gamesFilter,sGamesFilter]=useState<string>("all");
  const[analysis,sAnalysis]=useState<{move:number;cp:number;mate:number;quality:"great"|"good"|"inacc"|"mistake"|"blunder"}[]>([]);
  const[showAnal,sShowAnal]=useState(false);
  const[browseIdx,sBrowseIdx]=useState(-1); // -1 = live position, 0+ = viewing that move
  const[PUZZLES,sPuzzles]=useState<Puzzle[]>([]);
  // Puzzle system
  const[pzMode,sPzMode]=useState<"learn"|"timed3"|"timed5"|"rush">("learn");
  const[pzTimeLeft,sPzTimeLeft]=useState(0);
  const[pzAttempt,sPzAttempt]=useState<"idle"|"wrong"|"correct"|"shown">("idle");
  const[pzCurrent,sPzCurrent]=useState<Puzzle|null>(null);
  const[pzSolvedCount,sPzSolvedCount]=useState(0);
  const[pzFailedCount,sPzFailedCount]=useState(0);
  // Puzzle Rush state
  const[rushActive,sRushActive]=useState(false);
  const[rushScore,sRushScore]=useState(0);
  const[rushStreak,sRushStreak]=useState(0);
  const[rushBestStreak,sRushBestStreak]=useState(0);
  const[rushBest,sRushBest]=useState(()=>{try{return parseInt(localStorage.getItem("aevion_puzzle_rush_best_v1")||"0")||0}catch{return 0}});
  const[rushResult,sRushResult]=useState<null|{score:number;streak:number;best:number;chessy:number;isNewBest:boolean}>(null);
  // Multi-dimensional filters
  const[pzFilterGoal,sPzFilterGoal]=useState<string>("all"); // all, Mate, Best move
  const[pzFilterMate,sPzFilterMate]=useState<number>(0); // 0=any, 1=M1, 2=M2, 3=M3...
  const[pzFilterPhase,sPzFilterPhase]=useState<string>("all");
  const[pzFilterTheme,sPzFilterTheme]=useState<string>("all");
  const[pzFilterSide,sPzFilterSide]=useState<string>("all");
  const[pzFilterRating,sPzFilterRating]=useState<[number,number]>([0,3000]);
  const[pzFiltersExpanded,sPzFiltersExpanded]=useState(false);
  const[pzCategory,sPzCategory]=useState<"all"|"tactics"|"mate1"|"mate2"|"mate3"|"mate4plus"|"endgame"|"opening"|"middlegame">("all");
  const[puzzleListOpen,sPuzzleListOpen]=useState(false);
  const[gamesModalOpen,sGamesModalOpen]=useState(false);
  const[enginePanelExpanded,sEnginePanelExpanded]=useState(false);
  const[showHelp,sShowHelp]=useState(false);
  const[resumeOffer,sResumeOffer]=useState<ResumeSnap|null>(null);
  const[replaying,sReplaying]=useState(false);
  const[replaySpeed,sReplaySpeed]=useState(1000);
  type Arrow={from:Square;to:Square;c:string};
  type SqHL={sq:Square;c:string};
  const[arrows,sArrows]=useState<Arrow[]>([]);
  const[sqHL,sSqHL]=useState<SqHL[]>([]);
  const rcStartRef=useRef<Square|null>(null);
  const annotColor=(e:{shiftKey?:boolean;ctrlKey?:boolean;altKey?:boolean})=>{
    if(e.shiftKey)return "#ef4444"; // red
    if(e.ctrlKey||e.altKey)return "#3b82f6"; // blue
    return "#22c55e"; // green default
  };
  const clearAnnotations=useCallback(()=>{sArrows([]);sSqHL([])},[]);
  const[chessy,sChessy]=useState<ChessyState>(()=>ldChessy());
  const[showShop,sShowShop]=useState(false);
  const[showChessyInfo,sShowChessyInfo]=useState(false);
  const[showPuzzleExpand,sShowPuzzleExpand]=useState(false);
  const[showGameDna,sShowGameDna]=useState(false);
  const gameDna=useMemo<GameDNA>(()=>computeGameDNA(savedGames),[savedGames]);
  // Opening Trainer state (killer #4)
  const[showOpeningTrainer,sShowOpeningTrainer]=useState(false);
  const[openingDrill,sOpeningDrill]=useState<null|{eco:string;name:string;moves:string[];ply:number;mistakes:number}>(null);
  const[openingDrillFilter,sOpeningDrillFilter]=useState("");
  // AI Rival (killer #1)
  const[rivalProfile,sRivalProfile]=useState<RivalProfile|null>(()=>ldRival());
  useEffect(()=>{if(rivalProfile)svRival(rivalProfile)},[rivalProfile]);
  const[rivalMode,sRivalMode]=useState(false);
  const[showRivalGreet,sShowRivalGreet]=useState(false);
  // Tournament Mode (killer #6)
  const[tournament,sTournament]=useState<Tournament|null>(()=>(typeof window!=="undefined"?ldTournament():null));
  useEffect(()=>{svTournament(tournament)},[tournament]);
  const[trophies,sTrophies]=useState<Trophy[]>(()=>(typeof window!=="undefined"?ldTrophies():[]));
  useEffect(()=>{svTrophies(trophies)},[trophies]);
  const[showTournament,sShowTournament]=useState(false);
  const[tournamentOpponent,sTournamentOpponent]=useState<Persona|null>(null);
  const tournamentLearnedRef=useRef<string|null>(null);
  // Selected variant for next tournament (only matters at "create" time)
  const[tournamentVariantPick,sTournamentVariantPick]=useState<VariantId>("standard");
  // Style Cloner (killer #7)
  const[clones,sClones]=useState<CloneProfile[]>(()=>(typeof window!=="undefined"?ldClones():[]));
  useEffect(()=>{svClones(clones)},[clones]);
  const[showCloner,sShowCloner]=useState(false);
  const[clonerUsername,sClonerUsername]=useState("");
  const[clonerLoading,sClonerLoading]=useState(false);
  const[clonerError,sClonerError]=useState("");
  const[activeCloneId,sActiveCloneId]=useState<number|null>(null);
  const[cloneMode,sCloneMode]=useState(false);
  const activeClone=activeCloneId!==null?clones[activeCloneId]:null;
  // Ghost Mode (killer #9)
  const[showGhost,sShowGhost]=useState(false);
  const[activeGhost,sActiveGhost]=useState<Ghost|null>(null);
  const[ghostMode,sGhostMode]=useState(false);
  // Chess Variants (Fischer 960, Asymmetric, Twin Kings, Diceblade, Reinforcement)
  const[variant,sVariant]=useState<VariantId>("standard");
  const[showVariants,sShowVariants]=useState(false);
  const[variantStartFen,sVariantStartFen]=useState<string>("");
  const[variantArmies,sVariantArmies]=useState<{white:ArmySlot[];black:ArmySlot[]}|null>(null);
  // Diceblade die state — current allowed piece type for the side-to-move
  const[diceFace,sDiceFace]=useState<1|2|3|4|5|6>(6);
  const[dicePieceType,sDicePieceType]=useState<string>("");
  const[diceLabel,sDiceLabel]=useState<string>("Любая фигура");
  const[diceRolling,sDiceRolling]=useState(false);
  // Reinforcement: track move counter for periodic spawn
  const reinfLastMoveRef=useRef(0);
  // Three-Check counters
  const[checksByWhite,sChecksByWhite]=useState(0);
  const[checksByBlack,sChecksByBlack]=useState(0);
  const lastCheckBkRef=useRef(-1);
  // Power Drop pool
  const[dropPool,sDropPool]=useState<DropPool>(EMPTY_POOL);
  const[dropPickerOpen,sDropPickerOpen]=useState(false);
  const[selectedDropPiece,sSelectedDropPiece]=useState<"p"|"n"|"b"|"r"|"q"|null>(null);
  const lastCaptureBkRef=useRef(-1);
  // Manual Asymmetric Army Builder
  const[showArmyBuilder,sShowArmyBuilder]=useState(false);
  const[builderWhite,sBuilderWhite]=useState<("Q"|"R"|"B"|"N")[]>(["R","R","B","B","N","N","Q"]);
  const[builderBlack,sBuilderBlack]=useState<("Q"|"R"|"B"|"N")[]>(["R","R","B","B","N","N","Q"]);
  const[manualArmyFen,sManualArmyFen]=useState<string>("");
  // Daily Variant Challenge + per-variant stats
  const[variantStats,sVariantStats]=useState<VariantStats>(()=>(typeof window!=="undefined"?ldVariantStats():{} as VariantStats));
  useEffect(()=>{svVariantStats(variantStats)},[variantStats]);
  const[dailyVariantInfo,sDailyVariantInfo]=useState(()=>(typeof window!=="undefined"?getDailyVariantState():null));
  const variantResultLearnedRef=useRef<string|null>(null);
  const[showVariantStats,sShowVariantStats]=useState(false);
  // Daily Brilliancy Hunt (killer #10)
  const[showBrilliancy,sShowBrilliancy]=useState(false);
  const[brilliancyHunt,sBrilliancyHunt]=useState<BrilliancyHunt|null>(null);
  const[brilliancyState,sBrilliancyState]=useState<BrilliancyState|null>(null);
  const[brilliancyInput,sBrilliancyInput]=useState("");
  const[brilliancyResult,sBrilliancyResult]=useState<{correct:boolean;reward:number}|null>(null);
  // Auto-Reels Generator (killer #8)
  const[showReel,sShowReel]=useState(false);
  const[reelMeta,sReelMeta]=useState<{white:string;black:string;result:string}>({white:"White",black:"Black",result:"*"});
  const[reelGenerating,sReelGenerating]=useState(false);
  const[reelBlobUrl,sReelBlobUrl]=useState<string>("");
  const[reelSpeed,sReelSpeed]=useState(350); // ms per move
  // Live Voice Commentary — Coach читает краткие комментарии на каждом ходе (killer #5)
  const[liveCommentary,sLiveCommentary]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem("aevion_live_commentary_v1")==="1"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("aevion_live_commentary_v1",liveCommentary?"1":"0")}catch{}},[liveCommentary]);
  const[dailyState,sDailyState]=useState<DailyState|null>(null);
  const[tourStep,sTourStep]=useState<number>(-1); // -1 = not showing
  const[hotseat,sHotseat]=useState(false);
  const[showEndgames,sShowEndgames]=useState(false);
  const[currentEndgame,sCurrentEndgame]=useState<Endgame|null>(null);
  const[streamerMode,sStreamerMode]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem("aevion_streamer_v1")==="1"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("aevion_streamer_v1",streamerMode?"1":"0")}catch{}},[streamerMode]);
  useEffect(()=>{svChessy(chessy)},[chessy]);
  const[chessyFloat,sChessyFloat]=useState<{amount:number;key:number}|null>(null);
  const[chessyLog,sChessyLog]=useState<ChessyLogEntry[]>(()=>ldChessyLog());
  useEffect(()=>{svChessyLog(chessyLog)},[chessyLog]);
  const addChessy=useCallback((n:number,reason:string)=>{
    if(n<=0)return;
    sChessy(c=>({...c,balance:c.balance+n,lifetime:c.lifetime+n}));
    sChessyLog(log=>[{ts:Date.now(),amount:n,reason,sign:1 as const},...log].slice(0,50));
    showToast(`+${n} Chessy · ${reason}`,"success");
    sChessyFloat({amount:n,key:Date.now()});
  },[showToast]);
  const spendChessy=useCallback((n:number,reason:string)=>{
    let ok=false;
    sChessy(c=>{if(c.balance<n)return c;ok=true;return {...c,balance:c.balance-n}});
    if(ok){
      sChessyLog(log=>[{ts:Date.now(),amount:n,reason,sign:-1 as const},...log].slice(0,50));
      showToast(`−${n} Chessy · ${reason}`,"info");
    }
    else showToast(`Недостаточно Chessy (нужно ${n})`,"error");
    return ok;
  },[showToast]);
  const unlockAch=useCallback((key:string,reward:number,label:string)=>{
    sChessy(c=>{
      if(c.ach[key])return c;
      setTimeout(()=>{showToast(`🏆 ${label} · +${reward} Chessy`,"success");sChessyFloat({amount:reward,key:Date.now()})},300);
      return {...c,balance:c.balance+reward,lifetime:c.lifetime+reward,ach:{...c.ach,[key]:Date.now()}};
    });
  },[showToast]);

  const tc:TC=useCustom?{name:`${customMin}+${customInc}`,ini:customMin*60,inc:customInc,cat:customMin<3?"Bullet":customMin<8?"Blitz":customMin<20?"Rapid":"Classical"}:TCS[tcI];
  const lv=ALS[aiI],rk=gRank(rat);
  const aiC:ChessColor=pCol==="w"?"b":"w",myT=game.turn()===pCol,chk=game.isCheck(),useSF=aiI>=3;
  const pT=useTimer(tc.ini,tc.inc,on&&myT&&!over&&tc.ini>0,()=>{sOver("Time out");snd("x")});
  const aT=useTimer(tc.ini,tc.inc,on&&!myT&&!over&&tc.ini>0,()=>{sOver("AI timed out — you win!");snd("x")});
  const hR=useRef<HTMLDivElement>(null),sfR=useRef<SF|null>(null);
  const fPz=PUZZLES.filter(p=>{
    // Category filter
    if(pzCategory==="tactics"&&p.goal!=="Best move")return false;
    if(pzCategory==="mate1"&&(p.goal!=="Mate"||p.mateIn!==1))return false;
    if(pzCategory==="mate2"&&(p.goal!=="Mate"||p.mateIn!==2))return false;
    if(pzCategory==="mate3"&&(p.goal!=="Mate"||p.mateIn!==3))return false;
    if(pzCategory==="mate4plus"&&(p.goal!=="Mate"||!(p.mateIn&&p.mateIn>=4)))return false;
    if(pzCategory==="opening"&&p.phase!=="Opening")return false;
    if(pzCategory==="middlegame"&&p.phase!=="Middlegame")return false;
    if(pzCategory==="endgame"&&p.phase!=="Endgame")return false;
    if(pzFilterGoal!=="all"&&p.goal!==pzFilterGoal)return false;
    if(pzFilterMate>0&&p.mateIn!==pzFilterMate)return false;
    if(pzFilterPhase!=="all"&&p.phase!==pzFilterPhase)return false;
    if(pzFilterTheme!=="all"&&p.theme!==pzFilterTheme)return false;
    if(pzFilterSide!=="all"&&p.side!==pzFilterSide)return false;
    if(p.r<pzFilterRating[0]||p.r>pzFilterRating[1])return false;
    return true;
  });

  // Auto-load first puzzle when category changes and we're on Puzzles tab
  useEffect(()=>{
    if(tab!=="puzzles"||fPz.length===0||PUZZLES.length===0)return;
    const pz=fPz[0];if(!pz)return;
    const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(0);sPzCurrent(pz);sPzAttempt("idle");sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);pT.reset();aT.reset();
  },[pzCategory]);

  // Recompute daily puzzle whenever puzzles are loaded (once we know total count)
  useEffect(()=>{
    if(PUZZLES.length===0)return;
    const tk=todayKey();const saved=ldDaily();
    if(saved&&saved.date===tk){sDailyState(saved);return}
    const idx=pickDailyIdx(PUZZLES.length);
    const next:DailyState={v:1,date:tk,idx,solved:false};
    svDaily(next);sDailyState(next);
  },[PUZZLES.length]);

  // Watch-URL: on mount, if ?pgn=... is present, load the PGN into Analysis tab read-only.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    try{
      const params=new URLSearchParams(window.location.search);
      // Style Cloner share-link: ?clone=base64(profile)
      const cloneCode=params.get("clone");
      if(cloneCode){
        const profile=shareCodeToProfile(cloneCode);
        if(profile){
          sClones(list=>{
            const exists=list.some(c=>c.username===profile.username&&c.rating===profile.rating);
            return exists?list:[profile,...list].slice(0,20);
          });
          setTimeout(()=>{
            sShowCloner(true);
            showToast(`🧬 Получен клон: ${profile.username} (${profile.rating} · ${profile.style})`,"success");
          },800);
        }
      }
      const pgn=params.get("pgn");
      if(!pgn)return;
      const sans=parsePGN(decodeURIComponent(pgn));
      if(!sans.length)return;
      const ch=new Chess();const fh:string[]=[ch.fen()];const mh:string[]=[];
      for(const san of sans){try{const mv=ch.move(san);if(mv){mh.push(mv.san);fh.push(ch.fen())}else break}catch{break}}
      if(!mh.length)return;
      setGame(ch);sBk(k=>k+1);sHist(mh);sFenHist(fh);sOn(false);sSetup(false);sTab("analysis");sBrowseIdx(0);
      try{const first=new Chess();setGame(first);sBk(k=>k+1)}catch{}
      showToast(`▶ Просмотр партии · ${mh.length} ходов`,"info");
    }catch{}
  },[]);

  useEffect(()=>{sRat(ldR());sSts(ldS());sSavedGames(loadGames());
    const rs=loadResume();if(rs&&rs.hist.length>0)sResumeOffer(rs);
    // Chessy welcome + daily bonus + first-time tour
    const c=ldChessy();const tk=todayKey();
    let tourSeen=false;try{tourSeen=localStorage.getItem("aevion_tour_seen_v1")==="1"}catch{}
    if(!c.welcome){
      sChessy(x=>({...x,balance:x.balance+50,lifetime:x.lifetime+50,welcome:true,lastDaily:tk,streak:1}));
      setTimeout(()=>showToast("🎉 +50 Chessy · добро пожаловать!","success"),800);
      if(!tourSeen)setTimeout(()=>sTourStep(0),1400);
    }else if(c.lastDaily!==tk){
      // Compute streak: consecutive days? Simple check — yesterday continues, else reset to 1
      const y=new Date();y.setDate(y.getDate()-1);const yk=`${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;
      const newStreak=c.lastDaily===yk?c.streak+1:1;
      const bonus=newStreak>=7?100:newStreak>=3?30:5;
      sChessy(x=>({...x,balance:x.balance+bonus,lifetime:x.lifetime+bonus,lastDaily:tk,streak:newStreak}));
      setTimeout(()=>showToast(`☀ +${bonus} Chessy · ${newStreak}-й день подряд`,"success"),800);
    }
    fetch("/puzzles.json").then(r=>r.json()).then((d:Puzzle[])=>sPuzzles(d)).catch(()=>sPuzzles([]));
    fetch("/openings.json").then(r=>r.json()).then((d:Opening[])=>{
      // Build FEN-indexed opening database for transposition detection
      const map=new Map<string,OpeningIndexed>();
      const indexed:OpeningIndexed[]=[];
      for(const op of d){
        try{
          const g=new Chess();
          const uciList=op.moves.trim().split(/\s+/);
          for(const uci of uciList){
            if(uci.length<4)continue;
            g.move({from:uci.slice(0,2) as Square,to:uci.slice(2,4) as Square,promotion:uci.length>4?uci[4] as any:undefined});
          }
          // FEN key: placement + active color + castling (ignore en passant, halfmove, fullmove for transposition match)
          const parts=g.fen().split(" ");
          const fenKey=`${parts[0]} ${parts[1]} ${parts[2]}`;
          const entry:OpeningIndexed={...op,fenKey,plyLen:uciList.length};
          indexed.push(entry);
          // Keep the DEEPEST opening for each FEN key (longest move sequence wins)
          const existing=map.get(fenKey);
          if(!existing||existing.plyLen<entry.plyLen)map.set(fenKey,entry);
        }catch{/* skip malformed */}
      }
      openingMapRef.current=map;
      sOpeningsDb(indexed);
    }).catch(()=>sOpeningsDb([]))
  },[]);
  useEffect(()=>{hR.current?.scrollTo({top:hR.current.scrollHeight,behavior:"smooth"})},[hist]);

  // Detect opening from move history using FEN-based transposition matching
  useEffect(()=>{
    if(!openingMapRef.current.size||!hist.length)return;
    // Walk through every position in the game, find the DEEPEST matching opening
    // This catches transpositions (e.g. Italian via 1.Nf3 Nc6 2.e4 e5 3.Bc4)
    const g=new Chess();
    let bestMatch:OpeningIndexed|null=null;
    let bestPly=0;
    let curPly=0;
    for(const san of hist){
      try{const m=g.move(san);if(!m)break;curPly++}catch{break}
      const parts=g.fen().split(" ");
      const fenKey=`${parts[0]} ${parts[1]} ${parts[2]}`;
      const match=openingMapRef.current.get(fenKey);
      // Prefer match reached at deepest ply in the actual game (latest known opening)
      if(match&&curPly>=bestPly){bestMatch=match;bestPly=curPly}
    }
    if(bestMatch)sCurrentOpening(bestMatch);
  },[hist,openingsDb]);
  // Always load Stockfish for eval bar (not just for AI play)
  useEffect(()=>{if(!sfR.current){const s=new SF();s.init();sfR.current=s;const c=setInterval(()=>{if(s.ready()){sSfOk(true);clearInterval(c)}},200);const t=setTimeout(()=>clearInterval(c),15000);return()=>{clearInterval(c);clearTimeout(t)}}},[]);
  // Terminate Stockfish worker on unmount so the WASM process doesn't outlive the page.
  useEffect(()=>()=>{try{sfR.current?.terminate()}catch{};sfR.current=null},[]);
  // Live eval on position change - for play/coach/analysis tabs
  // Hardened: 8s timeout + abort on cleanup (prevents stuck worker when user scrolls history fast)
  useEffect(()=>{
    if(setup||!sfR.current?.ready())return;
    if(tab!=="analysis"&&tab!=="play"&&tab!=="coach")return;
    if(tab!=="analysis"&&over)return;
    if(tab!=="analysis"&&think)return;
    let done=false;
    const sign=game.turn()==="w"?1:-1;
    const to=setTimeout(()=>{
      if(done)return;
      done=true;
      console.warn("[auto-eval] timeout 8s — abort, keep previous eval");
      sfR.current?.stop();
    },8000);
    sfR.current.eval(game.fen(),15,(cp,mate)=>{
      if(done)return;
      sEvalCp(cp*sign);sEvalMate(mate*sign);
    },()=>{done=true;clearTimeout(to)});
    return()=>{done=true;clearTimeout(to);sfR.current?.stop()};
  },[bk,tab,setup,think,over,sfOk]);

  // [reverted 2026-04-22] Earlier version of this effect terminated+reinit'd the Stockfish
  // worker on browseIdx/tab changes; deps included `tab` so every tab switch fired
  // `new SF(); s.init()` which loaded WASM and blocked the main thread ~500ms-1s each.
  // Symptoms: lag during play, premove setTimeout missing deadlines, clock intervals
  // getting throttled. The `stop()` call in the live-eval cleanup (plus stop at start
  // of SF.eval, see class) is enough to abort a stale search without worker recycling.

  // Auto-evaluate each move in analysis tab — progressive: fast pass (d10), then refine (d18)
  useEffect(()=>{
    if((tab!=="analysis"&&tab!=="coach")||!sfR.current?.ready()||hist.length===0)return;
    let cancelled=false;

    const evalAt=(fen:string,depth:number):Promise<{cp:number;mate:number}>=>{
      return new Promise(res=>{
        const turn=fen.split(" ")[1];
        let lastCp=0,lastMate=0;
        let done=false;
        const timeout=setTimeout(()=>{if(!done){done=true;res({cp:lastCp,mate:lastMate})}},8000);
        sfR.current!.eval(fen,depth,(c,m)=>{const sign=turn==="w"?1:-1;lastCp=c*sign;lastMate=m*sign},()=>{if(!done){done=true;clearTimeout(timeout);res({cp:lastCp,mate:lastMate})}});
      });
    };

    const classifyMove=(prevCp:number,currCp:number,turn:string)=>{
      const moverWasWhite=turn==="b";
      const prevFromMover=moverWasWhite?prevCp:-prevCp;
      const currFromMover=moverWasWhite?currCp:-currCp;
      const drop=prevFromMover-currFromMover;
      let quality:"great"|"good"|"inacc"|"mistake"|"blunder"="good";
      if(drop>=300)quality="blunder";
      else if(drop>=150)quality="mistake";
      else if(drop>=70)quality="inacc";
      else if(drop<=-50)quality="great";
      return quality;
    };

    (async()=>{
      // PHASE 1: Fast pass (depth 10) for moves not yet analyzed
      if(analysis.length<hist.length){
        const results=[...analysis];
        let prevCp=results.length>0?results[results.length-1].cp:0;
        for(let i=results.length;i<hist.length;i++){
          if(cancelled)return;
          const fen=fenHist[i+1];if(!fen)break;
          const ev=await evalAt(fen,10);
          const turn=fen.split(" ")[1];
          results.push({move:i+1,cp:ev.cp,mate:ev.mate,quality:classifyMove(prevCp,ev.cp,turn)});
          prevCp=ev.cp;
          if(cancelled)return;
          sAnalysis([...results]);
        }
      }
      // PHASE 2: Refine with depth 18 (slower but much more accurate)
      if(cancelled)return;
      const results2=[...(analysis.length>=hist.length?analysis:[])];
      if(results2.length<hist.length)return; // wait for phase 1 to complete
      sRefiningAnalysis(true);
      let prevCp2=0;
      for(let i=0;i<hist.length;i++){
        if(cancelled){sRefiningAnalysis(false);return;}
        const fen=fenHist[i+1];if(!fen)break;
        const ev=await evalAt(fen,18);
        const turn=fen.split(" ")[1];
        results2[i]={move:i+1,cp:ev.cp,mate:ev.mate,quality:classifyMove(prevCp2,ev.cp,turn)};
        prevCp2=ev.cp;
        if(cancelled){sRefiningAnalysis(false);return;}
        sAnalysis([...results2]);
      }
      sRefiningAnalysis(false);
    })();
    return()=>{cancelled=true};
  },[tab,hist.length,sfOk]);

  const exec=useCallback((from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>{
    const p=game.get(from);if(!p)return false;
    // ── OPENING TRAINER — верификация хода против скрипта дебюта ──
    if(openingDrill){
      const expectedSan=openingDrill.moves[openingDrill.ply];
      if(!expectedSan){return false}
      // Determine user's attempted SAN
      const probe=new Chess(game.fen());
      let attemptSan="";
      try{const pm=probe.move({from,to,promotion:pr||"q"});if(pm)attemptSan=pm.san}catch{}
      if(!attemptSan)return false;
      if(attemptSan!==expectedSan){
        showToast(`✗ Ожидалось ${expectedSan} · попробуй ещё`,"error");
        sOpeningDrill(d=>d?{...d,mistakes:d.mistakes+1}:null);
        snd("capture");
        return false;
      }
      // Correct — apply user move
      let mv;try{mv=game.move({from,to,promotion:pr||"q"});}catch{mv=null}
      if(!mv)return false;
      sLm({from:mv.from,to:mv.to});sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1);
      snd("move");
      const newPly=openingDrill.ply+1;
      if(newPly>=openingDrill.moves.length){
        const reward=openingDrill.mistakes===0?10:5;
        addChessy(reward,`Дебют ${openingDrill.name}`);
        showToast(`🎓 ${openingDrill.name} пройден! +${reward} Chessy`,"success");
        sOpeningDrill(null);
        return true;
      }
      // Schedule bot response from script
      sOpeningDrill(d=>d?{...d,ply:newPly}:null);
      setTimeout(()=>{
        const odSnap={moves:openingDrill.moves,name:openingDrill.name,mistakes:openingDrill.mistakes,ply:newPly};
        const botSan=odSnap.moves[odSnap.ply];if(!botSan)return;
        try{
          const bmv=game.move(botSan);
          if(bmv){
            sLm({from:bmv.from,to:bmv.to});sHist(h=>[...h,bmv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1);
            snd("move");
            const nextPly=odSnap.ply+1;
            if(nextPly>=odSnap.moves.length){
              const reward=odSnap.mistakes===0?10:5;
              addChessy(reward,`Дебют ${odSnap.name}`);
              showToast(`🎓 ${odSnap.name} пройден! +${reward} Chessy`,"success");
              sOpeningDrill(null);
            }else{
              sOpeningDrill(d=>d?{...d,ply:nextPly}:null);
            }
          }
        }catch{}
      },600);
      return true;
    }
    // Guess Best Move mode
    if(tab==="analysis"&&guessMode&&guessResult==="idle"&&guessBest){
      const attemptUci=`${from}${to}${pr||""}`;
      const isMatch=attemptUci===guessBest||attemptUci.slice(0,4)===guessBest.slice(0,4);
      if(isMatch){
        sGuessResult("correct");sGuessScore(s=>({right:s.right+1,total:s.total+1}));snd("check");
        showToast(`✓ Лучший ход! ${guessBestSan}`,"success");
        let mv;try{mv=game.move({from,to,promotion:pr||"q"});}catch{mv=null}
        if(mv){sLm({from:mv.from,to:mv.to});sBk(k=>k+1)}
        return true;
      }else{
        sGuessResult("wrong");sGuessScore(s=>({...s,total:s.total+1}));snd("capture");
        showToast(`✗ Лучше было ${guessBestSan}`,"error");
        return false;
      }
    }
    // Puzzle mode: verify solution before executing
    if(tab==="puzzles"&&pzCurrent&&pzAttempt==="idle"){
      const attemptUci=`${from}${to}${pr||""}`;
      const expectedUci=pzCurrent.sol[0];
      if(attemptUci===expectedUci||attemptUci.slice(0,4)===expectedUci.slice(0,4)){
        // Execute user's correct move
        let mv;try{mv=game.move({from,to,promotion:pr||"q"});}catch{mv=null}
        if(mv){sLm({from:mv.from,to:mv.to});sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1)}
        // Multi-move puzzle: play opponent response + user follow-up from sol[]
        if(pzCurrent.sol.length>1){
          // sol[1] is opponent's response — play it immediately (no think)
          const respUci=pzCurrent.sol[1];
          const rFrom=respUci.slice(0,2),rTo=respUci.slice(2,4),rPr=respUci.length>4?respUci[4]:undefined;
          setTimeout(()=>{
            try{
              const rmv=game.move({from:rFrom,to:rTo,promotion:rPr||"q"});
              if(rmv){sLm({from:rmv.from,to:rmv.to});sHist(h=>[...h,rmv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1);snd("move")}
              // If more moves in solution, user must continue
              if(pzCurrent.sol.length>2){
                // Shift solution forward so next user move is sol[2]
                sPzCurrent({...pzCurrent,sol:pzCurrent.sol.slice(2)});
                showToast("Продолжай решение...","info");
              }else{
                sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");
                // Rush: +1..+3 sec по сложности, streak, score, Chessy
                if(pzMode==="rush"){
                  const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
                  sPzTimeLeft(v=>Math.min(180,v+bonus));
                  sRushScore(s=>s+1);
                  sRushStreak(st=>{const n=st+1;sRushBestStreak(b=>Math.max(b,n));return n});
                  showToast(`✓ +${bonus}с · ${pzCurrent.r}`,"success");
                }else if(pzMode==="timed3"||pzMode==="timed5"){
                  const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
                  sPzTimeLeft(v=>v+bonus);
                  showToast(`✓ +${bonus}с`,"success");
                }else{
                  showToast(`✓ Решено! ${pzCurrent.name}`,"success");
                }
                const reward=Math.max(2,Math.round((pzCurrent.r||800)/200));
                addChessy(reward,"пазл решён");
                if(pzCurrent.theme==="Твоя ошибка"){addChessy(3,"🎯 ошибка исправлена")}
                if(dailyState&&!dailyState.solved&&PUZZLES[dailyState.idx]?.fen===pzCurrent.fen){
                  const next={...dailyState,solved:true};sDailyState(next);svDaily(next);
                  setTimeout(()=>addChessy(50,"☀ пазл дня"),800);
                }
              }
            }catch{}
          },100); // fast response, no thinking delay
        }else{
          // Single-move puzzle — solved
          sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");
          if(pzMode==="rush"){
            const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
            sPzTimeLeft(v=>Math.min(180,v+bonus));
            sRushScore(s=>s+1);
            sRushStreak(st=>{const n=st+1;sRushBestStreak(b=>Math.max(b,n));return n});
            showToast(`✓ +${bonus}с · ${pzCurrent.r}`,"success");
          }else if(pzMode==="timed3"||pzMode==="timed5"){
            const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
            sPzTimeLeft(v=>v+bonus);
            showToast(`✓ +${bonus}с`,"success");
          }else{
            showToast(`✓ Решено! ${pzCurrent.name}`,"success");
          }
          const reward=Math.max(2,Math.round((pzCurrent.r||800)/200));
          addChessy(reward,"пазл решён");
          if(pzCurrent.theme==="Твоя ошибка"){addChessy(3,"🎯 ошибка исправлена")}
          // Daily puzzle bonus — first solve today
          if(dailyState&&!dailyState.solved&&PUZZLES[dailyState.idx]?.fen===pzCurrent.fen){
            const next={...dailyState,solved:true};sDailyState(next);svDaily(next);
            setTimeout(()=>addChessy(50,"☀ пазл дня"),800);
          }
        }
        return true;
      }else{
        sPzAttempt("wrong");sPzFailedCount(c=>c+1);snd("capture");
        if(pzMode==="rush"){
          sPzTimeLeft(v=>Math.max(0,v-5));
          sRushStreak(0);
          showToast(`✗ −5с · streak сброшен`,"error");
          // Auto-advance in rush after miss (no retry)
          setTimeout(()=>{
            if(!fPz.length)return;
            const nextIdx=(pzI+1)%fPz.length;
            const pz=fPz[nextIdx];if(!pz)return;
            const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(nextIdx);sPzCurrent(pz);sPzAttempt("idle");
            sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);
            sCapW([]);sCapB([]);sOn(true);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");
          },700);
        }else{
          showToast(`✗ Not the best. Try again or see solution`,"error");
        }
        return false;
      }
    }
    let mv;
    try{mv=game.move({from,to,promotion:pr||"q"});}catch{return false;}
    if(!mv)return false;
    if(mv.captured)snd("capture");else if(mv.san.includes("O-"))snd("castle");else if(game.isCheck())snd("check");else snd("move");
    if(mv.captured){const cc=pc(mv.captured,mv.color==="w"?"b":"w");if(mv.color===pCol)sCapB(x=>[...x,cc]);else sCapW(x=>[...x,cc])}
    if(mv.color===pCol)pT.addInc();else aT.addInc();
    sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sLm({from:mv.from,to:mv.to});sSel(null);sVm(new Set());sBk(k=>k+1);
    if(game.isGameOver()){
      let r="";
      if(game.isCheckmate()){
        if(currentEndgame){
          // Endgame trainer: checkmate delivered by the trainee side?
          const traineeWon=game.turn()!==currentEndgame.side;
          r=traineeWon?"Checkmate — цель достигнута! 🏆":"Checkmate — соперник выиграл";
          if(traineeWon&&currentEndgame.goal==="Win"){
            setTimeout(()=>{addChessy(currentEndgame.reward,`🏰 ${currentEndgame.name}`);unlockAch("endgame_master",80,"Мастер эндшпилей")},600);
          }
          sCurrentEndgame(null);
        }else if(hotseat){
          // Local 2-player: no rating change, small shared Chessy for playing a full game
          const winner=game.turn()==="w"?"Чёрные":"Белые";
          r=`Checkmate — ${winner} победили`;
          setTimeout(()=>addChessy(3,"партия сыграна"),400);
        }else{
          const w=game.turn()===aiC;r=w?"Checkmate! You win! 🏆":"Checkmate — AI wins";
          if(w){
            const nr=Math.min(3000,rat+Math.max(5,Math.round((lv.elo-rat)*0.1+15)));sRat(nr);svR(nr);
            const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);showToast(`+${nr-rat} rating`,"success");
            // Chessy reward: scale by AI difficulty × time category
            const aiMul=[0.2,0.5,1,1.5,2.5,4][aiI]||1;
            const timeMul=tc.ini<=0?1:Math.max(0.5,Math.min(3,tc.ini/300));
            const reward=Math.max(5,Math.round(10*aiMul*timeMul));
            setTimeout(()=>addChessy(reward,`победа над ${lv.name}`),400);
            // Achievements
            const newWinCount=sts.w+1;
            setTimeout(()=>{
              if(newWinCount===1)unlockAch("first_win",50,"Первая победа");
              if(newWinCount===10)unlockAch("wins_10",100,"10 побед");
              if(newWinCount===50)unlockAch("wins_50",300,"50 побед");
              if(aiI>=5)unlockAch("beat_master",200,"Победа над Master");
              if(aiI>=4)unlockAch("beat_expert",100,"Победа над Expert");
            },900);
          }
          else{const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns)}
        }
      }
      else{r=game.isStalemate()?"Stalemate":game.isThreefoldRepetition()?"Threefold repetition":game.isInsufficientMaterial()?"Insufficient material":"50-move draw";
        if(!hotseat&&!currentEndgame){const ns={...sts,d:sts.d+1};sSts(ns);svS(ns)}
        // Draw gives small consolation
        setTimeout(()=>addChessy(2,"ничья"),400);
        // Endgame trainer: draw target met?
        if(currentEndgame&&currentEndgame.goal==="Draw"){
          setTimeout(()=>{addChessy(currentEndgame.reward,`🏰 ${currentEndgame.name} — цель достигнута`);unlockAch("endgame_master",80,"Мастер эндшпилей")},600);
          sCurrentEndgame(null);
        }
      }
      sOver(r);snd("x");sOn(false);sPms([]);
      // Save to history
      const cat=tc.ini<=0?"Classical":tc.ini<=120?"Bullet":tc.ini<=300?"Blitz":tc.ini<=900?"Rapid":"Classical";
      const sg:SavedGame={id:Date.now().toString(36),date:new Date().toISOString(),moves:[...hist,mv.san],result:r,playerColor:pCol,aiLevel:hotseat?"Human vs Human":lv.name,rating:rat,tc:`${Math.floor(tc.ini/60)}+${tc.inc}`,category:cat as any,opening:currentOpening?.name};
      saveGame(sg);sSavedGames(loadGames())}
    return true},[game,rat,lv.elo,lv.name,pCol,aiC,pT,aT,showToast,bk,sts,tab,pzCurrent,pzAttempt,guessMode,guessResult,guessBest,guessBestSan,aiI,tc.ini,addChessy,unlockAch,hotseat,dailyState,currentEndgame]);

  /* ── Premove execution ── */
  const doPremove=useCallback(()=>{
    const curPms=pmsRef.current;
    if(game.turn()!==pCol||over||!curPms.length)return;
    // Skip invalid premoves at the head of the queue until we find a valid one
    const mvs=game.moves({verbose:true});
    let idx=0;
    while(idx<curPms.length){
      const pm=curPms[idx];
      const ok=mvs.find(m=>m.from===pm.from&&m.to===pm.to&&(pm.pr?m.promotion===pm.pr:!m.promotion));
      if(ok){
        const rest=curPms.slice(idx+1);
        sPms(rest);
        exec(pm.from,pm.to,pm.pr);
        snd("premove");
        return;
      }
      idx++;
    }
    sPms([]);
  },[game,over,pCol,exec]);
  const doPremoveRef=useRef(doPremove);
  useEffect(()=>{doPremoveRef.current=doPremove},[doPremove]);

  /* ── Esc key: clear all premoves ── */
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){
        if(pms.length>0||pmSel){sPms([]);sPmSel(null)}
      }
      // Global shortcuts (but not while typing in input)
      const target=e.target as HTMLElement;
      if(target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT")return;
      if(e.key==="m"||e.key==="M"){e.preventDefault();sMuted(v=>{const nv=!v;showToast(nv?"Muted":"Sound on","info");return nv})}
      if(e.key==="f"||e.key==="F"){e.preventDefault();sFlip(v=>!v)}
      if(e.key==="?"||(e.key==="/"&&e.shiftKey)){e.preventDefault();sShowHelp(v=>!v)}
      if(e.key==="n"||e.key==="N"){const c=kbCtxRef.current;if(c.tab==="play"&&(c.setup||!c.on)){e.preventDefault();newGRef.current()}}
      if(hist.length===0)return;
      if(e.key==="ArrowLeft"){
        e.preventDefault();
        const cur=browseIdx<0?hist.length:browseIdx;
        const ni=Math.max(0,cur-1);
        try{const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni);sLm(null);sSel(null);sVm(new Set());}catch{}
      }
      if(e.key==="ArrowRight"){
        e.preventDefault();
        const cur=browseIdx<0?hist.length:browseIdx;
        const ni=Math.min(hist.length,cur+1);
        try{const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni>=hist.length?-1:ni);sLm(null);sSel(null);sVm(new Set());}catch{}
      }
      if(e.key==="Home"){
        e.preventDefault();
        try{const g=new Chess(fenHist[0]);setGame(g);sBk(k=>k+1);sBrowseIdx(0);sLm(null);sSel(null);sVm(new Set());}catch{}
      }
      if(e.key==="End"){
        e.preventDefault();
        try{const g=new Chess(fenHist[fenHist.length-1]);setGame(g);sBk(k=>k+1);sBrowseIdx(-1);sLm(null);sSel(null);sVm(new Set());}catch{}
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[pms.length,pmSel,hist.length,fenHist,browseIdx]);

  /* ── Rival learning — after each encounter, adapt profile and save ── */
  const rivalLearnedRef=useRef<string|null>(null);
  useEffect(()=>{
    if(!rivalMode||!over||!rivalProfile)return;
    // Identify this specific game so we don't double-learn
    const gameKey=`${fenHist.length}-${over}`;
    if(rivalLearnedRef.current===gameKey)return;
    rivalLearnedRef.current=gameKey;
    // Determine result from Rival's perspective
    let rivalResult:"W"|"L"|"D";
    if(over.includes("You win")||over.includes("timed out")){rivalResult="L"}
    else if(over.includes("AI wins")||over.includes("resigned")){rivalResult="W"}
    else rivalResult="D";
    const updated=learnFromEncounter(rivalProfile,rivalResult,currentOpening?.name,hist.length,rat);
    sRivalProfile(updated);
    // Bonus Chessy for Rival encounters (twice regular)
    if(rivalResult==="L")addChessy(10,`🏆 победа над ${rivalProfile.name}`);
    else if(rivalResult==="D")addChessy(3,`🤝 ничья с ${rivalProfile.name}`);
  },[over,rivalMode,rivalProfile,currentOpening,hist.length,rat,addChessy,fenHist.length]);

  /* ── Variant: Twin Kings — losing the queen = losing the game ── */
  useEffect(()=>{
    if(variant!=="twinkings"||over||!on)return;
    const lossSide=twinKingsLossSide(game.fen());
    if(lossSide){
      const youLost=lossSide===pCol;
      sOver(youLost?"Твой королевский ферзь пал — поражение":"Королевский ферзь соперника пал — победа!");
      sOn(false);snd("x");
      if(!youLost){
        const nr=Math.min(3000,rat+12);sRat(nr);svR(nr);
        const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);
        setTimeout(()=>addChessy(15,"👑 Twin Kings — захват второго короля"),400);
      }else{
        const nr=Math.max(100,rat-10);sRat(nr);svR(nr);
        const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);
      }
    }
  },[bk,variant,over,on,game,pCol,rat,sts,addChessy]);

  /* ── Variant: King of the Hill — king on center square = win ── */
  useEffect(()=>{
    if(variant!=="kingofthehill"||over||!on)return;
    const winner=kothWinner(game.fen());
    if(winner){
      const youWon=winner===pCol;
      sOver(youWon?"⛰ Король взошёл на холм — победа!":"⛰ Соперник занял центр — поражение");
      sOn(false);snd("x");
      if(youWon){
        const nr=Math.min(3000,rat+10);sRat(nr);svR(nr);
        const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);
        setTimeout(()=>addChessy(12,"⛰ KotH — занял холм"),400);
      }else{
        const nr=Math.max(100,rat-8);sRat(nr);svR(nr);
        const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);
      }
    }
  },[bk,variant,over,on,game,pCol,rat,sts,addChessy]);

  /* ── Variant: Three-Check — track checks; 3 = win ── */
  useEffect(()=>{
    if(variant!=="threecheck"||over||!on||hist.length===0)return;
    if(lastCheckBkRef.current===bk)return;
    lastCheckBkRef.current=bk;
    if(!game.isCheck())return;
    // The side that just moved delivered the check (turn already toggled)
    const checker=game.turn()==="w"?"b":"w";
    if(checker==="w"){
      sChecksByWhite(c=>{
        const nv=c+1;
        if(nv>=3){
          const youWon=pCol==="w";
          setTimeout(()=>{
            sOver(youWon?"⚡ Три шаха — победа!":"⚡ Соперник дал 3 шаха — поражение");
            sOn(false);snd("x");
            if(youWon){const nr=Math.min(3000,rat+10);sRat(nr);svR(nr);const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);addChessy(12,"⚡ Three-Check")}
            else{const nr=Math.max(100,rat-8);sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns)}
          },50);
        }
        return nv;
      });
    }else{
      sChecksByBlack(c=>{
        const nv=c+1;
        if(nv>=3){
          const youWon=pCol==="b";
          setTimeout(()=>{
            sOver(youWon?"⚡ Три шаха — победа!":"⚡ Соперник дал 3 шаха — поражение");
            sOn(false);snd("x");
            if(youWon){const nr=Math.min(3000,rat+10);sRat(nr);svR(nr);const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);addChessy(12,"⚡ Three-Check")}
            else{const nr=Math.max(100,rat-8);sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns)}
          },50);
        }
        return nv;
      });
    }
  },[bk,variant,over,on,hist.length,game,pCol,rat,sts,addChessy]);

  /* ── Variant: Atomic — explosion on every capture ── */
  const lastAtomicBkRef=useRef(-1);
  useEffect(()=>{
    if(variant!=="atomic"||over||!on||hist.length===0)return;
    if(lastAtomicBkRef.current===bk)return;
    lastAtomicBkRef.current=bk;
    const lastSan=hist[hist.length-1];
    if(!lastSan||!lastSan.includes("x"))return;
    // Find destination from last move (chess.js history records `to`)
    try{
      const verbose=game.history({verbose:true});
      const last=verbose[verbose.length-1];
      if(!last||!last.captured)return;
      const{fen:explodedFen,whiteKingDead,blackKingDead}=applyExplosion(game.fen(),last.to);
      try{
        const ng=new Chess(explodedFen);setGame(ng);sBk(k=>k+1);
        sFenHist(h=>[...h.slice(0,-1),explodedFen]);
        showToast(`💥 Взрыв на ${last.to}`,"info");
        if(whiteKingDead||blackKingDead){
          const youDied=(whiteKingDead&&pCol==="w")||(blackKingDead&&pCol==="b");
          setTimeout(()=>{
            sOver(youDied?"💥 Твой король взорван — поражение":"💥 Король соперника взорван — победа!");
            sOn(false);snd("x");
            if(!youDied){const nr=Math.min(3000,rat+10);sRat(nr);svR(nr);const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);addChessy(15,"💥 Atomic")}
            else{const nr=Math.max(100,rat-8);sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns)}
          },100);
        }
      }catch{}
    }catch{}
  },[bk,variant,over,on,hist.length,game,pCol,rat,sts,addChessy,showToast]);

  /* ── Variant: Power Drop / Crazyhouse — capture goes to pool ── */
  useEffect(()=>{
    if(variant!=="powerdrop"&&variant!=="crazyhouse")return;
    if(hist.length===0)return;
    if(lastCaptureBkRef.current===bk)return;
    lastCaptureBkRef.current=bk;
    try{
      const verbose=game.history({verbose:true});
      const last=verbose[verbose.length-1];
      if(!last||!last.captured)return;
      const capturer=last.color as "w"|"b";
      // For Crazyhouse: promoted pawns return as pawns (FIDE Crazyhouse rule)
      // chess.js doesn't distinguish — we approximate: if `last.flags.includes('p')`
      // the capturer captured a promoted piece; we still use type as captured
      sDropPool(p=>addToPool(p,last.captured!,capturer));
    }catch{}
  },[bk,variant,hist.length,game]);

  /* ── Variant: Reinforcement — spawn captured piece every 10 plies ── */
  useEffect(()=>{
    if(variant!=="reinforcement"||over||!on)return;
    if(hist.length<10||hist.length===reinfLastMoveRef.current)return;
    if(hist.length%10!==0)return;
    reinfLastMoveRef.current=hist.length;
    // Pick captured piece from BOTH pools (capW = pieces taken from white = belong to black)
    // capW stores symbols of captured-by-black white pieces; capB stores black pieces taken by white
    // Convert glyphs to chess.js codes is tricky — easier: pick from chess.js's own captured tracking
    // For simplicity, just spawn a random pawn for the side-to-move
    try{
      const sideToMove=game.turn();
      const captured:string[]=sideToMove==="w"?["P","N","B","R"]:["p","n","b","r"];
      const drop=pickReinforcement(captured,sideToMove,game.fen());
      if(drop){
        // Use chess.js .put to place piece
        const g=new Chess(game.fen());
        const pieceType=drop.piece.toLowerCase() as any;
        const color=drop.piece===drop.piece.toUpperCase()?"w":"b";
        g.put({type:pieceType,color},drop.sq as Square);
        // Re-init from new FEN
        const newFen=g.fen();
        try{const ng=new Chess(newFen);setGame(ng);sBk(k=>k+1);
          sFenHist(h=>[...h.slice(0,-1),newFen]);
          showToast(`🔄 Подкрепление: ${drop.piece} → ${drop.sq}`,"success");
        }catch{}
      }
    }catch{}
  },[hist.length,variant,over,on,game,showToast]);

  /* ── Variant: Diceblade — roll die before each move (player + AI) ── */
  useEffect(()=>{
    if(variant!=="diceblade"||over||!on)return;
    if(hist.length===0)return;
    // Re-roll on each new turn
    const d=rollDice();
    sDiceFace(d.face);sDicePieceType(d.pieceType);sDiceLabel(d.label);
  },[bk,variant,over,on]);

  /* ── Ghost Mode: bonus Chessy on win over GM ghost ── */
  const ghostLearnedRef=useRef<string|null>(null);
  useEffect(()=>{
    if(!ghostMode||!activeGhost||!over)return;
    const key=`${activeGhost.id}-${fenHist.length}-${over}`;
    if(ghostLearnedRef.current===key)return;
    ghostLearnedRef.current=key;
    if(over.includes("You win")||over.includes("timed out")){
      addChessy(25,`👻 победа над призраком ${activeGhost.name}`);
    }else if(over.includes("Stalemate")||over.includes("draw")||over.includes("repetition")||over.includes("Insufficient")||over.includes("50-move")){
      addChessy(8,`🤝 ничья с призраком ${activeGhost.name}`);
    }
  },[over,ghostMode,activeGhost,fenHist.length,addChessy]);

  /* ── Per-variant stats + Daily Variant Challenge bonus ── */
  useEffect(()=>{
    if(!over||hotseat)return;
    const key=`${variant}-${fenHist.length}-${over}`;
    if(variantResultLearnedRef.current===key)return;
    variantResultLearnedRef.current=key;
    let res:"w"|"l"|"d";
    if(over.includes("You win")||over.includes("timed out")||over.includes("победа")||over.includes("ВЗОШЁЛ")||over.includes("взошёл"))res="w";
    else if(over.includes("AI wins")||over.includes("Checkmate — AI")||over.includes("поражение")||over.includes("resigned"))res="l";
    else res="d";
    sVariantStats(s=>{
      const next=recordVariantResult(s,variant,res);
      // Variant achievements: trigger on first / 5 / 25 wins per variant
      if(res==="w"&&variant!=="standard"){
        const newWins=next[variant].w;
        if(newWins===1)setTimeout(()=>unlockAch(variantAchKey(variant,"first"),VARIANT_ACH_REWARDS.firstWin,variantAchLabel(variant,"first")),900);
        else if(newWins===5)setTimeout(()=>unlockAch(variantAchKey(variant,"five"),VARIANT_ACH_REWARDS.fiveWins,variantAchLabel(variant,"five")),900);
        else if(newWins===25)setTimeout(()=>unlockAch(variantAchKey(variant,"twentyfive"),VARIANT_ACH_REWARDS.twentyFiveWins,variantAchLabel(variant,"twentyfive")),900);
      }
      return next;
    });
    // Daily Variant Challenge: if today's daily matches current variant, award bonus
    const today=getDailyVariantState();
    if(today.variant===variant&&!today.played){
      const updated=markDailyVariantPlayed(res==="w");
      sDailyVariantInfo(updated);
      if(res==="w"){
        const meta=VARIANTS.find(v=>v.id===variant);
        setTimeout(()=>addChessy(50,`☀ Daily Challenge: ${meta?.name||variant}`),700);
      }
    }
  },[over,variant,fenHist.length,hotseat,addChessy]);

  /* ── Tournament: process result on game over, advance bracket ── */
  useEffect(()=>{
    if(!tournament||!tournamentOpponent||!over)return;
    const gameKey=`${tournament.id}-${tournament.currentRound}-${fenHist.length}-${over}`;
    if(tournamentLearnedRef.current===gameKey)return;
    tournamentLearnedRef.current=gameKey;
    let res:"win"|"lose"|"draw";
    if(over.includes("You win")||over.includes("timed out"))res="win";
    else if(over.includes("AI wins")||over.includes("Checkmate — AI"))res="lose";
    else res="draw";
    const reward=res==="win"?15:res==="draw"?5:0;
    if(reward>0)addChessy(reward,`турнир: ${res==="win"?"победа":"ничья"} с ${tournamentOpponent.name}`);
    sTournament(prev=>{
      if(!prev)return prev;
      let t=applyPlayerResult(prev,res);
      // Resolve all bot vs bot matches in this round
      t=resolveBotMatches(t);
      // Advance to next round if all winners known
      t=advanceBracket(t);
      // If still in same round and there's another player match, no-op (loop ends)
      // If currentRound advanced, also resolve bot matches in new round
      if(t.currentRound!==prev.currentRound){
        t=resolveBotMatches(t);
        t=advanceBracket(t);
      }
      // Tournament finished?
      if(t.currentRound==="done"){
        const place=finalPlace(t);
        if(place){
          const reward2=placeReward(place);
          const def=defeatedByPlayer(t);
          const trophy:Trophy={v:1,ts:Date.now(),place,defeated:def,reward:reward2,variant:t.variant};
          sTrophies(list=>[trophy,...list].slice(0,50));
          setTimeout(()=>{
            addChessy(reward2,place===1?"🏆 1-е место в турнире":place===2?"🥈 2-е место":place===4?"🥉 финал-4":"турнир: 1/4 финала");
            sShowTournament(true);
          },800);
        }
      }
      return t;
    });
    sTournamentOpponent(null);
  },[over,tournament,tournamentOpponent,fenHist.length,addChessy]);

  /* ── Autosave in-progress game ── */
  useEffect(()=>{
    if(tab!=="play"||!on||over||setup||hist.length===0)return;
    const snap:ResumeSnap={v:1,fen:game.fen(),hist,fenHist,pCol,aiI,tcI,useCustom,customMin,customInc,timeP:pT.time,timeA:aT.time,capW,capB,ts:Date.now()};
    saveResume(snap);
  },[bk,tab,on,over,setup,hist.length]);
  useEffect(()=>{if(over)clearResume()},[over]);

  /* ── Auto post-game analysis in Play/Coach for instant accuracy card ── */
  useEffect(()=>{
    if(!over||(tab!=="play"&&tab!=="coach"))return;
    if(!sfR.current?.ready()||fenHist.length<3)return;
    if(analysis.length>=hist.length||analyzing)return;
    const t=setTimeout(()=>runAnalysis(),400);
    return()=>clearTimeout(t);
  },[over,tab,sfOk,fenHist.length]);

  /* ── Live Voice Commentary — Coach speaks after every move when enabled. ── */
  const lastCommentaryBkRef=useRef<number>(-1);
  useEffect(()=>{
    if(!liveCommentary)return;
    if(tab!=="play"&&tab!=="coach")return;
    if(!on||over||setup)return;
    if(hist.length===0)return;
    if(lastCommentaryBkRef.current===bk)return;
    lastCommentaryBkRef.current=bk;
    if(typeof window==="undefined"||!window.speechSynthesis)return;
    const lastSan=hist[hist.length-1];if(!lastSan)return;
    const wasMyMove=hist.length%2===(pCol==="w"?1:0);
    const isCapture=lastSan.includes("x");
    const isCheck=lastSan.endsWith("+");
    const isMate=lastSan.endsWith("#");
    const isCastle=lastSan.startsWith("O");
    const isPromotion=lastSan.includes("=");
    let comment="";
    if(isMate){comment=wasMyMove?"Мат! Отличная партия":"Мат. Хорошая игра"}
    else if(isPromotion){comment=wasMyMove?"Превращение, новая фигура":"Соперник превратил пешку"}
    else if(isCheck){comment="Шах"}
    else if(isCastle){comment=wasMyMove?"Король в безопасности":"Соперник укрыл короля"}
    else if(isCapture&&wasMyMove){comment="Ты взял фигуру"}
    else if(isCapture&&!wasMyMove){comment="Внимание, соперник взял"}
    // Engine-based delta (only on every 3rd move to avoid spam)
    else if(hist.length%3===0&&Math.abs(evalCp)>=120){
      const favoringMe=(evalCp>0)===(pCol==="w");
      comment=favoringMe?"Позиция складывается в твою пользу":"Будь внимателен, позиция ухудшается";
    }
    if(!comment)return;
    try{
      const utt=new SpeechSynthesisUtterance(comment);
      utt.lang="ru-RU";utt.rate=1.15;utt.volume=0.75;utt.pitch=1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    }catch{}
  },[bk,liveCommentary,tab,on,over,setup,hist.length,pCol,evalCp]);

  /* ── Clear annotations on tab switch, on a new move, and on history browse ── */
  useEffect(()=>{clearAnnotations()},[tab,clearAnnotations]);
  useEffect(()=>{clearAnnotations()},[bk,clearAnnotations]);
  useEffect(()=>{clearAnnotations()},[browseIdx,clearAnnotations]);

  /* ── Replay auto-advance ── */
  useEffect(()=>{
    if(!replaying||hist.length===0)return;
    const t=setInterval(()=>{
      const cur=browseIdx<0?hist.length:browseIdx;
      const ni=cur+1;
      if(ni>=hist.length){sReplaying(false);sBrowseIdx(-1);try{const g=new Chess(fenHist[fenHist.length-1]);setGame(g);sBk(k=>k+1)}catch{}return}
      try{const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni);sLm(null);sSel(null);sVm(new Set());snd("move")}catch{sReplaying(false)}
    },replaySpeed);
    return()=>clearInterval(t);
  },[replaying,replaySpeed,browseIdx,hist.length,fenHist]);

  /* ── Puzzle achievement tracker ── */
  useEffect(()=>{
    if(pzSolvedCount===10)unlockAch("puzzles_10",30,"10 пазлов решено");
    if(pzSolvedCount===50)unlockAch("puzzles_50",150,"50 пазлов решено");
    if(pzSolvedCount===100)unlockAch("puzzles_100",400,"100 пазлов решено");
  },[pzSolvedCount,unlockAch]);

  /* ── Premove trigger — микрозадача, чтобы не блокировать паинт; без pms в deps,
     pmsRef читаем напрямую → нет каскада re-render'ов, если sPms(rest) обновил массив. ── */
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(game.turn()!==pCol)return;
    if(pmsRef.current.length===0)return;
    const id=requestAnimationFrame(()=>doPremoveRef.current());
    return()=>cancelAnimationFrame(id);
  },[bk,over,on,tab,pCol,pms.length]);

  /* ── AI turn trigger ── */
  // Snapshot fen at trigger time so a late-arriving Stockfish bestmove
  // can't try to apply itself on a position the user has already moved on.
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(hotseat)return; // two-player hotseat: no AI moves
    if(openingDrill)return; // Opening Trainer plays bot moves from script
    if(game.turn()===pCol)return;
    sThink(true);
    const tcMul=tc.ini<=0?1:tc.ini<=60?0.3:tc.ini<=180?0.5:tc.ini<=300?0.7:tc.ini<=600?1:tc.ini<=900?1.5:2;const delay=lv.thinkMs*tcMul*(0.7+Math.random()*0.6);
    const fenAtTrigger=game.fen();
    // Power Drop / Crazyhouse: AI may choose to drop a piece instead of moving
    // Strategy: with prob = 0.25 (Crazyhouse) or 0.4 (PowerDrop, since rarer), drop highest-value piece
    if((variant==="powerdrop"||variant==="crazyhouse")&&!cloneMode&&!ghostMode){
      const dropEvery=variant==="crazyhouse"?1:5;
      const aiCol=pCol==="w"?"b":"w";
      const canAiDrop=isDropAvailable(hist.length,dropEvery)&&poolSize(dropPool,aiCol)>0;
      const dropProb=variant==="crazyhouse"?0.25:0.5;
      if(canAiDrop&&Math.random()<dropProb){
        const t=setTimeout(()=>{
          try{
            if(game.fen()!==fenAtTrigger){sThink(false);return}
            const aiPool=dropPool[aiCol];
            // Pick highest-value piece in pool
            const types:("q"|"r"|"b"|"n"|"p")[]=["q","r","b","n","p"];
            const pickType=types.find(t=>aiPool[t]>0);
            if(!pickType){sThink(false);return}
            // Find best empty target (rough heuristic): prefer near opponent king
            const ck=new Chess(fenAtTrigger);
            const board=ck.board();
            let oppKingFile=4,oppKingRank=pCol==="w"?0:7;
            for(let r=0;r<8;r++)for(let c=0;c<8;c++){
              const p=board[r][c];if(p?.type==="k"&&p.color===pCol){oppKingFile=c;oppKingRank=r}
            }
            const candidates:string[]=[];
            for(let r=0;r<8;r++)for(let c=0;c<8;c++){
              if(board[r][c])continue;
              const sq=`${"abcdefgh"[c]}${8-r}`;
              if(!isDropLegal(dropPool,pickType,aiCol,sq,fenAtTrigger))continue;
              const dist=Math.abs(c-oppKingFile)+Math.abs(r-oppKingRank);
              candidates.push(sq+":"+(8-dist));
            }
            if(candidates.length===0){sThink(false);return}
            candidates.sort((a,b)=>parseInt(b.split(":")[1])-parseInt(a.split(":")[1]));
            // Pick top-3 randomly to avoid determinism
            const top=candidates.slice(0,Math.min(3,candidates.length));
            const sq=top[Math.floor(Math.random()*top.length)].split(":")[0];
            const newFen=applyDrop(fenAtTrigger,pickType,aiCol,sq);
            const ng=new Chess(newFen);setGame(ng);sBk(k=>k+1);
            sFenHist(h=>[...h,newFen]);
            sHist(h=>[...h,`@${pickType.toUpperCase()}${sq}`]);
            sDropPool(p=>removeFromPool(p,pickType,aiCol));
            const symAi=aiCol==="w"?pickType.toUpperCase():pickType;
            showToast(`🤖 AI: drop ${POOL_GLYPH[symAi]} → ${sq}`,"info");
            snd("move");
          }catch{}
          sThink(false);
        },Math.max(800,delay));
        return()=>clearTimeout(t);
      }
    }
    // Style Cloner: force preferred opening move for first 8 plies
    if(cloneMode&&activeClone){
      const preferred=clonePreferredMove(activeClone,hist);
      if(preferred){
        const t=setTimeout(()=>{
          try{
            if(game.fen()!==fenAtTrigger){sThink(false);return}
            const c=new Chess(fenAtTrigger);
            const mv=c.move(preferred);
            if(mv)exec(mv.from as Square,mv.to as Square,mv.promotion as any);
          }catch{}
          sThink(false);
        },Math.max(500,delay*0.6));
        return()=>clearTimeout(t);
      }
    }
    // Ghost Mode: book lookup → exact GM move; otherwise style-weighted pick
    if(ghostMode&&activeGhost){
      try{
        const ck=new Chess(fenAtTrigger);
        const bookSan=ghostBookMove(activeGhost,ck);
        if(bookSan){
          const t=setTimeout(()=>{
            try{
              if(game.fen()!==fenAtTrigger){sThink(false);return}
              const c=new Chess(fenAtTrigger);
              const mv=c.move(bookSan);
              if(mv)exec(mv.from as Square,mv.to as Square,mv.promotion as any);
            }catch{}
            sThink(false);
          },Math.max(700,delay*0.7));
          return()=>clearTimeout(t);
        }
        // Out of book: style-weighted pick from minimax candidates (top 5 by depth-3 eval)
        const t=setTimeout(()=>{
          try{
            if(game.fen()!==fenAtTrigger){sThink(false);return}
            const c=new Chess(fenAtTrigger);
            const all=c.moves({verbose:true});
            if(!all.length){sThink(false);return}
            // Quick depth-3 eval per move, take top 5, then style-weight
            const evals=all.map(m=>{
              c.move(m);
              const s=mm(c,2,-Infinity,Infinity,c.turn()==="w");
              c.undo();
              return{m,s:c.turn()==="w"?-s:s};
            });
            evals.sort((a,b)=>b.s-a.s);
            const top=evals.slice(0,Math.min(5,evals.length)).map(e=>e.m);
            const ck2=new Chess(fenAtTrigger);
            const pick=pickGhostStyleMove(activeGhost,ck2,top);
            if(pick)exec(pick.from as Square,pick.to as Square,pick.promotion as any);
          }catch{}
          sThink(false);
        },delay);
        return()=>clearTimeout(t);
      }catch{sThink(false)}
    }
    // Variant: Diceblade — restrict to moves of the rolled piece type
    if(variant==="diceblade"){
      const t=setTimeout(()=>{
        try{
          if(game.fen()!==fenAtTrigger){sThink(false);return}
          const c=new Chess(fenAtTrigger);
          const all=c.moves({verbose:true});
          const allowed=dicePieceType?filterMovesByDice(all,dicePieceType):all;
          if(allowed.length===0){
            // No legal piece-of-type moves → pass turn (toggle FEN side)
            try{
              const parts=fenAtTrigger.split(" ");parts[1]=parts[1]==="w"?"b":"w";
              const ng=new Chess(parts.join(" "));setGame(ng);sBk(k=>k+1);
              showToast(`🎲 AI пропускает ход (${diceLabel})`,"info");
            }catch{}
          }else{
            // Pick random-ish best from allowed (mini search not worth it here)
            const scored=allowed.map(m=>{c.move(m);const s=ev(c)*(c.turn()==="w"?-1:1);c.undo();return{m,s:s+(Math.random()-0.5)*30}});
            scored.sort((a,b)=>b.s-a.s);
            const b=scored[0].m;
            exec(b.from as Square,b.to as Square,b.promotion as any);
          }
        }catch{}
        sThink(false);
      },delay);
      return()=>clearTimeout(t);
    }
    if(useSF&&sfR.current?.ready()){
      const t=setTimeout(()=>sfR.current!.go(fenAtTrigger,SFD[aiI]||10,(f,t2,p)=>{
        // Only apply if the board is still on the same position we asked about.
        try{if(game.fen()===fenAtTrigger&&f&&t2)exec(f as Square,t2 as Square,(p||undefined) as any)}catch{}
        sThink(false);
      }),Math.max(800,delay));
      return()=>clearTimeout(t);
    }
    const t=setTimeout(()=>{
      try{if(game.fen()!==fenAtTrigger){sThink(false);return}
        const c=new Chess(fenAtTrigger);const b=best(c,lv.depth,lv.rand);
        if(b)exec(b.from as Square,b.to as Square,b.promotion as any);
      }catch{}
      sThink(false);
    },delay);
    return()=>clearTimeout(t);
  },[bk,over,on,tab]);

  /* ── Click: normal move OR premove ── */
  const click=useCallback((sq:Square)=>{
    // ── BOARD EDITOR MODE (Coach tab) ──
    if(editorMode){
      try{
        const g=new Chess(game.fen());
        if(editorPiece){
          // Place piece
          g.put({type:editorPiece.type,color:editorPiece.color},sq);
        }else{
          // Remove piece (empty selector = eraser)
          g.remove(sq);
        }
        // Fix turn if needed
        const parts=g.fen().split(" ");
        parts[1]=editorTurn;
        try{g.load(parts.join(" "));setGame(g);sBk(k=>k+1);}
        catch{showToast("Invalid position","error");}
      }catch(e){showToast("Editor error","error");}
      return;
    }
    if(over)return;
    const isAiTurn=!hotseat&&game.turn()!==pCol;
    const curPms=pmsRef.current;
    const curPmSel=pmSelRef.current;

    // ── PREMOVE MODE (only when it's NOT player's turn) ──
    if(isAiTurn&&on){
      // Build virtual board to know what piece would be on each square after queued premoves
      const vGame=new Chess(game.fen());
      try{
        for(const pm of curPms){
          const fenParts=vGame.fen().split(" ");
          fenParts[1]=pCol;
          try{vGame.load(fenParts.join(" "));}catch{}
          const fp=vGame.get(pm.from);
          if(!fp||fp.color!==pCol)continue;
          try{vGame.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"});}catch{}
        }
      }catch{}
      const vp=vGame.get(sq);  // virtual piece at clicked square

      // Case 1: a square is already selected for premove
      if(curPmSel){
        // Same square clicked → deselect
        if(sq===curPmSel){sPmSel(null);return}
        const selPiece=vGame.get(curPmSel);
        // Check limit
        if(curPms.length>=pmLim){sPmSel(null);return}
        // Create premove (even onto own piece - it may be captured by opponent first)
        const pre:Pre={from:curPmSel,to:sq};
        const promoRank=pCol==="w"?"8":"1";
        if(selPiece?.type==="p"&&sq[1]===promoRank)pre.pr="q";
        console.log("[premove] queued",curPmSel+"→"+sq+(pre.pr?"="+pre.pr:""));
        sPms(v=>[...v,pre]);
        sPmSel(null);
        snd("premove");
        return;
      }

      // Case 2: no selection → click on own piece (real or virtual) starts new premove
      if(vp?.color===pCol){sPmSel(sq);return}

      // Case 3: click on source square of existing premove → remove that premove
      const pmIdx=curPms.findIndex(x=>x.from===sq);
      if(pmIdx>=0){sPms(v=>[...v.slice(0,pmIdx),...v.slice(pmIdx+1)]);return}

      // Case 4: empty click
      return;
    }

    // ── POWER DROP / CRAZYHOUSE: drop picker active → click on empty square = drop ──
    if((variant==="powerdrop"||variant==="crazyhouse")&&dropPickerOpen&&selectedDropPiece&&game.turn()===pCol){
      if(!isDropLegal(dropPool,selectedDropPiece,pCol,sq,game.fen())){
        showToast("Нельзя дропать сюда","error");return;
      }
      const newFen=applyDrop(game.fen(),selectedDropPiece,pCol,sq);
      try{
        const ng=new Chess(newFen);setGame(ng);sBk(k=>k+1);
        sFenHist(h=>[...h,newFen]);
        sHist(h=>[...h,`@${selectedDropPiece.toUpperCase()}${sq}`]);
        sDropPool(p=>removeFromPool(p,selectedDropPiece,pCol));
        sDropPickerOpen(false);sSelectedDropPiece(null);
        sLm(null);sSel(null);sVm(new Set());
        snd("move");
        showToast(`⚡ Drop: ${POOL_GLYPH[pCol==="w"?selectedDropPiece.toUpperCase():selectedDropPiece]} → ${sq}`,"success");
      }catch{showToast("Drop failed","error")}
      return;
    }

    // ── NORMAL MODE (your turn) ──
    if(think)return;
    const p=game.get(sq);
    // In analysis tab: play both sides freely (use whoever's turn it is)
    const sideToMove=(tab==="analysis"||hotseat)?game.turn():pCol;
    if(sel){
      if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){sPromo({from:sel,to:sq});return}exec(sel,sq);return}
      if(p?.color===sideToMove){sSel(sq);sVm(new Set((variant==="diceblade"&&dicePieceType?filterMovesByDice(game.moves({square:sq,verbose:true}),dicePieceType):game.moves({square:sq,verbose:true})).map(m=>m.to)));return}
      sSel(null);sVm(new Set());return;
    }
    if(p?.color===sideToMove){sSel(sq);sVm(new Set((variant==="diceblade"&&dicePieceType?filterMovesByDice(game.moves({square:sq,verbose:true}),dicePieceType):game.moves({square:sq,verbose:true})).map(m=>m.to)))}
  },[game,sel,vm,over,think,pCol,exec,on,pmLim,tab,editorMode,editorPiece,editorTurn,showToast]);

  /* ── Drag ── */
  const dRef=useRef<Square|null>(null);
  const dS=(sq:Square)=>{const p=game.get(sq);const side=tab==="analysis"?game.turn():pCol;if(p?.color===side&&!over){dRef.current=sq;if(tab==="analysis"||game.turn()===pCol){sSel(sq);sVm(new Set((variant==="diceblade"&&dicePieceType?filterMovesByDice(game.moves({square:sq,verbose:true}),dicePieceType):game.moves({square:sq,verbose:true})).map(m=>m.to)))}else sPmSel(sq)}};
  const dD=(sq:Square)=>{if(!dRef.current)return;const f=dRef.current;dRef.current=null;
    if(tab!=="analysis"&&game.turn()!==pCol&&on&&!over){if(pms.length>=pmLim)return;const p=game.get(f);const pre:Pre={from:f,to:sq};const promoRank=pCol==="w"?"8":"1";if(p?.type==="p"&&sq[1]===promoRank)pre.pr="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}
    if(vm.has(sq)){const mp=game.get(f);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))sPromo({from:f,to:sq});else exec(f,sq)}else{sSel(null);sVm(new Set())}};

  const newG=(c?:ChessColor)=>{const cl=c||pCol;
    // Determine starting FEN based on variant
    let startFen="";
    let armies:{white:ArmySlot[];black:ArmySlot[]}|null=null;
    if(variant==="fischer960"){startFen=fischer960Fen()}
    else if(variant==="asymmetric"){
      if(manualArmyFen){
        const built=buildArmyFen(builderWhite,builderBlack);
        if(built){startFen=built.fen;armies={white:built.whiteArmy,black:built.blackArmy}}
        else{const r=asymmetricFen();startFen=r.fen;armies={white:r.whiteArmy,black:r.blackArmy}}
      }else{
        const r=asymmetricFen();startFen=r.fen;armies={white:r.whiteArmy,black:r.blackArmy};
      }
    }
    else if(variant==="twinkings"){startFen=twinKingsFen()}
    else if(variant==="atomic"){startFen=atomicFen()}
    else if(variant==="kingofthehill"){startFen=kothFen()}
    else if(variant==="threecheck"){startFen=threeCheckFen()}
    else if(variant==="knightriders"){startFen=knightRidersFen()}
    else if(variant==="pawnapocalypse"){startFen=pawnApocalypseFen()}
    sVariantStartFen(startFen);sVariantArmies(armies);
    const ng=startFen?new Chess(startFen):new Chess();
    setGame(ng);sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([ng.fen()]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);sCurrentOpening(null);sGuessMode(false);sGuessResult("idle");sGuessBest("");sGuessBestSan("");sPzCurrent(null);sPzAttempt("idle");sBrowseIdx(-1);pT.reset();aT.reset();clearResume();
    reinfLastMoveRef.current=0;
    sChecksByWhite(0);sChecksByBlack(0);lastCheckBkRef.current=-1;
    sDropPool(EMPTY_POOL);sDropPickerOpen(false);sSelectedDropPiece(null);lastCaptureBkRef.current=-1;
    // Roll initial die for diceblade
    if(variant==="diceblade"){const d=rollDice();sDiceFace(d.face);sDicePieceType(d.pieceType);sDiceLabel(d.label)}
    const variantLabel=variant==="standard"?"":` · ${VARIANTS.find(v=>v.id===variant)?.name||""}`;
    showToast(`Playing ${cl==="w"?"White":"Black"}${variantLabel}`,"info");
    // Tutorial tip for non-standard variants — only show first 3 plays per variant
    const tip=VARIANT_TUTORIAL[variant];
    if(tip){
      const stats=variantStats[variant]||{w:0,l:0,d:0};
      const totalPlays=stats.w+stats.l+stats.d;
      if(totalPlays<3)setTimeout(()=>showToast(tip,"info"),1500);
    }
  };
  const resumeGame=(s:ResumeSnap)=>{
    try{
      sTab("play");
      sTcI(s.tcI);sUseCustom(s.useCustom);sCustomMin(s.customMin);sCustomInc(s.customInc);
      sPCol(s.pCol);sAiI(chessy.owned.master_ai?s.aiI:Math.min(s.aiI,4));sFlip(s.pCol==="b");
      const g=new Chess(s.fen);setGame(g);sBk(k=>k+1);
      sHist(s.hist);sFenHist(s.fenHist);sCapW(s.capW);sCapB(s.capB);
      sLm(null);sSel(null);sVm(new Set());sPromo(null);sThink(false);sPms([]);sPmSel(null);
      sOver(null);sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);
      sResumeOffer(null);
      // Restore timer clocks after the useTimer's [ini]-effect resyncs.
      // queueMicrotask runs before paint but after current effects; in practice
      // the ini-effect fires during commit so we need a real tick — use rAF
      // which lands just before the next paint, avoiding the ~ticking gap that
      // setTimeout(0) sometimes produces on throttled tabs.
      requestAnimationFrame(()=>{pT.setTime(s.timeP);aT.setTime(s.timeA)});
      showToast(`Партия восстановлена · ${s.hist.length} ходов`,"success");
    }catch{showToast("Не удалось восстановить партию","error");clearResume();sResumeOffer(null)}
  };
  const discardResume=()=>{clearResume();sResumeOffer(null)};
  // Tournament: start the next match (player vs current opponent)
  const startTournamentMatch=useCallback((opp:Persona)=>{
    sTab("play");sShowTournament(false);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);
    sTournamentOpponent(opp);
    // Switch to tournament's variant
    if(tournament?.variant){sVariant(tournament.variant)}
    // Map persona aiLevel directly (clamp to unlocked range)
    const lvl=chessy.owned.master_ai?Math.min(5,opp.aiLevel):Math.min(4,opp.aiLevel);
    sAiI(lvl);
    // 5+0 default for tournaments — short-format excitement
    sUseCustom(false);sTcI(9);
    // Color: alternate based on bracket — give player white in QF, alternate after
    const round=tournament?.currentRound;
    const color:ChessColor=round==="qf"?"w":round==="sf"?"b":(Math.random()<0.5?"w":"b");
    sPCol(color);
    setTimeout(()=>newG(color),50);
    const variantLabel=tournament?.variant&&tournament.variant!=="standard"?` · ${VARIANTS.find(v=>v.id===tournament.variant)?.name||""}`:"";
    showToast(`⚔ ${opp.name} (${opp.elo}) — ${opp.style}${variantLabel}. ${opp.motto}`,"info");
  },[chessy.owned.master_ai,tournament,newG,showToast]);
  const newGRef=useRef(newG);useEffect(()=>{newGRef.current=newG});
  const kbCtxRef=useRef({tab,on,setup});useEffect(()=>{kbCtxRef.current={tab,on,setup}});
  const loadEndgame=(eg:Endgame)=>{
    try{
      const g=new Chess(eg.fen);setGame(g);sBk(k=>k+1);
      sTab("coach");sCoachAIEnabled(false);sEditorMode(false);
      sHist([]);sFenHist([eg.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPms([]);sPmSel(null);
      sPCol(eg.side);sFlip(eg.side==="b");sOn(false);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
      sCurrentEndgame(eg);sShowEndgames(false);
      showToast(`🏰 ${eg.name} · цель: ${eg.goal==="Win"?"победа":"ничья"}`,"info");
    }catch{showToast("Не удалось загрузить эндшпиль","error")}
  };
  const loadDailyPuzzle=()=>{
    if(!dailyState||PUZZLES.length===0){showToast("Пазлы ещё грузятся…","info");return}
    const pz=PUZZLES[dailyState.idx]||PUZZLES[0];
    sTab("puzzles");
    const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzCurrent(pz);sPzAttempt("idle");sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);pT.reset();aT.reset();sPzTimeLeft(0);
    showToast(`☀ Пазл дня · ${pz.r}`,"info");
  };
  const ldPz=(i:number)=>{if(!PUZZLES.length){showToast("Loading puzzles...","info");return}const pz=fPz[i]||PUZZLES[0];if(!pz){showToast("No puzzles match filter","error");return}const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(i);sPzCurrent(pz);sPzAttempt("idle");sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);pT.reset();aT.reset();
    // Set timer based on mode
    if(pzMode==="timed3")sPzTimeLeft(180);
    else if(pzMode==="timed5")sPzTimeLeft(300);
    else sPzTimeLeft(0);
    showToast(`${pz.name} · ${pz.theme} · ${pz.r}`,"info")};

  // Next puzzle helper
  const nextPz=useCallback(()=>{const nextIdx=(pzI+1)%Math.max(1,fPz.length);ldPz(nextIdx)},[pzI,fPz.length]);
  const randomPz=useCallback(()=>{if(!fPz.length)return;ldPz(Math.floor(Math.random()*fPz.length))},[fPz.length]);

  /* ── Blunder Rewind — превращает блундер игрока в персональный пазл.
     Берёт позицию ДО ошибки, запрашивает у Stockfish лучший ход,
     загружает как обычный puzzle (reusing pzCurrent infra). ── */
  const rewindBlunder=useCallback((idx:number)=>{
    if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
    const fen=fenHist[idx];
    if(!fen){showToast("Позиция недоступна","error");return}
    const g=new Chess(fen);
    const side=g.turn();
    const phase=idx<16?"Opening":idx<50?"Middlegame":"Endgame";
    showToast("🧠 Считаю лучший ход…","info");
    sfR.current.go(fen,14,(f,t,p)=>{
      if(!f||!t){showToast("Не удалось найти лучший ход","error");return}
      const bestUci=f+t+(p||"");
      // Verify it's legal
      try{const mv=g.move({from:f as Square,to:t as Square,promotion:(p||"q") as any});if(!mv){showToast("Лучший ход не определён","error");return}g.undo();}catch{showToast("Лучший ход не определён","error");return}
      const pz:Puzzle={
        fen,
        sol:[bestUci],
        name:`Переиграть ход ${idx+1}`,
        r:1500,
        theme:"Твоя ошибка",
        phase:phase as any,
        side,
        goal:"Best move",
      };
      sTab("puzzles");
      const g2=new Chess(fen);setGame(g2);sBk(k=>k+1);sPzCurrent(pz);sPzAttempt("idle");
      sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([fen]);
      sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);
      sPCol(g2.turn());sFlip(g2.turn()==="b");sEvalCp(0);sEvalMate(0);sPzTimeLeft(0);
      showToast(`🎯 Переиграй ход ${idx+1}. Бонус +3 Chessy за правильный`,"info");
    });
  },[fenHist,showToast,pT,aT]);

  // Puzzle timer — in rush, keep ticking even during brief 'correct' state before auto-advance
  useEffect(()=>{
    if(tab!=="puzzles"||pzMode==="learn"||!pzCurrent||pzTimeLeft<=0)return;
    if(pzMode!=="rush"&&pzAttempt==="correct")return;
    const t=setInterval(()=>sPzTimeLeft(v=>{
      if(v<=1){
        if(pzMode!=="rush"){sPzFailedCount(c=>c+1);sPzAttempt("wrong")}
        return 0;
      }
      return v-1;
    }),1000);
    return()=>clearInterval(t);
  },[tab,pzMode,pzCurrent,pzAttempt,pzTimeLeft]);

  // Sync timer to current mode (fires on mode switch, even mid-puzzle)
  useEffect(()=>{
    if(tab!=="puzzles")return;
    if(pzMode==="timed3"){sPzTimeLeft(180);sRushActive(false)}
    else if(pzMode==="timed5"){sPzTimeLeft(300);sRushActive(false)}
    else if(pzMode==="rush"){sPzTimeLeft(90);sRushActive(true);sRushScore(0);sRushStreak(0);sRushBestStreak(0);sRushResult(null)}
    else {sPzTimeLeft(0);sRushActive(false)}
  },[pzMode,tab]);

  // Rush end-of-session detection — fire only once per session
  useEffect(()=>{
    if(!rushActive||pzTimeLeft>0||pzMode!=="rush")return;
    // Timer hit 0 during rush — finalize
    const chessy=rushScore*2+rushBestStreak; // 2 Chessy per solve + streak bonus
    const isNewBest=rushScore>rushBest;
    if(isNewBest){sRushBest(rushScore);try{localStorage.setItem("aevion_puzzle_rush_best_v1",String(rushScore))}catch{}}
    sRushResult({score:rushScore,streak:rushBestStreak,best:isNewBest?rushScore:rushBest,chessy,isNewBest});
    sRushActive(false);
    if(chessy>0)addChessy(chessy,`Puzzle Rush · ${rushScore} решено`);
    if(isNewBest&&rushScore>=10)unlockAch("rush_10",50,"Rush: 10 за сессию");
    if(isNewBest&&rushScore>=25)unlockAch("rush_25",200,"Rush: 25 за сессию");
  },[rushActive,pzTimeLeft,pzMode,rushScore,rushBestStreak,rushBest,addChessy,unlockAch]);

  // Auto-advance to next puzzle in rush/timed modes after a correct solve
  useEffect(()=>{
    if(pzAttempt!=="correct"||pzMode==="learn")return;
    const delay=pzMode==="rush"?600:1200;
    const t=setTimeout(()=>{
      if(!fPz.length)return;
      const nextIdx=(pzI+1)%fPz.length;
      const pz=fPz[nextIdx];if(!pz)return;
      const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(nextIdx);sPzCurrent(pz);sPzAttempt("idle");
      sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);
      sCapW([]);sCapB([]);sOn(true);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");
    },delay);
    return()=>clearTimeout(t);
  },[pzAttempt,pzMode,pzI,fPz]);

  // Auto-load first puzzle when filters change
  useEffect(()=>{
    if(tab!=="puzzles"||!fPz.length)return;
    // Load first puzzle from filtered list
    const pz=fPz[0];
    const g=new Chess(pz.fen);
    setGame(g);sBk(k=>k+1);sPzI(0);sPzCurrent(pz);sPzAttempt("idle");
    sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);
    sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");
    if(pzMode==="timed3")sPzTimeLeft(180);
    else if(pzMode==="timed5")sPzTimeLeft(300);
    else sPzTimeLeft(0);
  },[pzFilterGoal,pzFilterMate,pzFilterPhase,pzFilterTheme,pzFilterSide,PUZZLES.length,tab]);

  /* ── Post-game analysis ── */
  const runAnalysis=useCallback(async()=>{
    if(!sfR.current?.ready()||fenHist.length<3){showToast("Need Stockfish and a finished game","error");return}
    sAnalyzing(true);sAnalysis([]);
    const results:{move:number;cp:number;mate:number;quality:"great"|"good"|"inacc"|"mistake"|"blunder"}[]=[];
    let prevCp=0;
    for(let i=0;i<fenHist.length;i++){
      const fen=fenHist[i];const turn=fen.split(" ")[1];
      const{cp,mate}=await new Promise<{cp:number;mate:number}>(res=>{
        let lastCp=0,lastMate=0;
        sfR.current!.eval(fen,20,(c,m)=>{const sign=turn==="w"?1:-1;lastCp=c*sign;lastMate=m*sign},()=>res({cp:lastCp,mate:lastMate}));
      });
      if(i>0){
        // Evaluate quality of move played that led to this position
        // Move was by the side that just played (opposite of current turn)
        const moverWasWhite=turn==="b";const prev=moverWasWhite?prevCp:-prevCp;const curr=moverWasWhite?cp:-cp;
        const drop=prev-curr;
        let quality:"great"|"good"|"inacc"|"mistake"|"blunder"="good";
        if(drop>=300)quality="blunder";
        else if(drop>=150)quality="mistake";
        else if(drop>=70)quality="inacc";
        else if(drop<=-50)quality="great";
        results.push({move:i,cp,mate,quality});
      }
      prevCp=cp;
    }
    sAnalysis(results);sAnalyzing(false);sShowAnal(true);
  },[fenHist,showToast]);

  /* ── UCI moves to SAN ── */
  const uciToSan=(fen:string,uciMoves:string[]):string[]=>{
    try{const ch=new Chess(fen);return uciMoves.map(uci=>{
      try{const m=ch.move({from:uci.slice(0,2) as Square,to:uci.slice(2,4) as Square,promotion:uci.length>4?uci[4] as any:undefined});
      return m?m.san:"?"}catch{return "?"}}).filter(s=>s!=="?")}catch{return uciMoves}};

  /* ── MultiPV analysis ── */
  const runMultiPV=useCallback(()=>{
    if(!sfR.current?.ready()){showToast("Stockfish loading...","error");return}
    const fen=game.fen();sAnalFen(fen);sMpvRunning(true);sMpvLines([]);
    sfR.current.multiPV(fen,mpvDepth,mpvCount,(lines)=>{
      const turn=fen.split(" ")[1];const sign=turn==="w"?1:-1;
      sMpvLines(lines.map(l=>({...l,cp:l.cp*sign,mate:l.mate*sign})));
      sMpvRunning(false);
    });
  },[game,mpvDepth,mpvCount,showToast]);

  /* ── Promise wrappers for AiCoach v35 ── */
  // AiCoach calls these to get engine data before asking Claude for analysis.
  // We serialize calls through a queue because Stockfish is single-threaded and
  // concurrent multiPV/eval calls would clobber each other's callbacks.
  const engineQueue=useRef<Promise<unknown>>(Promise.resolve());
  const runEnginePromise=useCallback((fen:string,depth:number,pvCount:number):Promise<PVLine[]>=>{
    const next=engineQueue.current.then(()=>new Promise<PVLine[]>((resolve)=>{
      if(!sfR.current?.ready()){resolve([]);return}
      sfR.current.multiPV(fen,depth,pvCount,(lines)=>{
        // Return RAW lines (AiCoach normalizes sign itself based on side-to-move).
        resolve(lines);
      });
    }));
    engineQueue.current=next.catch(()=>{});
    return next;
  },[]);
  const quickEvalPromise=useCallback((fen:string,depth:number):Promise<{cp:number;mate:number}>=>{
    const next=engineQueue.current.then(()=>new Promise<{cp:number;mate:number}>((resolve)=>{
      if(!sfR.current?.ready()){resolve({cp:0,mate:0});return}
      let lastCp=0,lastMate=0;
      sfR.current.eval(fen,depth,(c,m)=>{lastCp=c;lastMate=m},()=>resolve({cp:lastCp,mate:lastMate}));
    }));
    engineQueue.current=next.catch(()=>({cp:0,mate:0}));
    return next;
  },[]);

  // Auto-run MultiPV in analysis tab (but not in guess mode)
  useEffect(()=>{
    if(tab!=="analysis"||!sfOk||guessMode)return;
    const t=setTimeout(()=>runMultiPV(),200);
    return()=>clearTimeout(t);
  },[bk,tab,sfOk,guessMode,browseIdx]);

  // Start guess mode: get best move silently
  const startGuess=useCallback(()=>{
    if(!sfR.current?.ready()){showToast("Stockfish loading...","error");return}
    sGuessMode(true);sGuessResult("idle");sGuessBest("");sGuessBestSan("");
    sMpvLines([]); // hide lines
    sfR.current.go(game.fen(),16,(f,t)=>{
      const uci=`${f}${t}`;sGuessBest(uci);
      // Convert to SAN
      try{const ch=new Chess(game.fen());const m=ch.move({from:f as Square,to:t as Square});sGuessBestSan(m?m.san:uci)}catch{sGuessBestSan(uci)}
    });
  },[game,showToast]);

  // Next guess position (random from current game or random position)
  const nextGuess=useCallback(()=>{
    sGuessResult("idle");sGuessBest("");sGuessBestSan("");
    // If we have game history, pick random position from it
    if(fenHist.length>2){
      const idx=Math.floor(Math.random()*(fenHist.length-1));
      const g=new Chess(fenHist[idx]);setGame(g);sBk(k=>k+1);
      sSel(null);sVm(new Set());sLm(null);sPCol(g.turn());sFlip(g.turn()==="b");
    }
    setTimeout(()=>startGuess(),100);
  },[fenHist,startGuess]);

  const pmSet=useMemo(()=>{
    const s=new Set<string>();pms.forEach(p=>{s.add(p.from);s.add(p.to)});return s;
  },[pms]);
  const pmToIdx=useMemo(()=>{
    const m=new Map<string,number>();pms.forEach((p,i)=>{if(!m.has(p.to))m.set(p.to,i+1)});return m;
  },[pms]);
  // Virtual board is expensive (FEN round-trip + moves). Memo by bk + pms length/signature.
  const virtualGame=useMemo(()=>{
    if(pms.length===0)return game;
    try{
      const g=new Chess(game.fen());
      for(const pm of pms){
        const fenParts=g.fen().split(" ");
        fenParts[1]=pCol;
        try{g.load(fenParts.join(" "));}catch{}
        const from=g.get(pm.from);
        if(!from||from.color!==pCol)continue;
        try{g.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"});}catch{}
      }
      return g;
    }catch{return game;}
  },[game,bk,pms,pCol]);
  const bd=virtualGame.board(),rws=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cls=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

  const btn=(label:string,onClick:()=>void,bg:string,fg:string,border?:string)=>(<button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,border:border||`1px solid ${T.border}`,background:bg,color:fg,fontSize:13,fontWeight:700,cursor:"pointer"}}>{label}</button>);

  return(<main style={{background:T.bg,minHeight:"100vh"}}>
    <ProductPageShell maxWidth={2000}><Wave1Nav/>
      {streamerMode&&<style>{`body{background:#0a0a0a !important}`}</style>}
      {streamerMode&&<div style={{position:"fixed",top:10,right:10,zIndex:300,display:"flex",gap:6}}>
        <div style={{padding:"6px 12px",background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.4)",borderRadius:8,color:"#a78bfa",fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}>📺 STREAMER MODE</div>
        <button onClick={()=>sStreamerMode(false)} style={{padding:"6px 10px",background:"rgba(255,255,255,0.1)",border:"1px solid rgba(255,255,255,0.2)",borderRadius:8,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>✕</button>
      </div>}
      {/* Sticky glass header */}
      {!streamerMode&&<div style={{
        position:"sticky",top:0,zIndex:Z.sticky,
        margin:"0 -12px 12px",padding:"10px 12px",
        background:CC.surfaceGlass,backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)",
        borderBottom:`1px solid ${CC.border}`,
        display:"flex",alignItems:"center",gap:SPACE[3],flexWrap:"wrap"
      }}>
        {/* Logo */}
        <div style={{display:"flex",alignItems:"center",gap:SPACE[2],flex:"0 0 auto"}}>
          <div style={{
            width:38,height:38,borderRadius:RADIUS.md,
            background:"linear-gradient(135deg,#059669 0%,#10b981 55%,#7c3aed 100%)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:19,color:"#fff",boxShadow:SHADOW.sm
          }}>♞</div>
          <div style={{lineHeight:1.15}}>
            <div style={{fontSize:15,fontWeight:900,color:CC.text,letterSpacing:0.2}}>CyberChess</div>
            <div className="cc-header-sub" style={{fontSize:11,color:CC.textDim,fontWeight:600}}>
              SF18 · {PUZZLES.length} puzzles{useSF&&sfOk?" · ⚡":""}
            </div>
          </div>
        </div>

        {/* Active variant indicator (sticky, visible always) */}
        {variant!=="standard"&&<button onClick={()=>sShowVariants(true)} className="cc-focus-ring"
          style={{
            display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",
            background:"linear-gradient(135deg,#fef3c7,#fed7aa)",
            border:"1px solid #fb923c",borderRadius:RADIUS.full,
            cursor:"pointer",fontSize:12,fontWeight:800,color:"#9a3412",
            boxShadow:"0 2px 6px rgba(251,146,60,0.2)",
            transition:`all ${MOTION.fast} ${MOTION.ease}`
          }}
          title="Активный режим — клик чтобы сменить">
          <span style={{fontSize:14}}>{VARIANTS.find(v=>v.id===variant)?.emoji}</span>
          <span>{VARIANTS.find(v=>v.id===variant)?.name}</span>
        </button>}

        <div style={{flex:1}}/>

        {/* Rating badge */}
        <div style={{
          display:"flex",alignItems:"center",gap:SPACE[2],padding:"4px 12px 4px 4px",
          background:CC.surface1,border:`1px solid ${CC.border}`,borderRadius:RADIUS.full,
          boxShadow:SHADOW.sm
        }} title={`Rating ${rat} · ${rk.t}`}>
          <div style={{
            width:28,height:28,borderRadius:"50%",
            background:CC.goldSoft,color:CC.gold,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:14,fontWeight:900
          }}>{rk.i}</div>
          <div style={{lineHeight:1.1}}>
            <div style={{fontSize:15,fontWeight:900,color:CC.gold}}>{rat}</div>
            <div style={{fontSize:10,color:CC.textDim,fontWeight:700,letterSpacing:0.2}}>{rk.t.toUpperCase()}</div>
          </div>
        </div>

        {/* Chessy balance pill + info button */}
        <div style={{display:"inline-flex",alignItems:"center",gap:2}}>
          <button
            onClick={()=>sShowShop(true)}
            title={`Chessy · баланс ${chessy.balance} · клик → магазин`}
            aria-label="Chessy shop"
            className="cc-focus-ring cc-touch"
            style={{
              display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",
              borderRadius:`${RADIUS.full}px 0 0 ${RADIUS.full}px`,
              border:"1px solid #fcd34d",borderRight:"none",
              background:"linear-gradient(135deg,#fef3c7,#fde68a)",
              boxShadow:"0 2px 6px rgba(217,119,6,0.18)",
              cursor:"pointer",fontSize:14,fontWeight:900,color:"#78350f",
              transition:`transform ${MOTION.fast} ${MOTION.ease}`
            }}
            onMouseDown={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(0.96)"}}
            onMouseUp={e=>{(e.currentTarget as HTMLButtonElement).style.transform=""}}
            onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform=""}}
          >
            <Icon.Coin width={18} height={18}/>
            <span>{chessy.balance}</span>
          </button>
          <button
            onClick={()=>sShowChessyInfo(true)}
            title="Что такое Chessy?"
            aria-label="Chessy info"
            className="cc-focus-ring cc-touch"
            style={{
              display:"inline-flex",alignItems:"center",justifyContent:"center",
              width:28,height:32,
              borderRadius:`0 ${RADIUS.full}px ${RADIUS.full}px 0`,
              border:"1px solid #fcd34d",
              background:"linear-gradient(135deg,#fde68a,#fcd34d)",
              boxShadow:"0 2px 6px rgba(217,119,6,0.18)",
              cursor:"pointer",color:"#78350f"
            }}
          >
            <Icon.Help width={14} height={14}/>
          </button>
        </div>

        {/* Icon buttons */}
        <Btn
          variant="secondary"
          size="sm"
          icon={<span style={{fontSize:14}}>📊</span>}
          onClick={()=>sShowVariantStats(true)}
          title="Статистика по 12 режимам"
          ariaLabel="Variant stats"
          style={{padding:"6px 10px",minHeight:36,minWidth:36}}
        />
        <Btn
          variant={streamerMode?"accent":"secondary"}
          size="sm"
          icon={<span style={{fontSize:14}}>📺</span>}
          active={streamerMode}
          onClick={()=>{sStreamerMode(v=>!v);showToast(streamerMode?"Обычный режим":"Streamer mode — OBS-ready","info")}}
          title={streamerMode?"Вернуть обычный вид":"Streamer mode для стримов (OBS)"}
          ariaLabel="Streamer mode"
          style={{padding:"6px 10px",minHeight:36,minWidth:36}}
        />
        <Btn
          variant={liveCommentary?"accent":"secondary"}
          size="sm"
          icon={<span style={{fontSize:13}}>🔊</span>}
          onClick={()=>{sLiveCommentary(v=>!v);showToast(liveCommentary?"Live-комментарии выкл":"Live-комментарии вкл · Coach говорит вслух каждый ход","info")}}
          title={liveCommentary?"Выключить live-комментарии":"Live commentary от Coach — читает ходы вслух"}
          ariaLabel="Live commentary toggle"
          active={liveCommentary}
          style={{padding:"6px 10px",minHeight:36,minWidth:36}}
        />
        <Btn
          variant="secondary"
          size="sm"
          icon={<Icon.Help/>}
          onClick={()=>sShowHelp(true)}
          title="Keyboard shortcuts (?)"
          ariaLabel="Keyboard shortcuts"
          style={{padding:"6px 10px",minHeight:36,minWidth:36}}
        />
        <Btn
          variant={muted?"danger":"secondary"}
          size="sm"
          icon={muted?<Icon.Mute/>:<Icon.Sound/>}
          onClick={()=>{sMuted(v=>!v);showToast(muted?"Sound on":"Muted","info")}}
          title={muted?"Unmute sounds (M)":"Mute sounds (M)"}
          ariaLabel={muted?"Unmute":"Mute"}
          style={{padding:"6px 10px",minHeight:36,minWidth:36}}
        />
      </div>}

      {/* Resume offer banner */}
      {resumeOffer&&(()=>{
        const s=resumeOffer;const ago=Math.round((Date.now()-s.ts)/60000);
        const tcLabel=s.useCustom?`${s.customMin}+${s.customInc}`:(TCS[s.tcI]?.name||"?");
        return <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",marginBottom:12,borderRadius:10,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",flexWrap:"wrap"}}>
          <div style={{fontSize:18}}>⏸</div>
          <div style={{flex:"1 1 200px",minWidth:0}}>
            <div style={{fontSize:14,fontWeight:800,color:"#92400e"}}>Незавершённая партия</div>
            <div style={{fontSize:13,color:"#b45309"}}>{s.hist.length} ходов · {tcLabel} · {s.pCol==="w"?"белыми":"чёрными"} · {ago<1?"только что":`${ago} мин назад`}</div>
          </div>
          <button onClick={()=>resumeGame(s)} style={{padding:"8px 16px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer"}}>▶ Продолжить</button>
          <button onClick={discardResume} style={{padding:"8px 14px",borderRadius:8,border:`1px solid #fcd34d`,background:"#fff",color:"#92400e",fontWeight:700,fontSize:13,cursor:"pointer"}}>Отменить</button>
        </div>;
      })()}

      {/* Tabs */}
      {!streamerMode&&<div style={{marginBottom:14,display:"flex",justifyContent:"flex-start"}}>
        <UiTabs<"play"|"puzzles"|"analysis"|"coach">
          variant="segment"
          size="md"
          value={tab}
          onChange={(t)=>{
            const fromPuzzle=tab==="puzzles"&&pzCurrent;
            sTab(t);
            if(t==="play")sSetup(true);
            else if(t==="puzzles"){sOver(null);ldPz(0);}
            else if(t==="coach"){
              const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sPzCurrent(null);sPzAttempt("idle");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sOver(null);sOn(false);sSetup(false);sPms([]);sPmSel(null);sPCol("w");sFlip(false);
            }
            else if(t==="analysis"&&fromPuzzle){
              const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sPzCurrent(null);sPzAttempt("idle");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol("w");sFlip(false);
            }
          }}
          tabs={[
            {value:"play",label:"Play",icon:<Icon.Play width={14} height={14}/>},
            {value:"puzzles",label:"Puzzles",icon:<Icon.Target width={14} height={14}/>},
            {value:"analysis",label:"Analysis",icon:<span style={{fontSize:13}}>⚡</span>},
            {value:"coach",label:"Coach",icon:<span style={{fontSize:13}}>🎓</span>},
          ]}
        />
      </div>}

      {/* LAUNCHPAD DASHBOARD */}
      {setup&&tab==="play"&&!streamerMode&&(()=>{
        const activeCat:"Bullet"|"Blitz"|"Rapid"|"Custom"=useCustom?"Custom":(TCS[tcI]?.cat as any)||"Blitz";
        const catTcs=TCS.map((t,i)=>({t,i})).filter(x=>x.t.cat===activeCat);
        const catColor={Bullet:"#dc2626",Blitz:"#f59e0b",Rapid:"#10b981",Classical:"#3b82f6",Custom:CC.accent}[activeCat];
        const totalGames=sts.w+sts.l+sts.d;
        const winPct=totalGames?Math.round(sts.w/totalGames*100):0;
        const achTotal=Object.keys(ACH_LABELS).length;
        const achGot=Object.keys(chessy.ach).length;
        const achPct=Math.round(achGot/achTotal*100);
        return<div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:SPACE[3]}}>

          {/* ─── HERO: format + color + AI + actions ─── */}
          <Card padding={SPACE[4]} elevation="md">
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))",gap:SPACE[4]}}>

              {/* Time format */}
              <div>
                <SectionHeader title="ФОРМАТ" hint={`≈ ${Math.round(tc.ini/60*2+tc.inc*0.5)} min`}/>
                <UiTabs<"Bullet"|"Blitz"|"Rapid"|"Custom">
                  variant="pill"
                  size="sm"
                  value={activeCat}
                  onChange={(c)=>{
                    if(c==="Custom"){sUseCustom(true);sShowCustom(true);return}
                    sUseCustom(false);
                    const first=TCS.findIndex(t=>t.cat===c);
                    if(first>=0)sTcI(first);
                  }}
                  tabs={[
                    {value:"Bullet",label:"Bullet"},
                    {value:"Blitz",label:"Blitz"},
                    {value:"Rapid",label:"Rapid"},
                    {value:"Custom",label:"Custom"},
                  ]}
                />
                {activeCat!=="Custom"?(
                  <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,marginTop:SPACE[2]}}>
                    {catTcs.map(({t,i})=>{
                      const selected=!useCustom&&tcI===i;
                      return <button key={i} onClick={()=>{sTcI(i);sUseCustom(false)}} className="cc-focus-ring"
                        style={{padding:"9px 0",borderRadius:RADIUS.sm,
                          border:selected?`2px solid ${catColor}`:`1px solid ${CC.border}`,
                          background:selected?`${catColor}15`:CC.surface1,
                          color:selected?catColor:CC.text,
                          fontSize:12,fontWeight:selected?900:700,cursor:"pointer",
                          fontFamily:"ui-monospace, SFMono-Regular, monospace",
                          transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                        {t.name}
                      </button>;
                    })}
                  </div>
                ):(
                  <div style={{marginTop:SPACE[2],display:"flex",gap:SPACE[2],alignItems:"center"}}>
                    <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:CC.textDim,fontWeight:700}}>
                      Min <input type="number" min={1} max={60} value={customMin}
                        onChange={e=>sCustomMin(Math.max(1,Math.min(60,+e.target.value||1)))}
                        style={{width:50,padding:"6px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontSize:13}}/>
                    </label>
                    <label style={{display:"flex",alignItems:"center",gap:4,fontSize:12,color:CC.textDim,fontWeight:700}}>
                      +Inc <input type="number" min={0} max={60} value={customInc}
                        onChange={e=>sCustomInc(Math.max(0,Math.min(60,+e.target.value||0)))}
                        style={{width:50,padding:"6px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontSize:13}}/>
                    </label>
                    <Badge tone="accent" size="md">{customMin}+{customInc}</Badge>
                  </div>
                )}
              </div>

              {/* Color */}
              <div>
                <SectionHeader title="ЦВЕТ"/>
                <div style={{display:"flex",gap:SPACE[2]}}>
                  {([["w","♔","Белые"],["b","♚","Чёрные"]] as const).map(([v,ic,name])=>{
                    const selected=pCol===v;
                    return <button key={v} onClick={()=>sPCol(v as ChessColor)} className="cc-focus-ring"
                      style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                        padding:"10px 0",borderRadius:RADIUS.md,
                        border:selected?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                        background:selected?CC.brandSoft:CC.surface1,
                        color:selected?CC.brand:CC.text,
                        cursor:"pointer",transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                      <span style={{fontSize:24,lineHeight:1}}>{ic}</span>
                      <span style={{fontSize:11,fontWeight:700}}>{name}</span>
                    </button>;
                  })}
                  <button onClick={()=>sPCol(Math.random()<0.5?"w":"b")} title="Random"
                    className="cc-focus-ring"
                    style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                      padding:"10px 0",borderRadius:RADIUS.md,
                      border:`1px dashed ${CC.borderStrong}`,background:CC.surface2,
                      color:CC.textDim,cursor:"pointer"}}>
                    <span style={{fontSize:22,lineHeight:1}}>🎲</span>
                    <span style={{fontSize:11,fontWeight:700}}>Random</span>
                  </button>
                </div>
              </div>

              {/* AI opponent */}
              <div>
                <SectionHeader title="СОПЕРНИК" hint={`${lv.name} · ${lv.elo} ELO${aiI===5&&!chessy.owned.master_ai?" 🔒":""}`}/>
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                  <input type="range" min={0} max={chessy.owned.master_ai?5:4}
                    value={Math.min(aiI,chessy.owned.master_ai?5:4)}
                    onChange={e=>{const v=+e.target.value;if(v===5&&!chessy.owned.master_ai){showToast("Master AI — premium. Купи в Chessy-магазине","info");sShowShop(true);return}sAiI(v)}}
                    style={{flex:1,accentColor:lv.color}}/>
                  <div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",
                    borderRadius:RADIUS.full,background:lv.color+"20",color:lv.color,
                    fontSize:12,fontWeight:900,minWidth:80,justifyContent:"center"}}>
                    {lv.name}{aiI>=3?" ⚡":""}
                  </div>
                </div>
                {!chessy.owned.master_ai&&<button onClick={()=>sShowShop(true)}
                  className="cc-focus-ring"
                  style={{marginTop:SPACE[2],padding:"5px 10px",borderRadius:RADIUS.sm,
                    border:"1px solid #fcd34d",background:"#fef3c7",color:"#92400e",
                    fontSize:12,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
                  🔒 Master AI · 30 Chessy
                </button>}
              </div>
            </div>

            {/* ─── Section 1: QUICK PLAY ─── */}
            <div style={{marginTop:SPACE[4]}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.brand,letterSpacing:1.5,textTransform:"uppercase" as const}}>▸ Быстрая игра</span>
                <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${CC.brand}33, transparent)`}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:SPACE[2]}}>
                <button onClick={()=>{sHotseat(false);sRivalMode(false);newG()}} className="cc-focus-ring cc-touch"
                  style={{padding:"16px 22px",borderRadius:RADIUS.lg,border:"none",
                    background:`linear-gradient(135deg,${CC.brand},#10b981 55%,#14b8a6)`,color:"#fff",
                    fontWeight:900,fontSize:16,cursor:"pointer",
                    boxShadow:"0 10px 24px rgba(5,150,105,0.38), inset 0 1px 0 rgba(255,255,255,0.25)",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",gap:SPACE[2],
                    letterSpacing:0.4,transition:`all ${MOTION.fast} ${MOTION.ease}`}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 14px 28px rgba(5,150,105,0.45), inset 0 1px 0 rgba(255,255,255,0.3)"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.transform="";(e.currentTarget as HTMLButtonElement).style.boxShadow="0 10px 24px rgba(5,150,105,0.38), inset 0 1px 0 rgba(255,255,255,0.25)"}}
                  onMouseDown={e=>{(e.currentTarget as HTMLButtonElement).style.transform="scale(0.98)"}}
                  onMouseUp={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"}}>
                  <Icon.Play width={18} height={18}/> QUICK START
                </button>
                <Btn size="lg" variant="secondary" onClick={()=>{
                  const targetIdx=rat<600?0:rat<900?1:rat<1300?2:rat<1700?3:rat<2100?4:5;
                  const capped=chessy.owned.master_ai?targetIdx:Math.min(targetIdx,4);
                  sAiI(capped);sHotseat(false);sRivalMode(false);
                  setTimeout(()=>newG(),50);
                }}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>⚡ Match Me</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>AI ≈ {rat}</span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>{sHotseat(true);sRivalMode(false);setTimeout(()=>newG(),50)}}
                  style={{background:"linear-gradient(135deg,#eff6ff,#dbeafe)",
                    border:"1px solid #bfdbfe",color:CC.info}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>👥 Vs Человек</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>один экран</span>
                  </div>
                </Btn>
              </div>
            </div>

            {/* ─── Section 2: GAME MODES ─── */}
            <div style={{marginTop:SPACE[4]}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <span style={{fontSize:10,fontWeight:900,color:"#9a3412",letterSpacing:1.5,textTransform:"uppercase" as const}}>▸ Режимы и оппоненты</span>
                <div style={{flex:1,height:1,background:`linear-gradient(90deg, #fb923c33, transparent)`}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(170px, 1fr))",gap:SPACE[2]}}>
                <Btn size="lg" variant="secondary" onClick={()=>sShowVariants(true)}
                  style={{background:"linear-gradient(135deg,#fef3c7,#fed7aa)",
                    border:"1px solid #fb923c",color:"#9a3412"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>🎲 Variants <Badge tone="gold" size="xs">{VARIANTS.length}</Badge></span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600,maxWidth:140,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>
                      {variant==="standard"?"Fischer 960 · Atomic · ...":VARIANTS.find(v=>v.id===variant)?.name||variant}
                    </span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>{
                  const r=randomVariant();
                  sVariant(r);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sTab("play");
                  if(r==="asymmetric")sManualArmyFen("");
                  setTimeout(()=>newG(),50);
                  showToast(`🎰 Surprise Me: ${VARIANTS.find(v=>v.id===r)?.name}`,"success");
                }} style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",
                  border:"1px solid #c4b5fd",color:CC.accent}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>🎰 Surprise Me</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>рандом-режим</span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>sShowTournament(true)}
                  style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",
                    border:"1px solid #fcd34d",color:"#92400e"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>🏆 Tournament</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>
                      {tournament?(tournament.currentRound==="done"?"открой ✓":`${tournament.currentRound.toUpperCase()}`):"8 ботов knockout"}
                    </span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>sShowGhost(true)}
                  style={{background:"linear-gradient(135deg,#1f2937,#0f172a)",
                    border:"1px solid #374151",color:"#fbbf24"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>👻 Ghost Mode</span>
                    <span style={{fontSize:11,color:"#9ca3af",fontWeight:600,maxWidth:140,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>
                      {ghostMode&&activeGhost?`vs ${activeGhost.name}`:"Magnus · Tal · Fischer"}
                    </span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>sShowCloner(true)}
                  style={{background:"linear-gradient(135deg,#ecfeff,#cffafe)",
                    border:"1px solid #67e8f9",color:"#155e75"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>🧬 Style Cloner</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>
                      {clones.length>0?`${clones.length} клон${clones.length===1?"":clones.length<5?"а":"ов"}`:"Lichess → бот"}
                    </span>
                  </div>
                </Btn>
                {chessy.owned.ai_rival&&<Btn size="lg" variant="secondary" onClick={()=>{
                  if(!rivalProfile){sRivalProfile(createRival(rat))}
                  sShowRivalGreet(true);
                }} style={{
                  background:"linear-gradient(135deg,#1e1b4b,#4c1d95,#7c3aed)",
                  border:"1px solid #a78bfa",color:"#fff",
                  boxShadow:"0 4px 12px rgba(124,58,237,0.35)"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>⚔ {rivalProfile?rivalProfile.name:"AI Rival"}</span>
                    <span style={{fontSize:11,opacity:0.85,fontWeight:600}}>
                      {rivalProfile?`${rivalProfile.rating} ELO`:"персональный"}
                    </span>
                  </div>
                </Btn>}
              </div>
            </div>

            {/* ─── Section 3: TRAINING & DAILY ─── */}
            <div style={{marginTop:SPACE[4]}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.accent,letterSpacing:1.5,textTransform:"uppercase" as const}}>▸ Тренировка и daily</span>
                <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${CC.accent}33, transparent)`}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(170px, 1fr))",gap:SPACE[2]}}>
                <Btn size="lg" variant="secondary" onClick={()=>sShowOpeningTrainer(true)}
                  style={{background:"linear-gradient(135deg,#faf5ff,#f3e8ff)",
                    border:"1px solid #d8b4fe",color:CC.accent}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>🎓 Opening Trainer</span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>drill дебютов</span>
                  </div>
                </Btn>
                <Btn size="lg" variant="secondary" onClick={()=>{
                  const{hunt,state}=todayHunt();
                  sBrilliancyHunt(hunt);sBrilliancyState(state);sBrilliancyInput("");sBrilliancyResult(null);
                  sShowBrilliancy(true);
                }} style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",
                  border:"1px solid #fcd34d",color:"#92400e"}}>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span>💎 Brilliancy <Badge tone="gold" size="xs">daily</Badge></span>
                    <span style={{fontSize:11,color:CC.textDim,fontWeight:600}}>найди гениальный ход</span>
                  </div>
                </Btn>
              </div>
            </div>
          </Card>

          {/* ─── DAILY hub: Daily Variant Challenge + Daily Puzzle side-by-side ─── */}
          {(dailyVariantInfo||(dailyState&&PUZZLES[dailyState.idx]))&&(()=>{
            const hours=24-new Date().getHours();
            return <Card padding={0} elevation="sm" style={{overflow:"hidden",animation:"fadeInUp 0.4s ease-out"}}>
              <div style={{padding:`${SPACE[2]}px ${SPACE[3]}px`,
                background:"linear-gradient(90deg,#fef3c7,#fde68a,#fef3c7)",
                borderBottom:`1px solid ${CC.border}`,
                display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <span style={{fontSize:18}}>☀</span>
                <span style={{fontSize:11,fontWeight:900,color:"#78350f",letterSpacing:1,textTransform:"uppercase" as const}}>DAILY · {new Date().toLocaleDateString("ru-RU")}</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:10,color:"#92400e",fontWeight:700}}>сброс через {hours} ч</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:dailyVariantInfo&&(dailyState&&PUZZLES[dailyState.idx])?"1fr 1fr":"1fr",gap:0}}>
                {dailyVariantInfo&&(()=>{
                  const dv=dailyVariantInfo;
                  const meta=VARIANTS.find(v=>v.id===dv.variant);
                  if(!meta)return null;
                  const done=dv.played&&dv.won;
                  return <button onClick={()=>{
                    sVariant(dv.variant);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sTab("play");
                    if(dv.variant==="asymmetric")sManualArmyFen("");
                    setTimeout(()=>newG(),50);
                    showToast(`☀ Daily Challenge: ${meta.name}`,"info");
                  }} className="cc-focus-ring"
                    style={{padding:SPACE[3],
                      border:"none",borderRight:dailyState&&PUZZLES[dailyState.idx]?`1px solid ${CC.border}`:"none",
                      background:done?"linear-gradient(135deg,#f0fdf4,#ecfdf5)":"linear-gradient(135deg,#f5f3ff,#ede9fe)",
                      cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:SPACE[2],
                      transition:`all ${MOTION.base} ${MOTION.ease}`}}
                    onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=done?"linear-gradient(135deg,#dcfce7,#a7f3d0)":"linear-gradient(135deg,#ede9fe,#ddd6fe)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background=done?"linear-gradient(135deg,#f0fdf4,#ecfdf5)":"linear-gradient(135deg,#f5f3ff,#ede9fe)"}>
                    <div style={{fontSize:30,lineHeight:1,flexShrink:0}}>{done?"✅":meta.emoji}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,fontWeight:900,color:done?"#065f46":"#5b21b6",letterSpacing:0.8,textTransform:"uppercase" as const}}>{done?"Variant решён":"Variant Challenge"}</div>
                      <div style={{fontSize:13,fontWeight:900,color:CC.text,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{meta.name}</div>
                      <div style={{fontSize:10,color:CC.textDim,marginTop:1}}>{done?"завтра new":"+50 Chessy"}</div>
                    </div>
                    {!done&&<Badge tone="accent" size="sm">▶</Badge>}
                  </button>;
                })()}
                {dailyState&&PUZZLES[dailyState.idx]&&(()=>{
                  const pz=PUZZLES[dailyState.idx];const solved=dailyState.solved;
                  return <button onClick={loadDailyPuzzle}
                    className="cc-focus-ring"
                    style={{padding:SPACE[3],border:"none",
                      background:solved?"linear-gradient(135deg,#f0fdf4,#ecfdf5)":"linear-gradient(135deg,#fffbeb,#fef3c7)",
                      cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:SPACE[2],
                      transition:`all ${MOTION.base} ${MOTION.ease}`}}
                    onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=solved?"linear-gradient(135deg,#dcfce7,#a7f3d0)":"linear-gradient(135deg,#fef3c7,#fde68a)"}
                    onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background=solved?"linear-gradient(135deg,#f0fdf4,#ecfdf5)":"linear-gradient(135deg,#fffbeb,#fef3c7)"}>
                    <div style={{fontSize:30,lineHeight:1,flexShrink:0}}>{solved?"✅":"🧩"}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:9,fontWeight:900,color:solved?"#065f46":"#92400e",letterSpacing:0.8,textTransform:"uppercase" as const}}>{solved?"Пазл решён":"Пазл дня"}</div>
                      <div style={{fontSize:13,fontWeight:900,color:CC.text,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const}}>{pz.side==="w"?"⚪":"⚫"} {pz.goal==="Mate"?`Мат в ${pz.mateIn}`:"Лучший ход"} · {pz.r}</div>
                      <div style={{fontSize:10,color:CC.textDim,marginTop:1}}>{solved?"завтра new":"+50 Chessy"}</div>
                    </div>
                    {!solved&&<Badge tone="gold" size="sm">▶</Badge>}
                  </button>;
                })()}
              </div>
            </Card>;
          })()}

          {/* ─── Board theme + Premove slider (consolidated) ─── */}
          <Card padding={SPACE[3]}>
            <div style={{display:"flex",alignItems:"center",gap:SPACE[3],flexWrap:"wrap"}}>
              <SectionHeader title="ДОСКА"/>
              <div style={{flex:1}}/>
              <label style={{display:"flex",alignItems:"center",gap:SPACE[2],fontSize:11,color:CC.textDim,fontWeight:700,letterSpacing:0.3,whiteSpace:"nowrap"}} title="Сколько премувов можно ставить в очередь">
                <span>⚡ PREMOVE {pmLim}</span>
                <input type="range" min={1} max={20} value={pmLim}
                  onChange={e=>sPmLim(+e.target.value)}
                  style={{width:100,accentColor:CC.brand}}/>
              </label>
            </div>
            <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap",marginTop:SPACE[2]}}>
              {BOARD_THEMES.map((th,i)=>{
                const locked=!!th.premium&&!chessy.owned[th.premium!];
                const selected=boardTheme===i;
                return <button key={i}
                  className="cc-focus-ring"
                  onClick={()=>{if(locked){showToast("Premium — доступно в магазине","info");sShowShop(true);return}sBoardTheme(i)}}
                  style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",
                    borderRadius:RADIUS.full,
                    border:selected?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                    background:selected?CC.brandSoft:locked?CC.surface2:CC.surface1,
                    cursor:"pointer",opacity:locked?0.65:1,
                    transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                  <div style={{width:22,height:16,borderRadius:4,overflow:"hidden",
                    display:"flex",flexShrink:0,boxShadow:"inset 0 0 0 1px rgba(0,0,0,0.08)"}}>
                    <div style={{width:11,height:16,background:th.light}}/>
                    <div style={{width:11,height:16,background:th.dark}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:selected?800:600,color:selected?CC.text:CC.textDim}}>{th.name}</span>
                  {locked&&<span style={{fontSize:10,color:"#b45309"}}>🔒</span>}
                </button>;
              })}
            </div>
          </Card>

          {/* ─── Dashboard widgets ─── */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))",gap:SPACE[2]}}>
            {/* Rating */}
            <Card padding={SPACE[3]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Rating</div>
              <div style={{fontSize:28,fontWeight:900,color:CC.gold,lineHeight:1.1,marginTop:2}}>{rat}</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:1}}>{rk.i} {rk.t}</div>
              {savedGames.length>1&&(()=>{
                const pts=[...savedGames].reverse().slice(-30).map(g=>g.rating);
                if(pts.length<2)return null;
                const mn=Math.min(...pts),mx=Math.max(...pts);const rng=Math.max(30,mx-mn);
                const dx=100/(pts.length-1);
                const path=pts.map((v,i)=>`${i===0?"M":"L"}${(i*dx).toFixed(1)} ${(24-((v-mn)/rng)*22).toFixed(1)}`).join(" ");
                const trend=pts[pts.length-1]-pts[0];const col=trend>=0?CC.brand:CC.danger;
                return <div style={{marginTop:4}}>
                  <svg viewBox="0 0 100 26" preserveAspectRatio="none" style={{width:"100%",height:28}}>
                    <path d={path} fill="none" stroke={col} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <div style={{fontSize:10,fontWeight:700,color:col,marginTop:-2}}>{trend>=0?"+":""}{trend}</div>
                </div>;
              })()}
              <div style={{display:"flex",justifyContent:"flex-start",gap:SPACE[2],marginTop:SPACE[2]}}>
                <div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:900,color:CC.brand}}>{sts.w}</span><span style={{fontSize:10,color:CC.textDim}}>W</span></div>
                <div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:900,color:CC.danger}}>{sts.l}</span><span style={{fontSize:10,color:CC.textDim}}>L</span></div>
                <div style={{display:"flex",alignItems:"baseline",gap:3}}><span style={{fontSize:13,fontWeight:900,color:CC.textDim}}>{sts.d}</span><span style={{fontSize:10,color:CC.textDim}}>D</span></div>
              </div>
            </Card>

            {/* Chessy */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>sShowShop(true)}
              style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderColor:"#fcd34d",cursor:"pointer"}}>
              <div style={{fontSize:10,color:"#92400e",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Chessy</div>
              <div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:2}}>
                <Icon.Coin width={20} height={20}/>
                <span style={{fontSize:26,fontWeight:900,color:"#78350f",lineHeight:1.1}}>{chessy.balance}</span>
              </div>
              <div style={{fontSize:11,color:"#b45309",marginTop:2}}>Всего {chessy.lifetime}</div>
              {chessy.streak>=2&&<div style={{marginTop:SPACE[2],fontSize:10,fontWeight:800,color:"#92400e",background:"rgba(146,64,14,0.14)",padding:"2px 8px",borderRadius:RADIUS.full,display:"inline-flex",alignItems:"center",gap:3}}>🔥 {chessy.streak} дней</div>}
              <div style={{fontSize:11,fontWeight:800,color:"#92400e",marginTop:SPACE[2]}}>Магазин →</div>
            </Card>

            {/* Achievements */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>sShowShop(true)}
              style={{background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",borderColor:"#c4b5fd",cursor:"pointer"}}>
              <div style={{fontSize:10,color:CC.accent,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Достижения</div>
              <div style={{fontSize:26,fontWeight:900,color:CC.accent,lineHeight:1.1,marginTop:2}}>{achGot}<span style={{fontSize:14,color:CC.textDim}}>/{achTotal}</span></div>
              <div style={{height:6,borderRadius:RADIUS.full,background:"#ede9fe",marginTop:SPACE[2],overflow:"hidden"}}>
                <div style={{width:`${achPct}%`,height:"100%",background:`linear-gradient(90deg,${CC.accent},#a78bfa)`,transition:`width ${MOTION.slow} ${MOTION.ease}`}}/>
              </div>
              <div style={{fontSize:11,color:CC.accent,fontWeight:700,marginTop:SPACE[2]}}>{achPct}% открыто</div>
            </Card>

            {/* Win rate */}
            <Card padding={SPACE[3]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Win Rate</div>
              {totalGames>0?<>
                <div style={{fontSize:28,fontWeight:900,color:winPct>=50?CC.brand:CC.danger,lineHeight:1.1,marginTop:2}}>{winPct}%</div>
                <div style={{fontSize:11,color:CC.textDim,marginTop:1}}>{totalGames} игр</div>
                <div style={{display:"flex",height:6,borderRadius:RADIUS.full,overflow:"hidden",marginTop:SPACE[2],background:CC.surface3}}>
                  <div style={{width:`${sts.w/totalGames*100}%`,background:CC.brand}}/>
                  <div style={{width:`${sts.d/totalGames*100}%`,background:"#9ca3af"}}/>
                  <div style={{width:`${sts.l/totalGames*100}%`,background:CC.danger}}/>
                </div>
              </>:<div style={{fontSize:12,color:CC.textDim,marginTop:SPACE[2]}}>Пока нет игр</div>}
            </Card>

            {/* Quick Puzzle */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}}
              style={{background:"linear-gradient(135deg,#eff6ff,#f0fdf4)",borderColor:"#bfdbfe",cursor:"pointer"}}>
              <div style={{fontSize:10,color:CC.info,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Задачи</div>
              <div style={{fontSize:26,marginTop:2}}>🧩</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>{PUZZLES.length} puzzles</div>
              <div style={{fontSize:11,fontWeight:800,color:CC.info,marginTop:SPACE[2]}}>Случайная →</div>
            </Card>

            {/* Coach */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>sTab("coach")}
              style={{background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)",borderColor:"#a7f3d0",cursor:"pointer"}}>
              <div style={{fontSize:10,color:CC.brand,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>AI Coach</div>
              <div style={{fontSize:26,marginTop:2}}>🎓</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>Разбор</div>
              <div style={{fontSize:11,fontWeight:800,color:CC.brand,marginTop:SPACE[2]}}>Учиться →</div>
            </Card>

            {/* Library / Analysis */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>sTab("analysis")}
              style={{background:"linear-gradient(135deg,#faf5ff,#f3e8ff)",borderColor:"#d8b4fe",cursor:"pointer"}}>
              <div style={{fontSize:10,color:CC.accent,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Analysis</div>
              <div style={{fontSize:26,marginTop:2}}>⚡</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>MultiPV · SF</div>
              <div style={{fontSize:11,fontWeight:800,color:CC.accent,marginTop:SPACE[2]}}>Анализ →</div>
            </Card>

            {/* Game DNA — персональные паттерны (killer #3) */}
            <Card padding={SPACE[3]} tone="surface1" onClick={()=>sShowGameDna(true)}
              style={{background:"linear-gradient(135deg,#eff6ff,#dbeafe)",borderColor:"#93c5fd",cursor:"pointer",gridColumn:gameDna.insights.length>0&&savedGames.length>0?"span 2":"auto"}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <div style={{fontSize:10,color:CC.info,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Game DNA</div>
                <Badge tone="info" size="xs">🧬 new</Badge>
              </div>
              {savedGames.length>0?<>
                <div style={{fontSize:12,color:CC.text,marginTop:SPACE[2],lineHeight:1.5,fontWeight:600,minHeight:48,maxHeight:60,overflow:"hidden"}}>
                  {gameDna.insights[0]}
                </div>
                {gameDna.insights.length>1&&<div style={{fontSize:11,fontWeight:800,color:CC.info,marginTop:SPACE[2]}}>+{gameDna.insights.length-1} инсайтов →</div>}
                {gameDna.insights.length<=1&&<div style={{fontSize:11,fontWeight:800,color:CC.info,marginTop:SPACE[2]}}>Открыть →</div>}
              </>:<>
                <div style={{fontSize:26,marginTop:2}}>🧬</div>
                <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>Сыграй 5+ партий</div>
                <div style={{fontSize:11,fontWeight:800,color:CC.info,marginTop:SPACE[2]}}>Разблокировать →</div>
              </>}
            </Card>
          </div>

          {/* ─── Game History ─── */}
          {savedGames.length>0&&<Card padding={0} elevation="sm">
            <div style={{padding:`${SPACE[2]}px ${SPACE[3]}px`,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${CC.border}`}}>
              <span style={{fontSize:13,fontWeight:800,color:CC.text}}>Мои партии <span style={{color:CC.textDim,fontWeight:600}}>({savedGames.length})</span></span>
              <UiTabs
                variant="segment"
                size="sm"
                value={gamesFilter}
                onChange={(v)=>sGamesFilter(v)}
                tabs={[
                  {value:"all",label:"Все"},
                  {value:"Bullet",label:"Bullet"},
                  {value:"Blitz",label:"Blitz"},
                  {value:"Rapid",label:"Rapid"},
                ]}
              />
            </div>
            <div style={{maxHeight:220,overflowY:"auto"}}>
              {savedGames.filter(g=>gamesFilter==="all"||g.category===gamesFilter).slice(0,30).map(g=>{
                const isWin=g.result.includes("You win")||g.result.includes("timed out");
                const isDraw=g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
                const resCol=isWin?CC.brand:isDraw?CC.textDim:CC.danger;
                const catBadge:"danger"|"gold"|"brand"=g.category==="Bullet"?"danger":g.category==="Blitz"?"gold":"brand";
                return(<button key={g.id} className="cc-focus-ring" onClick={()=>{
                  sTab("analysis");
                  const ch=new Chess();
                  for(const san of g.moves)try{ch.move(san)}catch{}
                  setGame(ch);sBk(k=>k+1);sHist(g.moves);
                  const fens=[new Chess().fen()];const tmp=new Chess();
                  for(const san of g.moves){try{tmp.move(san);fens.push(tmp.fen())}catch{}}
                  sFenHist(fens);sOver(g.result);sOn(false);sSetup(false);sSel(null);sVm(new Set());sLm(null);
                }} style={{width:"100%",padding:"8px 12px",border:"none",borderBottom:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
                  <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                    <div style={{width:26,height:26,borderRadius:"50%",background:resCol+"18",color:resCol,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900}}>
                      {isWin?"W":isDraw?"D":"L"}
                    </div>
                    <div>
                      <div style={{fontWeight:700,color:CC.text,fontSize:13}}>{g.opening||"Unknown"}</div>
                      <div style={{fontSize:11,color:CC.textDim,marginTop:1}}>{g.aiLevel} · {g.tc} · {g.moves.length} ходов</div>
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                    <span style={{fontSize:13,fontWeight:800,color:CC.gold}}>{g.rating}</span>
                    <Badge tone={catBadge} size="xs">{g.category}</Badge>
                  </div>
                </button>);
              })}
            </div>
          </Card>}
        </div>;
      })()}

      {/* Board + Panel */}
      {(!setup||tab==="puzzles"||tab==="analysis"||tab==="coach")&&<div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}} onContextMenu={e=>{e.preventDefault();if(pms.length>0)sPms(p=>p.slice(0,-1));else if(pmSel)sPmSel(null)}}>
        <div style={{flexShrink:0}}>
          {tc.ini>0&&tab!=="analysis"&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:5,width:"min(920px,calc(100vw - 48px))"}}>
            <div style={{padding:"8px 18px",borderRadius:10,background:game.turn()===aiC&&on&&!over?"#1e293b":T.surface,color:game.turn()===aiC&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:16,fontFamily:"monospace",border:`1px solid ${T.border}`,boxShadow:game.turn()===aiC&&on&&!over?"0 2px 8px rgba(30,41,59,0.2)":"none"}}>AI {fmt(aT.time)}</div>
            <div style={{padding:"8px 18px",borderRadius:10,background:myT&&on&&!over?T.accent:T.surface,color:myT&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:16,fontFamily:"monospace",border:`1px solid ${T.border}`,boxShadow:myT&&on&&!over?"0 2px 8px rgba(5,150,105,0.25)":"none"}}>You {fmt(pT.time)}</div>
          </div>}

          <div translate="no" style={{display:"flex",width:"min(920px,calc(100vw - 32px))",gap:4}}>
            {/* Eval bar — with W/B labels + centered numeric badge */}
            {sfOk&&(tab==="analysis"||tab==="play"||tab==="coach")&&(()=>{
              const cp=evalMate!==0?(evalMate>0?2000:-2000):Math.max(-1500,Math.min(1500,evalCp));
              const pct=50+cp/30;
              const wPct=Math.max(2,Math.min(98,pct));
              const label=evalMate!==0?`M${Math.abs(evalMate)}`:(evalCp>=0?"+":"")+(evalCp/100).toFixed(2);
              const whiteTop=flip;
              const topSide=whiteTop?"W":"B";
              const botSide=whiteTop?"B":"W";
              const isWhiteBetter=evalMate!==0?evalMate>0:evalCp>=0;
              const badgeBg=isWhiteBetter?"#ffffff":"#1e293b";
              const badgeFg=isWhiteBetter?"#0f172a":"#ffffff";
              const pipStyle=(side:"W"|"B"):React.CSSProperties=>side==="W"
                ? {background:"#f8fafc",color:CC.text,border:`1px solid ${CC.border}`}
                : {background:"#1e293b",color:"#fff"};
              return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,width:32}}>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:1,padding:"2px 5px",borderRadius:4,lineHeight:1,...pipStyle(topSide)}}>{topSide}</div>
                <div style={{width:28,flex:1,borderRadius:8,overflow:"hidden",border:`1px solid ${CC.borderStrong}`,background:"#1e293b",position:"relative",display:"flex",flexDirection:"column",boxShadow:"inset 0 2px 4px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.15)"}}>
                  {whiteTop?<>
                    <div style={{height:`${wPct}%`,background:"linear-gradient(180deg,#ffffff 0%,#e2e8f0 100%)",transition:"height 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}/>
                    <div style={{flex:1,background:"linear-gradient(180deg,#374151 0%,#1f2937 100%)"}}/>
                  </>:<>
                    <div style={{flex:1,background:"linear-gradient(180deg,#1f2937 0%,#374151 100%)"}}/>
                    <div style={{height:`${wPct}%`,background:"linear-gradient(180deg,#e2e8f0 0%,#ffffff 100%)",transition:"height 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}/>
                  </>}
                  <div style={{position:"absolute",left:"50%",top:"50%",transform:"translate(-50%,-50%)",padding:"2px 5px",background:badgeBg,color:badgeFg,fontSize:10,fontWeight:900,fontFamily:"ui-monospace, monospace",borderRadius:4,boxShadow:"0 1px 3px rgba(0,0,0,0.3)",whiteSpace:"nowrap",minWidth:26,textAlign:"center",letterSpacing:0.3}}>{label}</div>
                </div>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:1,padding:"2px 5px",borderRadius:4,lineHeight:1,...pipStyle(botSide)}}>{botSide}</div>
              </div>);
            })()}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:6,paddingLeft:2,width:16}}>{rws.map(r=><div key={r} style={{fontSize:11,color:CC.textMute,fontWeight:800,textAlign:"center",fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:0.5}}>{8-r}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`2px solid ${bT.border}`,boxShadow:"0 10px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)",position:"relative"}}>
              {/* Arrow / highlight overlay */}
              {(arrows.length>0||sqHL.length>0)&&(()=>{
                const sqXY=(sq:Square):[number,number]=>{
                  const f=FILES.indexOf(sq[0]);const r=8-parseInt(sq[1]);
                  const c=flip?7-f:f;const rr=flip?7-r:r;
                  return [c*12.5+6.25,rr*12.5+6.25];
                };
                return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:5}}>
                  <defs>
                    {["#22c55e","#ef4444","#3b82f6","#eab308"].map(c=><marker key={c} id={`ah-${c.slice(1)}`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={c}/></marker>)}
                  </defs>
                  {sqHL.map((h,i)=>{const[x,y]=sqXY(h.sq);return <circle key={i} cx={x} cy={y} r="5.5" fill="none" stroke={h.c} strokeWidth="1" opacity="0.85"/>;})}
                  {arrows.map((a,i)=>{const[x1,y1]=sqXY(a.from);const[x2,y2]=sqXY(a.to);
                    // Shorten so the arrowhead doesn't overlap the destination center
                    const dx=x2-x1,dy=y2-y1,len=Math.max(0.01,Math.hypot(dx,dy));
                    const tx=x2-(dx/len)*3.5,ty=y2-(dy/len)*3.5;
                    return <line key={i} x1={x1} y1={y1} x2={tx} y2={ty} stroke={a.c} strokeWidth="1.8" strokeLinecap="round" markerEnd={`url(#ah-${a.c.slice(1)})`} opacity="0.85"/>;
                  })}
                </svg>;
              })()}
              {rws.flatMap(r=>cls.map(c=>{const sq=`${FILES[c]}${8-r}` as Square;const p=bd[r][c];const lt=(r+c)%2===0;
                const realP=game.get(sq);
                const isShadow=pms.length>0&&p&&(!realP||realP.type!==p.type||realP.color!==p.color);
                const iS=sel===sq,iV=vm.has(sq),iCp=iV&&!!p,iL=lm&&(lm.from===sq||lm.to===sq),iCk=chk&&p?.type==="k"&&p.color===game.turn(),iPM=pmSet.has(sq),iPS=pmSel===sq;
                let bg=lt?bT.light:bT.dark;
                if(iCk)bg=T.chk;else if(iPS)bg=T.pmS;else if(iPM)bg=T.pm;else if(iS)bg=T.sel;else if(iCp)bg=T.cap;else if(iV)bg=T.valid;else if(iL)bg=T.last;
                // Annotation mode: when the game is finished OR we're in analysis/coach (viewer mode),
                // right-click draws arrows & highlights. During a live play game, right-click still
                // removes premoves as before.
                const annotActive=tab==="analysis"||!!over||(tab==="coach"&&!on);
                return<div key={sq} onClick={()=>{if(annotActive&&(arrows.length>0||sqHL.length>0))clearAnnotations();click(sq)}} onMouseDown={e=>{if(e.button===2){rcStartRef.current=sq;e.preventDefault()}}} onMouseUp={e=>{
                  if(e.button!==2)return;
                  const start=rcStartRef.current;rcStartRef.current=null;
                  if(!annotActive)return;
                  if(!start)return;
                  const col=annotColor(e);
                  if(start===sq){
                    // Toggle highlight on this square
                    sSqHL(hl=>{const i=hl.findIndex(x=>x.sq===sq&&x.c===col);if(i>=0)return hl.filter((_,j)=>j!==i);const other=hl.filter(x=>x.sq!==sq);return [...other,{sq,c:col}]});
                  }else{
                    // Arrow from start → sq; toggle if exact same arrow exists
                    sArrows(a=>{const i=a.findIndex(x=>x.from===start&&x.to===sq&&x.c===col);if(i>=0)return a.filter((_,j)=>j!==i);return [...a,{from:start,to:sq,c:col}]});
                  }
                }} onContextMenu={e=>{e.preventDefault();e.stopPropagation();
                  if(annotActive)return; // annotations already handled on mouseUp
                  // Play mode: remove premove at this square (either from or to)
                  const pmIdx=pms.findIndex(p=>p.from===sq||p.to===sq);
                  if(pmIdx>=0){sPms(p=>p.filter((_,i)=>i!==pmIdx));return}
                  if(pms.length>0){sPms(p=>p.slice(0,-1))}else if(pmSel){sPmSel(null)}
                }} onDragStart={()=>dS(sq)} onDragOver={e=>e.preventDefault()} onDrop={()=>dD(sq)} draggable={!!p&&(tab==="analysis"?true:p.color===pCol)&&!over}
                  className={`cc-board-cell${iS||iPS?" cc-board-cell-selected":""}${iL?" cc-board-cell-lastmove":""}`}
                  style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(40px,7.5vw,80px)",background:bg,cursor:!over&&p?.color===pCol?"grab":"default",userSelect:"none",position:"relative",lineHeight:1,transition:"background 0.15s"}}>
                  {iV&&!p&&<div style={{width:"30%",height:"30%",borderRadius:"50%",background:"radial-gradient(circle, rgba(5,150,105,0.78) 0%, rgba(5,150,105,0.55) 55%, rgba(5,150,105,0.25) 100%)",position:"absolute",boxShadow:"0 0 14px rgba(5,150,105,0.45), inset 0 0 5px rgba(5,150,105,0.3)"}}/>}
                  {p&&<div style={{width:"88%",height:"88%",transform:iS||iPS?"scale(1.08)":"none",filter:isShadow?"drop-shadow(0 2px 3px rgba(0,0,0,0.25))":"drop-shadow(0 2px 3px rgba(0,0,0,0.35))",opacity:isShadow?0.55:1,transition:"transform 0.12s, opacity 0.15s",animation:iCk?"cc-pulse-glow 1.2s ease-in-out infinite":undefined,borderRadius:iCk?"50%":undefined}}><Piece type={p.type} color={p.color}/></div>}
                  {pmToIdx.get(sq)!==undefined&&<div style={{position:"absolute",top:3,right:3,minWidth:18,height:18,padding:"0 5px",borderRadius:9,background:T.blue,color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.4)",pointerEvents:"none",lineHeight:1,fontFamily:"monospace"}}>{pmToIdx.get(sq)}</div>}
                </div>}))}
            </div>
          </div>
          <div style={{display:"flex",paddingLeft:23,width:"min(920px,calc(100vw - 32px))"}}><div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,marginTop:4}}>{cls.map(c=><div key={c} style={{textAlign:"center",fontSize:11,color:CC.textMute,fontWeight:800,fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:0.5,textTransform:"uppercase" as const}}>{FILES[c]}</div>)}</div></div>

          {/* Controls */}
          <div style={{display:"flex",gap:6,marginTop:SPACE[2],flexWrap:"wrap"}}>
            <Btn size="sm" variant="secondary" icon={<Icon.Flip width={14} height={14}/>} onClick={()=>sFlip(!flip)}>Flip</Btn>
            <Btn size="sm" variant="primary" onClick={()=>{sSetup(true);sOn(false);sOver(null);sPms([])}}>New Game</Btn>
            <Btn size="sm" variant="secondary" onClick={async()=>{
              try{
                const text=await whisperAndSpeak(game.fen(),evalCp,evalMate);
                showToast(`🔊 ${text}`,"info");
              }catch{showToast("Голос недоступен","error")}
            }} title="Chessy объяснит позицию голосом"
              style={{background:"linear-gradient(135deg,#f0fdfa,#ccfbf1)",color:"#115e59",borderColor:"#5eead4"}}>🔊 Whisper</Btn>
            {(tab==="play"||tab==="coach"||tab==="analysis")&&btn(voiceListening?"🔴 Слушаю (нажми для паузы)":"🎤 Голос",()=>{
              const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
              if(!SR){showToast("Браузер не поддерживает голосовой ввод (нужен Chrome)","error");return}
              if(voiceListening&&voiceRecRef.current){
                try{voiceRecRef.current._stop=true;voiceRecRef.current.stop()}catch{}
                sVoiceListening(false);voiceRecRef.current=null;
                showToast("Голос выключен","info");
                return;
              }
              const rec=new SR();
              rec.lang="ru-RU";
              rec.interimResults=false;
              rec.continuous=true; // always-on — не надо жать каждый раз
              rec.maxAlternatives=4;
              rec._stop=false;
              const parseVoice=(text:string):{from?:string;to?:string;san?:string;special?:string}=>{
                let t=text.toLowerCase().trim().replace(/ё/g,"е");
                // Special commands
                if(/\b(новая\s+партия|новую\s+партию|new\s+game|начать\s+заново)\b/.test(t))return{special:"new"};
                if(/\b(сдаюсь|сдаться|resign|признаю\s+поражение)\b/.test(t))return{special:"resign"};
                if(/\b(переверни|переверни\s+доску|flip|flip\s+board)\b/.test(t))return{special:"flip"};
                if(/\b(отмена|отмени|отменить|undo|отмени\s+ход)\b/.test(t))return{special:"undo"};
                if(/\b(анализ|проанализируй|analyze|analysis)\b/.test(t))return{special:"analyze"};
                if(/\b(выкл(ючи)?\s+голос|выключи\s+микрофон|stop\s+listening)\b/.test(t))return{special:"stopvoice"};
                // Castling — broad coverage
                if(/(коротк(ая|ую)\s+рокировк|короткая|short\s+castle|castle\s+short|king[-\s]?side|o-?o(?!-?o))/i.test(t))return{san:"O-O"};
                if(/(длинн(ая|ую)\s+рокировк|длинная|long\s+castle|castle\s+long|queen[-\s]?side|o-?o-?o)/i.test(t))return{san:"O-O-O"};
                // Russian letter → file (extended: phonetic spellings shaхматистов)
                const rusMap:Record<string,string>={"а":"a","бэ":"b","б":"b","вэ":"c","в":"c","цэ":"c","ц":"c","с":"c","дэ":"d","д":"d","е":"e","эф":"f","ф":"f","жэ":"g","же":"g","ж":"g","ге":"g","г":"g","ха":"h","х":"h","аш":"h","эйч":"h"};
                // English spoken: "e four", "knight f three"
                const engFileMap:Record<string,string>={"ei":"a","bi":"b","си":"c","си-эн":"c","di":"d","ди":"d","ii":"e","эф":"f","джи":"g","эйч":"h","аш":"h","хэй":"h"};
                // Number words (rus + eng)
                const numMap:Record<string,string>={"один":"1","одну":"1","первую":"1","first":"1","one":"1","два":"2","две":"2","вторую":"2","second":"2","two":"2","три":"3","третью":"3","third":"3","three":"3","четыре":"4","четвертую":"4","four":"4","пять":"5","пятую":"5","five":"5","шесть":"6","шестую":"6","six":"6","семь":"7","седьмую":"7","seven":"7","восемь":"8","восьмую":"8","eight":"8"};
                // Piece words — broad morphology
                const pieceMap:Record<string,string>={
                  "конь":"N","коня":"N","конём":"N","конем":"N","конику":"N","knight":"N","horse":"N",
                  "слон":"B","слона":"B","слоном":"B","слоны":"B","bishop":"B",
                  "ладья":"R","ладью":"R","ладьёй":"R","ладьей":"R","тура":"R","туру":"R","rook":"R",
                  "ферзь":"Q","ферзя":"Q","ферзём":"Q","ферзем":"Q","королева":"Q","королеву":"Q","queen":"Q",
                  "король":"K","короля":"K","королём":"K","королем":"K","king":"K",
                  "пешка":"","пешку":"","пешкой":"","пешки":"","pawn":""
                };
                // Strip capture / connector words — they're fluff for parsing
                t=t.replace(/\s+/g," ");
                t=t.replace(/\b(идёт|идет|на|берёт|берет|бьёт|бьет|рубит|съест|съедает|съесть|captures|takes|to|move|move\s+to|-|—|—>|->|→|идет\s+на|идёт\s+на|играет)\b/g," ");
                t=t.replace(/\s+/g," ");
                for(const[k,v]of Object.entries(rusMap))t=t.replace(new RegExp("\\b"+k+"\\b","g"),v);
                for(const[k,v]of Object.entries(engFileMap))t=t.replace(new RegExp("\\b"+k+"\\b","g"),v);
                for(const[k,v]of Object.entries(numMap))t=t.replace(new RegExp("\\b"+k+"\\b","g"),v);
                // Promotion
                let promo:"q"|"r"|"b"|"n"|undefined;
                if(/(ферзь|ферзя|queen)\s*$/.test(t)||/\bв\s*(ферз[ьяеем]|queen)/.test(text)){promo="q";t=t.replace(/(ферзь|ферзя|queen)/g,"")}
                else if(/(конь|коня|knight)\s*$/.test(t)||/\bв\s*(кон[ьяем]|knight)/.test(text)){promo="n";t=t.replace(/(конь|коня|knight)/g,"")}
                else if(/(ладья|ладью|rook)\s*$/.test(t)||/\bв\s*(ладь[юея]|rook)/.test(text)){promo="r";t=t.replace(/(ладья|ладью|rook)/g,"")}
                else if(/(слон|слона|bishop)\s*$/.test(t)||/\bв\s*(слон[ае]|bishop)/.test(text)){promo="b";t=t.replace(/(слон|слона|bishop)/g,"")}
                // Extract piece
                let piece="";
                for(const[k,v]of Object.entries(pieceMap))if(t.includes(k)){piece=v;t=t.replace(k," ");break;}
                t=t.replace(/\s+/g," ").trim();
                // Extract squares — support "e2e4", "e2 e4", "e 2 e 4"
                const sq=/([a-h])\s*([1-8])/g;const matches:string[]=[];let m;
                while((m=sq.exec(t))!==null){matches.push(m[1]+m[2]);if(matches.length===2)break}
                if(matches.length===2)return{from:matches[0],to:matches[1],san:promo?undefined:undefined};
                if(matches.length===1&&piece)return{san:piece+matches[0]+(promo?"="+promo.toUpperCase():"")};
                if(matches.length===1)return{san:matches[0]+(promo?"="+promo.toUpperCase():"")};
                return{};
              };
              rec.onstart=()=>{sVoiceListening(true);showToast("🎤 Слушаю постоянно. Говори ходы или команды: 'конь эф три', 'новая партия', 'переверни'","info")};
              rec.onend=()=>{
                // continuous mode sometimes ends unexpectedly; auto-restart unless user stopped
                if(rec._stop){sVoiceListening(false);voiceRecRef.current=null;return}
                try{rec.start()}catch{sVoiceListening(false);voiceRecRef.current=null}
              };
              rec.onerror=(e:any)=>{
                if(e.error==="no-speech"){return} // normal — user just silent
                rec._stop=true;sVoiceListening(false);voiceRecRef.current=null;
                if(e.error==="network")showToast("Голосу нужен интернет (Chrome speech API)","error");
                else if(e.error==="not-allowed")showToast("Разреши доступ к микрофону","error");
                else if(e.error==="aborted"){/* ignore */}
                else showToast(`Голос: ${e.error}`,"error");
              };
              rec.onresult=(e:any)=>{
                const last=e.results[e.results.length-1];
                if(!last.isFinal)return;
                const alts:string[]=[];
                for(let i=0;i<last.length;i++)alts.push(last[i].transcript);
                let matched=false;
                for(const alt of alts){
                  const v=parseVoice(alt);
                  // Special commands
                  if(v.special){
                    matched=true;
                    if(v.special==="new"){if(tab==="play")newG();else showToast("'Новая партия' работает в Play","info")}
                    else if(v.special==="resign"){if(on&&!over){sOn(false);sOver("You resigned");snd("x")}}
                    else if(v.special==="flip"){sFlip(f=>!f)}
                    else if(v.special==="undo"){if(pms.length>0)sPms(p=>p.slice(0,-1));else if(hist.length>=2){const u1=game.undo();if(u1){const u2=game.undo();if(u2){sHist(h=>h.slice(0,-2));sFenHist(h=>h.slice(0,-2));sLm(null);sBk(k=>k+1)}else{try{game.move(u1.san)}catch{}}}}}
                    else if(v.special==="analyze"){if(tab==="analysis"||tab==="coach"||over)runAnalysis();else showToast("Анализ — после партии или в Analysis","info")}
                    else if(v.special==="stopvoice"){rec._stop=true;try{rec.stop()}catch{}}
                    break;
                  }
                  if(v.from&&v.to){
                    try{const mv=game.move({from:v.from as Square,to:v.to as Square,promotion:"q"});if(mv){exec(v.from as Square,v.to as Square);showToast(`✓ ${v.from}→${v.to}`,"success");matched=true;break}}catch{}
                  }else if(v.san){
                    try{const mv=game.move(v.san);if(mv){game.undo();const legal=game.moves({verbose:true}).find(x=>x.san===mv.san);if(legal){exec(legal.from,legal.to);showToast(`✓ ${v.san}`,"success");matched=true;break}}}catch{}
                  }
                }
                if(!matched)showToast(`🎤 "${alts[0]}" — не понял`,"error");
              };
              voiceRecRef.current=rec;
              try{rec.start()}catch{showToast("Не удалось запустить микрофон","error")}
            },voiceListening?"#fee2e2":T.surface,voiceListening?T.danger:T.dim)}
            {(tab==="play"||tab==="coach"||tab==="analysis")&&<Btn size="sm" variant="secondary" onClick={()=>{
              const input=prompt("Введи ход в алгебраической нотации (например: e4, Nf3, O-O, exd5):");
              if(!input)return;
              const san=input.trim();
              try{
                const mv=game.move(san);
                if(mv){game.undo();const legal=game.moves({verbose:true}).find(x=>x.san===mv.san);if(legal){exec(legal.from,legal.to);showToast(`✓ ${san}`,"success")}}
                else showToast(`Невозможный ход: ${san}`,"error");
              }catch{showToast(`Невозможный ход: ${san}`,"error")}
            }}>⌨️ Ход текстом</Btn>}
            {over&&<Btn size="sm" variant="gold" onClick={()=>newG()}>🔁 Rematch</Btn>}
            {pms.length>0&&<Btn size="sm" variant="secondary" icon={<Icon.Undo width={12} height={12}/>} onClick={()=>sPms(p=>p.slice(0,-1))} style={{background:"#eff6ff",color:CC.info,borderColor:"#bfdbfe"}}>Undo</Btn>}
            {pms.length>0&&<Btn size="sm" variant="secondary" onClick={()=>{sPms([]);sPmSel(null)}} style={{background:"#fef2f2",color:CC.danger,borderColor:"#fca5a5"}}>✕ Clear ({pms.length})</Btn>}
          </div>
          {on&&!over&&!setup&&<div style={{display:"flex",gap:6,marginTop:SPACE[1],flexWrap:"wrap"}}>
            <Btn size="sm" variant="danger" onClick={()=>{if(!confirm("Resign?"))return;const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("You resigned");snd("x")}}>🏳 Resign</Btn>
            <Btn size="sm" variant="gold" onClick={()=>{if(!confirm("Offer draw?"))return;if(Math.abs(ev(game))<200){const ns={...sts,d:sts.d+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("Draw agreed");snd("x")}else showToast("AI declined","error")}}>½ Draw</Btn>
            <Btn size="sm" variant="secondary" icon={<Icon.Undo width={12} height={12}/>} onClick={()=>{
              if(hist.length<2){showToast("No moves","error");return}
              if(think){showToast("AI думает — подожди","error");return}
              const needChessy=tab==="play"&&!hotseat;
              if(needChessy&&chessy.balance<3){showToast("Недостаточно Chessy (нужно 3)","error");return}
              const u1=game.undo();
              if(!u1){showToast("Takeback failed","error");return}
              const u2=game.undo();
              if(!u2){try{game.move(u1.san)}catch{}showToast("Takeback failed","error");return;}
              if(needChessy)spendChessy(3,"takeback");
              sHist(h=>h.slice(0,-2));sFenHist(h=>h.slice(0,-2));sLm(null);sSel(null);sVm(new Set());sBk(k=>k+1);
            }}>Take back{tab==="play"&&!hotseat?" · 3":""}</Btn>
            {savedGames.length>0&&(tab==="play"||tab==="coach")&&<Btn size="sm" variant="secondary" onClick={()=>sGamesModalOpen(true)}>📜 История ({savedGames.length})</Btn>}
          </div>}
          {over&&fenHist.length>2&&<div style={{display:"flex",gap:6,marginTop:SPACE[1],flexWrap:"wrap"}}>
            <Btn size="sm" variant="accent" onClick={()=>{
              sTab("analysis");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
              showToast("Партия открыта в анализе — запускаю разбор","info");
              setTimeout(()=>{if(sfR.current?.ready()&&fenHist.length>=3)runAnalysis()},150);
            }}>📊 Открыть в Analysis</Btn>
            <Btn size="sm" variant="primary" loading={analyzing} onClick={runAnalysis}>
              {analyzing?"Analyzing...":showAnal?"🔽 Hide":"⚡ Quick analyze"}
            </Btn>
            {savedGames.length>0&&<Btn size="sm" variant="secondary" onClick={()=>sGamesModalOpen(true)}>📜 История ({savedGames.length})</Btn>}
            <Btn size="sm" variant="secondary" icon={<Icon.Share width={12} height={12}/>} onClick={()=>{
              const white=hotseat?"Player 1":(pCol==="w"?"You":lv.name);
              const black=hotseat?"Player 2":(pCol==="b"?"You":lv.name);
              const result=over?.includes("You win")?"1-0":over?.includes("AI wins")?"0-1":over?.includes("win")&&hotseat?"*":"1/2-1/2";
              const pgn=buildPGN(hist,{white,black,result});
              const url=`${typeof window!=="undefined"?window.location.origin+window.location.pathname:""}?pgn=${encodeURIComponent(pgn)}`;
              const share=`${pgn}\n\n🔗 Смотреть: ${url}`;
              try{navigator.clipboard.writeText(share).then(()=>showToast("PGN + ссылка скопированы","success")).catch(()=>showToast("Не получилось — скопируй вручную","error"))}catch{showToast("Clipboard API недоступно","error")}
            } } style={{background:"#eff6ff",color:CC.info,borderColor:"#bfdbfe"}}>Share PGN</Btn>
            <Btn size="sm" variant="secondary" onClick={()=>{
              const white=hotseat?"Player 1":(pCol==="w"?"You":lv.name);
              const black=hotseat?"Player 2":(pCol==="b"?"You":lv.name);
              const result=over?.includes("You win")?"1-0":over?.includes("AI wins")?"0-1":"1/2-1/2";
              sReelMeta({white,black,result});sShowReel(true);
            }} style={{background:"linear-gradient(135deg,#fdf2f8,#fce7f3)",color:"#9d174d",borderColor:"#f9a8d4"}}>🎬 Auto-Reel</Btn>
          </div>}
        </div>

        {/* Right panel */}
        <div style={{flex:"1 1 440px",minWidth:380,maxWidth:720,display:"flex",flexDirection:"column",gap:10}}>
          {/* Opening Drill HUD */}
          {openingDrill&&<Card padding={SPACE[3]} tone="surface1"
            style={{background:"linear-gradient(135deg,#faf5ff,#f3e8ff)",borderColor:"#c4b5fd"}}>
            <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[1]}}>
              <Badge tone="accent" size="sm">{openingDrill.eco}</Badge>
              <div style={{fontSize:13,fontWeight:800,color:CC.accent}}>🎓 Opening Drill</div>
              <div style={{flex:1}}/>
              <Btn size="xs" variant="ghost" onClick={()=>{sOpeningDrill(null);showToast("Drill прерван","info")}}>✕</Btn>
            </div>
            <div style={{fontSize:13,fontWeight:700,color:CC.text,marginBottom:SPACE[1]}}>{openingDrill.name}</div>
            <div style={{height:6,borderRadius:RADIUS.full,background:"#ede9fe",overflow:"hidden",marginBottom:SPACE[1]}}>
              <div style={{height:"100%",width:`${Math.round(openingDrill.ply/openingDrill.moves.length*100)}%`,background:`linear-gradient(90deg,${CC.accent},#a78bfa)`,transition:`width ${MOTION.base} ${MOTION.ease}`}}/>
            </div>
            <div style={{fontSize:11,color:CC.textDim,display:"flex",justifyContent:"space-between"}}>
              <span>Ход {openingDrill.ply+1} / {openingDrill.moves.length}</span>
              {openingDrill.mistakes>0&&<span style={{color:CC.danger,fontWeight:800}}>× {openingDrill.mistakes}</span>}
            </div>
          </Card>}

          {/* Player block (top = opponent) */}
          {!setup&&(tab==="play"||tab==="coach")&&(()=>{
            const isAiTurn=game.turn()===aiC&&!over&&on;
            return <div style={{
              padding:"10px 14px",borderRadius:RADIUS.lg,
              background:CC.surface1,border:`1px solid ${isAiTurn?CC.borderStrong:CC.border}`,
              display:"flex",alignItems:"center",gap:SPACE[3],
              boxShadow:isAiTurn?"0 0 0 2px rgba(15,23,42,0.08)":SHADOW.sm,
              transition:`all ${MOTION.base} ${MOTION.ease}`
            }}>
              <div style={{
                width:40,height:40,borderRadius:RADIUS.md,
                background:"linear-gradient(135deg,#1e293b,#334155 60%,#475569)",
                display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontSize:18,flexShrink:0,boxShadow:SHADOW.sm,
                position:"relative"
              }}>
                🤖
                {isAiTurn&&<span style={{
                  position:"absolute",right:-2,bottom:-2,width:12,height:12,borderRadius:"50%",
                  background:think?CC.gold:CC.textDim,
                  border:"2px solid #fff",
                  animation:think?"cc-pulse-glow 1.2s infinite":undefined
                }}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                  <span style={{fontSize:14,fontWeight:800,color:CC.text}}>{useSF?"Stockfish":lv.name}</span>
                  <Badge tone={useSF?"accent":"info"} size="xs">{lv.elo}</Badge>
                  {think&&<Badge tone="gold" size="xs" icon={<Spinner size={10}/>}>думаю</Badge>}
                </div>
                {capW.length>0&&<div style={{fontSize:16,letterSpacing:1,lineHeight:1,marginTop:4,color:CC.textDim}} translate="no">{capW.join("")}</div>}
              </div>
            </div>;
          })()}

          {/* Status bar */}
          {(tab==="play"||tab==="coach")&&<StatusBar over={over} chk={chk} think={think} myT={myT} useSF={useSF} pmsLen={pms.length} histLen={hist.length} rat={rat} rkI={rk.i}/>}
          {/* Variant HUD: shows variant-specific info (Diceblade die, Twin Kings royal-queen status, Asymmetric armies) */}
          {variant!=="standard"&&on&&!over&&(tab==="play"||tab==="coach")&&<div style={{
            padding:"10px 14px",borderRadius:RADIUS.md,
            background:"linear-gradient(135deg,#fef3c7 0%,#fed7aa 100%)",
            border:"1px solid #fb923c",fontSize:12,
            boxShadow:"0 2px 8px rgba(251,146,60,0.18), inset 0 1px 0 rgba(255,255,255,0.5)",
            position:"relative",overflow:"hidden"}}>
            {/* Subtle animated stripe */}
            <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#fb923c,#f97316,#fb923c)",opacity:0.7}}/>
            <div style={{display:"flex",alignItems:"center",gap:SPACE[2],flexWrap:"wrap"}}>
              <span style={{fontSize:20,filter:"drop-shadow(0 1px 2px rgba(154,52,18,0.25))"}}>{VARIANTS.find(v=>v.id===variant)?.emoji}</span>
              <span style={{fontWeight:900,color:"#9a3412",letterSpacing:0.3}}>{VARIANTS.find(v=>v.id===variant)?.name}</span>
              {variant==="diceblade"&&<>
                <div style={{flex:1}}/>
                <span style={{
                  fontSize:28,lineHeight:1,
                  display:"inline-block",
                  padding:"2px 8px",borderRadius:6,
                  background:"#fff",
                  boxShadow:"0 2px 6px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(0,0,0,0.08)",
                  animation:"diceRoll 0.4s ease-out"
                }}>{["⚀","⚁","⚂","⚃","⚄","⚅"][diceFace-1]}</span>
                <span style={{fontWeight:800,color:CC.text}}>Только: <b style={{color:CC.danger,padding:"2px 8px",borderRadius:RADIUS.sm,background:"rgba(220,38,38,0.08)"}}>{diceLabel}</b></span>
              </>}
              {variant==="twinkings"&&(()=>{
                try{
                  const placement=game.fen().split(" ")[0];
                  const wQ=(placement.match(/Q/g)||[]).length;
                  const bQ=(placement.match(/q/g)||[]).length;
                  return <>
                    <div style={{flex:1}}/>
                    <span>♔×{wQ?2:1}</span><span>·</span><span>♚×{bQ?2:1}</span>
                  </>;
                }catch{return null}
              })()}
              {variant==="asymmetric"&&variantArmies&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11,color:CC.textDim}}>
                  ⚪ {variantArmies.white.map(a=>`${a.count}${a.piece}`).join(" ")} · ⚫ {variantArmies.black.map(a=>`${a.count}${a.piece}`).join(" ")}
                </span>
              </>}
              {variant==="reinforcement"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11}}>след. подкрепление через <b>{10-(hist.length%10)}</b> ходов</span>
              </>}
              {variant==="fischer960"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11,color:CC.textDim,fontFamily:"ui-monospace, monospace"}}>{variantStartFen.split("/")[0]}</span>
              </>}
              {variant==="threecheck"&&<>
                <div style={{flex:1}}/>
                <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                  <span style={{fontWeight:700}}>⚪</span>
                  {[0,1,2].map(i=><span key={i} style={{
                    display:"inline-block",width:16,height:16,borderRadius:"50%",
                    background:i<checksByWhite?`radial-gradient(circle at 30% 30%, #fca5a5, ${CC.danger})`:CC.surface3,
                    border:`1px solid ${i<checksByWhite?CC.danger:CC.border}`,
                    boxShadow:i<checksByWhite?"0 0 8px rgba(220,38,38,0.5)":"none",
                    animation:i===checksByWhite-1?"pop 0.5s ease-out":""
                  }}/>)}
                </span>
                <span style={{color:CC.textDim,fontSize:11}}>·</span>
                <span style={{display:"inline-flex",alignItems:"center",gap:4}}>
                  <span style={{fontWeight:700}}>⚫</span>
                  {[0,1,2].map(i=><span key={i} style={{
                    display:"inline-block",width:16,height:16,borderRadius:"50%",
                    background:i<checksByBlack?`radial-gradient(circle at 30% 30%, #fca5a5, ${CC.danger})`:CC.surface3,
                    border:`1px solid ${i<checksByBlack?CC.danger:CC.border}`,
                    boxShadow:i<checksByBlack?"0 0 8px rgba(220,38,38,0.5)":"none",
                    animation:i===checksByBlack-1?"pop 0.5s ease-out":""
                  }}/>)}
                </span>
              </>}
              {variant==="kingofthehill"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11}}>цель: король на <b>d4·d5·e4·e5</b></span>
              </>}
              {variant==="atomic"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11,color:"#9a3412"}}>💥 каждое взятие = взрыв 3×3</span>
              </>}
              {variant==="knightriders"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11}}>🐎 только кони + пешки</span>
              </>}
              {variant==="pawnapocalypse"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11}}>💀 пешечная война</span>
              </>}
              {variant==="powerdrop"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11}}>след. дроп через <b>{5-(hist.length%5)}</b> ходов</span>
              </>}
              {variant==="crazyhouse"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11,color:"#9a3412",fontWeight:800}}>🏚 drop в любой момент</span>
              </>}
            </div>
            {(variant==="powerdrop"||variant==="crazyhouse")&&(()=>{
              const myPool=dropPool[pCol];
              const oppPool=dropPool[pCol==="w"?"b":"w"];
              const dropEvery=variant==="crazyhouse"?1:5;
              const canDrop=isDropAvailable(hist.length,dropEvery)&&game.turn()===pCol&&!over&&poolSize(dropPool,pCol)>0;
              return <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid #fb923c`}}>
                <div style={{display:"flex",gap:SPACE[2],alignItems:"center",flexWrap:"wrap"}}>
                  <span style={{fontSize:10,fontWeight:900,color:"#9a3412",letterSpacing:0.5}}>ТВОЙ ПУЛ:</span>
                  {(["q","r","b","n","p"] as const).map(t=>{
                    const cnt=myPool[t];
                    if(cnt===0)return null;
                    const sym=pCol==="w"?t.toUpperCase():t;
                    const isSel=selectedDropPiece===t&&dropPickerOpen;
                    return <button key={t} onClick={()=>{
                      if(!canDrop){
                        if(variant==="crazyhouse")showToast("Дождись своего хода — drop только после захвата фигуры","info");
                        else showToast(`Drop доступен через ${dropEvery-(hist.length%dropEvery)} ходов`,"info");
                        return;
                      }
                      sSelectedDropPiece(t);sDropPickerOpen(true);
                      showToast(`Кликни на пустую клетку чтобы дропнуть ${POOL_GLYPH[sym]}`,"info");
                    }} style={{
                      display:"inline-flex",alignItems:"center",gap:3,
                      padding:"3px 8px",borderRadius:RADIUS.sm,
                      background:isSel?CC.gold:canDrop?CC.surface1:CC.surface2,
                      border:isSel?`2px solid ${CC.text}`:`1px solid ${CC.border}`,
                      cursor:canDrop?"pointer":"not-allowed",
                      opacity:canDrop?1:0.5,
                      fontSize:14,fontWeight:900,
                    }}>
                      <span>{POOL_GLYPH[sym]}</span>
                      <span style={{fontSize:11}}>×{cnt}</span>
                    </button>;
                  })}
                  {poolSize(dropPool,pCol)===0&&<span style={{fontSize:11,color:CC.textDim,fontStyle:"italic"}}>пуст — захвати фигуру</span>}
                  {dropPickerOpen&&<Btn size="xs" variant="ghost" onClick={()=>{sDropPickerOpen(false);sSelectedDropPiece(null)}}>✕ отмена</Btn>}
                </div>
                {poolSize(dropPool,pCol==="w"?"b":"w")>0&&<div style={{display:"flex",gap:SPACE[1],alignItems:"center",marginTop:4,opacity:0.7}}>
                  <span style={{fontSize:10,color:"#9a3412"}}>пул соперника:</span>
                  {(["q","r","b","n","p"] as const).map(t=>{
                    const cnt=oppPool[t];if(cnt===0)return null;
                    const sym=pCol==="w"?t:t.toUpperCase();
                    return <span key={t} style={{fontSize:13}}>{POOL_GLYPH[sym]}×{cnt}</span>;
                  })}
                </div>}
              </div>;
            })()}
          </div>}
          {/* Post-game accuracy card (auto-appears once Stockfish finishes scoring each ply) */}
          {over&&(tab==="play"||tab==="coach")&&analysis.length>=Math.max(1,hist.length-1)&&analysis.length>0&&(()=>{
            const wS={g:0,good:0,ina:0,mi:0,bl:0,loss:0,c:0};const bS={...wS};
            for(let i=0;i<analysis.length;i++){
              const isW=i%2===0;const s=isW?wS:bS;
              const q=analysis[i].quality;
              if(q==="great")s.g++;else if(q==="good")s.good++;else if(q==="inacc")s.ina++;else if(q==="mistake")s.mi++;else if(q==="blunder")s.bl++;
              s.c++;
              if(i>0){const prev=analysis[i-1].cp;const cur=analysis[i].cp;const pfm=isW?prev:-prev;const cfm=isW?cur:-cur;s.loss+=Math.max(0,Math.min(1000,pfm-cfm))}
            }
            const acc=(s:typeof wS)=>s.c===0?0:Math.max(0,Math.min(100,Math.round(100-(s.loss/s.c)/8)));
            const meS=pCol==="w"?wS:bS;const aiS=pCol==="w"?bS:wS;
            const meAcc=acc(meS);const aiAcc=acc(aiS);
            const ac=(a:number)=>a>=85?T.accent:a>=70?T.blue:a>=50?"#ca8a04":T.danger;
            const row=(lbl:string,s:typeof wS,a:number,flag:string)=>(
              <div style={{flex:1,padding:"10px 12px",background:"#fff",borderRadius:8,border:`1px solid ${T.border}`}}>
                <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{fontSize:12,fontWeight:800,color:T.dim,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>{flag} {lbl}</div>
                  <div style={{fontSize:22,fontWeight:900,color:ac(a),fontFamily:"monospace",lineHeight:1}}>{a}%</div>
                </div>
                <div style={{display:"flex",gap:8,fontSize:12,fontWeight:700}}>
                  <span style={{color:T.accent}}>!{s.g}</span>
                  <span style={{color:"#ca8a04"}}>?!{s.ina}</span>
                  <span style={{color:"#ea580c"}}>?{s.mi}</span>
                  <span style={{color:T.danger}}>??{s.bl}</span>
                </div>
              </div>);
            return <div style={{marginTop:8,display:"flex",gap:8,padding:"12px",borderRadius:10,background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)",border:"1px solid #a7f3d0"}}>
              <div style={{flex:"0 0 100%",marginBottom:4,fontSize:13,fontWeight:800,color:"#065f46",letterSpacing:"0.05em",textTransform:"uppercase" as const}}>📊 Точность партии</div>
              {row("Ты",meS,meAcc,pCol==="w"?"⚪":"⚫")}
              {row("AI",aiS,aiAcc,pCol==="w"?"⚫":"⚪")}
            </div>;
          })()}
          {over&&(tab==="play"||tab==="coach")&&analyzing&&<div style={{marginTop:8,padding:"10px 14px",borderRadius:10,background:"rgba(124,58,237,0.08)",border:`1px solid ${T.purple}`,color:T.purple,fontSize:13,fontWeight:700,textAlign:"center"}}>⚡ Считаем точность…</div>}

          {/* ── Blunder Rewind — переиграть свои ошибки как пазлы ── */}
          {over&&(tab==="play"||tab==="coach")&&analysis.length>0&&(()=>{
            const userIsWhite=pCol==="w";
            const myErrors=analysis.map((a,i)=>({a,i}))
              .filter(x=>{
                const isUserMove=userIsWhite?x.i%2===0:x.i%2===1;
                return isUserMove&&(x.a.quality==="blunder"||x.a.quality==="mistake");
              })
              .slice(0,6);
            if(myErrors.length===0)return null;
            return <div style={{marginTop:SPACE[2],padding:SPACE[3],borderRadius:RADIUS.lg,
              background:"linear-gradient(135deg,#fef3c7,#fffbeb)",border:"1px solid #fcd34d",
              boxShadow:SHADOW.sm}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <span style={{fontSize:18}}>🎯</span>
                <div style={{fontSize:13,fontWeight:900,color:"#92400e",letterSpacing:0.3}}>ПЕРЕИГРАТЬ ОШИБКИ</div>
                <Badge tone="gold" size="xs">+3 Chessy за каждую</Badge>
              </div>
              <div style={{fontSize:11,color:"#b45309",marginBottom:SPACE[2],lineHeight:1.5}}>
                Кликни на блундер — откроется позиция до ошибки, найди правильный ход.
              </div>
              <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap"}}>
                {myErrors.map(({a,i})=>{
                  const isBlunder=a.quality==="blunder";
                  return <button key={i} onClick={()=>rewindBlunder(i)}
                    className="cc-focus-ring"
                    title={`Ход ${Math.floor(i/2)+1}${userIsWhite?"":"..."}  · ${isBlunder?"Блундер":"Ошибка"} · eval ${a.cp>=0?"+":""}${(a.cp/100).toFixed(1)}`}
                    style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",
                      borderRadius:RADIUS.full,border:`1px solid ${isBlunder?"#fca5a5":"#fdba74"}`,
                      background:isBlunder?"#fef2f2":"#fff7ed",
                      color:isBlunder?CC.danger:"#c2410c",
                      fontSize:12,fontWeight:800,cursor:"pointer",
                      transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                    <span style={{fontSize:13,fontWeight:900}}>{isBlunder?"??":"?"}</span>
                    <span>Ход {Math.floor(i/2)+1}{userIsWhite?".":"..."}</span>
                  </button>;
                })}
              </div>
            </div>;
          })()}

          {/* My player block (bottom = me) */}
          {!setup&&(tab==="play"||tab==="coach")&&<div style={{
            padding:"10px 14px",borderRadius:RADIUS.lg,
            background:CC.surface1,
            border:`1px solid ${myT&&on&&!over?CC.brand:CC.border}`,
            display:"flex",alignItems:"center",gap:SPACE[3],
            boxShadow:myT&&on&&!over?"0 0 0 3px rgba(5,150,105,0.18), 0 2px 8px rgba(5,150,105,0.1)":SHADOW.sm,
            transition:`all ${MOTION.base} ${MOTION.ease}`
          }}>
            <div style={{
              width:40,height:40,borderRadius:RADIUS.md,
              background:"linear-gradient(135deg,#059669 0%,#10b981 60%,#14b8a6)",
              display:"flex",alignItems:"center",justifyContent:"center",
              color:"#fff",fontSize:18,flexShrink:0,boxShadow:SHADOW.sm,
              position:"relative"
            }}>
              👤
              {myT&&!over&&on&&<span style={{
                position:"absolute",right:-2,bottom:-2,width:12,height:12,borderRadius:"50%",
                background:CC.brand,border:"2px solid #fff",
                boxShadow:"0 0 0 2px rgba(5,150,105,0.4)"
              }}/>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <span style={{fontSize:14,fontWeight:800,color:CC.text}}>{hotseat?"Игрок":"You"}</span>
                <Badge tone="gold" size="xs">{rat}</Badge>
                <Badge tone="neutral" size="xs">{rk.i} {rk.t}</Badge>
              </div>
              {capB.length>0&&<div style={{fontSize:16,letterSpacing:1,lineHeight:1,marginTop:4,color:CC.textDim}} translate="no">{capB.join("")}</div>}
            </div>
          </div>}

          {on&&!setup&&(tab==="play"||tab==="coach")&&<div style={{padding:"6px 10px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,fontSize:14,color:T.dim}}>
            <span style={{color:useSF?T.purple:T.blue}}>●</span> {lv.name} ({lv.elo})
          </div>}
          {on&&!setup&&tab==="analysis"&&<div style={{padding:"6px 10px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,fontSize:14,color:T.dim}}>
            <span style={{color:useSF?T.purple:T.blue}}>●</span> {useSF?`Stockfish depth ${SFD[aiI]||10}`:`Minimax depth ${lv.depth}`} · {lv.name} {lv.elo}
            {sfOk&&!over&&<span style={{marginLeft:8,color:evalMate!==0?(evalMate>0?T.accent:T.danger):Math.abs(evalCp)<30?T.dim:evalCp>0?T.accent:T.danger,fontWeight:700}}>
              Eval: {evalMate!==0?`M${Math.abs(evalMate)}`:(evalCp/100).toFixed(2)}
            </span>}
          </div>}

          {/* Opening detection */}
          {currentOpening&&(on&&!setup||tab==="analysis")&&hist.length>0&&<div style={{
            padding:`${SPACE[3]}px ${SPACE[4]}px`,borderRadius:RADIUS.lg,
            background:"linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 60%,#dcfce7)",
            border:"1px solid #a7f3d0",
            boxShadow:"0 2px 8px rgba(5,150,105,0.08), inset 0 1px 0 rgba(255,255,255,0.6)"
          }}>
            <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:4}}>
              <span style={{
                fontSize:11,fontWeight:900,padding:"3px 8px",borderRadius:RADIUS.sm,
                background:CC.brand,color:"#fff",
                fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:1
              }}>{currentOpening.eco}</span>
              <span style={{fontSize:13,fontWeight:800,color:CC.text}}>{currentOpening.name}</span>
            </div>
            <div style={{fontSize:12,color:"#065f46",lineHeight:1.45}}>{currentOpening.desc}</div>
          </div>}

          {/* Game Stats — per-side breakdown with eval graph */}
          {showAnal&&analysis.length>0&&(()=>{
            // Per-side stats
            const wStats={great:0,good:0,inacc:0,mistake:0,blunder:0,totalLoss:0,count:0};
            const bStats={great:0,good:0,inacc:0,mistake:0,blunder:0,totalLoss:0,count:0};
            for(let i=0;i<analysis.length;i++){
              const isWhite=i%2===0;
              const stats=isWhite?wStats:bStats;
              stats[analysis[i].quality]++;
              stats.count++;
              if(i>0){
                const prev=analysis[i-1].cp;const curr=analysis[i].cp;
                const prevFromMover=isWhite?prev:-prev;
                const currFromMover=isWhite?curr:-curr;
                const drop=Math.max(0,prevFromMover-currFromMover);
                stats.totalLoss+=Math.min(drop,1000);
              }
            }
            const wAcpl=wStats.count>0?Math.round(wStats.totalLoss/wStats.count):0;
            const bAcpl=bStats.count>0?Math.round(bStats.totalLoss/bStats.count):0;
            const wAcc=Math.max(0,Math.min(100,Math.round(100-wAcpl/8)));
            const bAcc=Math.max(0,Math.min(100,Math.round(100-bAcpl/8)));
            const accColor=(acc:number)=>acc>=85?T.accent:acc>=70?T.blue:acc>=50?"#ca8a04":T.danger;
            // Eval graph points
            const graphPoints=analysis.map((a,i)=>{
              const v=a.mate!==0?(a.mate>0?10:-10):Math.max(-10,Math.min(10,a.cp/100));
              return{i,v,quality:a.quality};
            });
            const sideStat=(name:string,color:string,s:typeof wStats,acc:number,acpl:number,icon:string)=>(
              <div style={{flex:1,padding:"12px",borderRadius:9,background:color==="w"?"#fff":"#1e293b",border:`1px solid ${color==="w"?T.border:"#334155"}`,color:color==="w"?T.text:"#f1f5f9"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:18}}>{icon}</span>
                    <span style={{fontSize:12,fontWeight:800,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>{name}</span>
                  </div>
                  <div style={{fontSize:22,fontWeight:900,color:accColor(acc),lineHeight:1,fontFamily:"monospace"}}>{acc}%</div>
                </div>
                <div style={{fontSize:10,color:color==="w"?T.dim:"#94a3b8",fontWeight:700,marginBottom:6}}>Потеря сантипешек: <b style={{color:color==="w"?T.text:"#f1f5f9"}}>{acpl}</b></div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
                  {[["!",s.great,T.accent,"great"],["○",s.good,color==="w"?T.dim:"#94a3b8","good"],["?!",s.inacc,"#ca8a04","inacc"],["?",s.mistake,"#ea580c","mistake"],["??",s.blunder,T.danger,"blunder"]].map(([sym,v,col,k])=>(
                    <div key={k as string} style={{padding:"5px 2px",borderRadius:5,background:color==="w"?"#f9fafb":"#0f172a",textAlign:"center",border:`1px solid ${color==="w"?T.border:"#334155"}`}}>
                      <div style={{fontSize:11,fontWeight:900,color:col as string,lineHeight:1}}>{sym as string}</div>
                      <div style={{fontSize:13,fontWeight:900,color:color==="w"?T.text:"#f1f5f9",lineHeight:1.2,marginTop:2}}>{v as number}</div>
                    </div>
                  ))}
                </div>
              </div>);
            return(<div style={{display:"flex",flexDirection:"column",gap:10}}>
              {/* Eval graph */}
              <div style={{borderRadius:10,background:"#0f172a",padding:"10px 12px",border:"1px solid #334155"}}>
                <div style={{fontSize:11,fontWeight:800,color:"#94a3b8",letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
                  <span>📈 График оценки</span>
                  <span style={{fontSize:10,color:"#64748b"}}>{analysis.length} ходов</span>
                </div>
                <svg viewBox={`0 0 ${Math.max(100,analysis.length*4)} 80`} preserveAspectRatio="none" style={{width:"100%",height:80,background:"linear-gradient(180deg,#1e293b 0%,#0f172a 50%,#1e293b 100%)",borderRadius:6}}>
                  <line x1="0" y1="40" x2={analysis.length*4} y2="40" stroke="#475569" strokeWidth="0.5" strokeDasharray="2,2"/>
                  {/* White area above midline */}
                  <polygon fill="rgba(5,150,105,0.25)" points={`0,40 ${graphPoints.map(p=>`${p.i*4},${40-p.v*3.5}`).join(" ")} ${(analysis.length-1)*4},40`}/>
                  {/* Line */}
                  <polyline fill="none" stroke="#10b981" strokeWidth="1.5" points={graphPoints.map(p=>`${p.i*4},${40-p.v*3.5}`).join(" ")}/>
                  {/* Mistake/blunder dots */}
                  {graphPoints.map(p=>{
                    if(p.quality==="blunder")return<circle key={p.i} cx={p.i*4} cy={40-p.v*3.5} r="2" fill="#ef4444"/>;
                    if(p.quality==="mistake")return<circle key={p.i} cx={p.i*4} cy={40-p.v*3.5} r="1.8" fill="#f97316"/>;
                    if(p.quality==="great")return<circle key={p.i} cx={p.i*4} cy={40-p.v*3.5} r="1.5" fill="#10b981"/>;
                    return null;
                  })}
                </svg>
              </div>
              {/* Per-side stats */}
              <div style={{display:"flex",gap:8}}>
                {sideStat("Белые","w",wStats,wAcc,wAcpl,"⚪")}
                {sideStat("Чёрные","b",bStats,bAcc,bAcpl,"⚫")}
              </div>
            </div>);
          })()}

          {pms.length>0&&<div style={{padding:"8px 12px",borderRadius:8,background:"linear-gradient(135deg,#eff6ff,#f0f9ff)",border:"1px solid #bfdbfe"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase" as const,color:T.blue}}>⚡ Premove queue · {pms.length}</span>
              <span style={{fontSize:8,color:T.dim,fontStyle:"italic"}}>ПКМ · Esc</span>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>{pms.map((p,i)=><span key={i} style={{padding:"2px 6px",borderRadius:4,fontFamily:"monospace",fontSize:14,fontWeight:700,background:"#fff",color:T.blue,border:"1px solid #dbeafe"}}>{p.from}→{p.to}</span>)}</div>
          </div>}

          {(capB.length>0||capW.length>0)&&tab==="analysis"&&<div style={{padding:"8px 12px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:13,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase" as const,color:T.dim,marginBottom:4}}>⚔ Captured</div>
            {capB.length>0&&<div style={{fontSize:20,letterSpacing:2,lineHeight:1.1}} translate="no">{capB.join("")}</div>}
            {capW.length>0&&<div style={{fontSize:20,letterSpacing:2,lineHeight:1.1,opacity:0.5}} translate="no">{capW.join("")}</div>}
          </div>}

          {/* ── Compact Engine Variations (Analysis tab only) ── */}
          {tab==="analysis"&&mpvLines.length>0&&<div style={{borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,background:"#faf5ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase" as const,color:T.purple}}>🌳 Варианты · d{mpvLines[0]?.depth||mpvDepth}</span>
              <span style={{fontSize:10,color:T.dim,fontWeight:600}}>{mpvLines.length} {mpvLines.length===1?"линия":"линий"}</span>
            </div>
            <div style={{maxHeight:180,overflowY:"auto"}}>
              {mpvLines.map((line,i)=>{
                const evalStr=line.mate!==0?`M${Math.abs(line.mate)}`:(line.cp/100).toFixed(1);
                const isPos=line.mate!==0?line.mate>0:line.cp>0;
                const sanMoves=uciToSan(analFen||game.fen(),line.moves);
                const uciMoves=line.moves;
                const baseFen=analFen||game.fen();
                return(<div key={i} style={{padding:"5px 10px",borderBottom:i<mpvLines.length-1?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",gap:8,background:i===0?"rgba(5,150,105,0.03)":"transparent"}}>
                  <div style={{minWidth:20,height:20,borderRadius:4,background:i===0?T.accent:i===1?T.blue:T.dim,color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                  <div style={{minWidth:40,padding:"2px 5px",borderRadius:4,background:isPos?"#065f46":"#1e293b",color:"#fff",fontSize:11,fontWeight:900,fontFamily:"monospace",textAlign:"center",flexShrink:0}}>{isPos?"+":""}{evalStr}</div>
                  <div style={{flex:1,minWidth:0,display:"flex",flexWrap:"wrap",gap:2,alignItems:"baseline",overflow:"hidden"}}>
                    {sanMoves.slice(0,8).map((san,j)=>{
                      const moveNum=Math.floor(j/2)+1;const isWhite=j%2===0;
                      return<span key={j} onClick={()=>{
                        try{const ch=new Chess(baseFen);for(let k=0;k<=j;k++){const u=uciMoves[k];if(!u)break;ch.move({from:u.slice(0,2) as Square,to:u.slice(2,4) as Square,promotion:(u[4]||"q") as any});}setGame(ch);sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);}catch{}
                      }} style={{fontSize:11,fontFamily:"monospace",fontWeight:j===0?800:500,color:j===0?T.text:"#4b5563",cursor:"pointer",padding:"1px 4px",borderRadius:3,background:j===0?"rgba(5,150,105,0.1)":"transparent"}}>
                        {isWhite&&<span style={{color:T.dim,fontSize:9,marginRight:1}}>{moveNum}.</span>}{san}
                      </span>;
                    })}
                    {sanMoves.length>8&&<span style={{fontSize:10,color:T.dim}}>…</span>}
                  </div>
                </div>);
              })}
            </div>
          </div>}

          {/* Analyze Game button - when game has history */}
          {tab==="analysis"&&hist.length>0&&!showAnal&&!analyzing&&<button onClick={runAnalysis} style={{padding:"10px 14px",borderRadius:10,border:"none",background:T.purple,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 2px 6px rgba(124,58,237,0.2)"}}>
            🔍 Проанализировать всю партию ({hist.length} ходов)
          </button>}
          {tab==="analysis"&&analyzing&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(124,58,237,0.08)",border:`1px solid ${T.purple}`,color:T.purple,fontSize:13,fontWeight:700,textAlign:"center"}}>⚡ Analyzing…</div>}

          <div ref={hR} style={{borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"8px 14px",borderBottom:`1px solid ${T.border}`,background:"#f9fafb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase" as const,color:T.dim}}>Ходы {hist.length>0&&<span style={{color:T.accent,marginLeft:4}}>· {Math.ceil(hist.length/2)}</span>}{refiningAnalysis&&<span style={{marginLeft:8,fontSize:10,color:T.purple,fontWeight:700,letterSpacing:"normal",textTransform:"none" as const}}>⚡ уточняю d18...</span>}</span>
              {hist.length>0&&<div style={{display:"flex",gap:3,alignItems:"center"}}>
                <button onClick={()=>{sReplaying(false);const g=new Chess(fenHist[0]);setGame(g);sBk(k=>k+1);sBrowseIdx(0);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="В начало">⏮</button>
                <button onClick={()=>{sReplaying(false);const ni=Math.max(0,(browseIdx<0?hist.length:browseIdx)-1);const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="Назад">◀</button>
                <button onClick={()=>{
                  if(replaying){sReplaying(false);return}
                  // If at end, rewind to start before starting replay
                  if(browseIdx<0||browseIdx>=hist.length-1){try{const g=new Chess(fenHist[0]);setGame(g);sBk(k=>k+1);sBrowseIdx(0);sLm(null)}catch{}}
                  sReplaying(true);
                }} style={{padding:"3px 9px",borderRadius:4,border:`1px solid ${replaying?T.accent:T.border}`,background:replaying?"rgba(5,150,105,0.1)":"#fff",color:replaying?T.accent:T.text,fontSize:11,fontWeight:800,cursor:"pointer"}} title={replaying?"Пауза":"Авто-воспроизведение"}>{replaying?"❚❚":"▶"}</button>
                {replaying&&<select value={replaySpeed} onChange={e=>sReplaySpeed(+e.target.value)} style={{padding:"2px 4px",borderRadius:4,border:`1px solid ${T.border}`,fontSize:11,cursor:"pointer",background:"#fff"}} title="Скорость">
                  <option value={2000}>0.5x</option>
                  <option value={1000}>1x</option>
                  <option value={500}>2x</option>
                  <option value={250}>4x</option>
                </select>}
                <button onClick={()=>{sReplaying(false);const ni=browseIdx<0?hist.length:Math.min(hist.length,browseIdx+1);const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni>=hist.length?-1:ni);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="Вперёд">▶</button>
                <button onClick={()=>{sReplaying(false);const g=new Chess(fenHist[fenHist.length-1]);setGame(g);sBk(k=>k+1);sBrowseIdx(-1);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:browseIdx<0?`1px solid ${T.accent}`:`1px solid ${T.border}`,background:browseIdx<0?"rgba(5,150,105,0.1)":"#fff",fontSize:11,cursor:"pointer"}} title="К последнему">⏭</button>
              </div>}
            </div>
            <div style={{maxHeight:tab==="analysis"?520:320,overflowY:"auto",padding:"4px 0"}}>
              {hist.length?<div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr",fontSize:13,fontFamily:"monospace"}}>
                {Array.from({length:Math.ceil(hist.length/2)}).map((_,i)=>{
                  const white=hist[i*2],black=hist[i*2+1];
                  const wIdx=i*2,bIdx=i*2+1;
                  const wIsBrowsed=browseIdx===wIdx||(browseIdx<0&&wIdx===hist.length-1);
                  const bIsBrowsed=browseIdx===bIdx||(browseIdx<0&&bIdx===hist.length-1);
                  const wEval=analysis[wIdx];const bEval=analysis[bIdx];
                  const wQ=wEval?.quality;const bQ=bEval?.quality;
                  const qIcon=(q?:string)=>q==="blunder"?"??":q==="mistake"?"?":q==="inacc"?"?!":q==="great"?"!":"";
                  const qColor=(q?:string)=>q==="blunder"?T.danger:q==="mistake"?"#ea580c":q==="inacc"?"#ca8a04":q==="great"?T.accent:"";
                  return <React.Fragment key={i}>
                    <span style={{color:T.dim,fontWeight:700,textAlign:"center",padding:"5px 0",background:"#fafafa",borderRight:`1px solid ${T.border}`,fontSize:12}}>{i+1}</span>
                    <span onClick={()=>white&&(()=>{const g=new Chess(fenHist[wIdx+1]);setGame(g);sBk(k=>k+1);sBrowseIdx(wIdx);sLm(null);sSel(null);sVm(new Set());})()} style={{color:T.text,fontWeight:600,padding:"5px 10px",background:wIsBrowsed?"rgba(5,150,105,0.15)":"transparent",borderLeft:wIsBrowsed?`3px solid ${T.accent}`:"3px solid transparent",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{white||""}{wQ&&<span style={{color:qColor(wQ),fontWeight:900,marginLeft:3}}>{qIcon(wQ)}</span>}</span>
                      {wEval&&<span style={{fontSize:10,color:wEval.cp>0?T.accent:wEval.cp<0?T.danger:T.dim,fontWeight:700}}>{wEval.mate!==0?`M${Math.abs(wEval.mate)}`:(wEval.cp/100).toFixed(1)}</span>}
                    </span>
                    <span onClick={()=>black&&(()=>{const g=new Chess(fenHist[bIdx+1]);setGame(g);sBk(k=>k+1);sBrowseIdx(bIdx);sLm(null);sSel(null);sVm(new Set());})()} style={{color:T.text,fontWeight:600,padding:"5px 10px",background:bIsBrowsed?"rgba(5,150,105,0.15)":"transparent",borderLeft:bIsBrowsed?`3px solid ${T.accent}`:"3px solid transparent",cursor:black?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{black||""}{bQ&&<span style={{color:qColor(bQ),fontWeight:900,marginLeft:3}}>{qIcon(bQ)}</span>}</span>
                      {bEval&&<span style={{fontSize:10,color:bEval.cp>0?T.accent:bEval.cp<0?T.danger:T.dim,fontWeight:700}}>{bEval.mate!==0?`M${Math.abs(bEval.mate)}`:(bEval.cp/100).toFixed(1)}</span>}
                    </span>
                  </React.Fragment>;
                })}
              </div>:<div style={{padding:"28px 18px",textAlign:"center",color:CC.textMute}}>
                <div style={{fontSize:32,marginBottom:SPACE[2],opacity:0.6}}>♟</div>
                <div style={{fontSize:13,fontWeight:700,color:CC.textDim}}>Пока нет ходов</div>
                <div style={{fontSize:11,color:CC.textMute,marginTop:4,lineHeight:1.5}}>
                  {tab==="play"||tab==="coach"?"Сделай первый ход — история появится здесь":tab==="puzzles"?"Выбери позицию или загрузи пазл":"Загрузи PGN/FEN или введи ходы"}
                </div>
              </div>}
            </div>
          </div>

          {tab==="puzzles"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
            {/* ── Current Puzzle Card ── */}
            {pzCurrent?<div style={{borderRadius:12,background:pzAttempt==="correct"?"linear-gradient(135deg,#ecfdf5,#f0fdf4)":pzAttempt==="wrong"?"linear-gradient(135deg,#fef2f2,#fff1f2)":"#fff",border:`1px solid ${pzAttempt==="correct"?"#86efac":pzAttempt==="wrong"?"#fca5a5":T.border}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
              <div style={{padding:"14px 16px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:T.dim,marginBottom:2,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>{pzCurrent.name}</div>
                    <div style={{fontSize:18,fontWeight:900,color:T.text,lineHeight:1.2}}>
                      {pzCurrent.side==="w"?"⚪":"⚫"} {pzCurrent.goal==="Mate"?`Мат в ${pzCurrent.mateIn}`:"Найди лучший ход"}
                    </div>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <span style={{fontSize:14,fontWeight:900,padding:"4px 12px",borderRadius:7,background:pzCurrent.r<600?"#d1fae5":pzCurrent.r<1200?"#dbeafe":pzCurrent.r<1800?"#ede9fe":"#fee2e2",color:pzCurrent.r<600?T.accent:pzCurrent.r<1200?T.blue:pzCurrent.r<1800?T.purple:T.danger}}>{pzCurrent.r}</span>
                    {pzTimeLeft>0&&<span style={{fontSize:14,fontWeight:900,color:pzTimeLeft<15?CC.danger:pzTimeLeft<30?CC.gold:CC.text,fontFamily:"ui-monospace, monospace",padding:"2px 8px",borderRadius:5,background:pzTimeLeft<15?"#fef2f2":pzTimeLeft<30?"#fef3c7":"#f3f4f6"}}>⏱ {fmt(pzTimeLeft)}</span>}
                  </div>
                </div>
                {/* Rush HUD — score + streak */}
                {pzMode==="rush"&&rushActive&&<div style={{display:"flex",gap:SPACE[2],marginBottom:SPACE[2],padding:`${SPACE[2]}px ${SPACE[3]}px`,borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d"}}>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{fontSize:11,fontWeight:800,color:"#92400e",letterSpacing:0.5,textTransform:"uppercase" as const}}>RUSH</span>
                    <Badge tone="gold" size="xs">{rushScore} решено</Badge>
                  </div>
                  <div style={{flex:1}}/>
                  <div style={{display:"flex",alignItems:"center",gap:4}}>
                    {rushStreak>0&&<Badge tone="danger" size="xs">🔥 {rushStreak}</Badge>}
                    {rushBest>0&&<Badge tone="neutral" size="xs">best {rushBest}</Badge>}
                  </div>
                </div>}
                {/* Tags */}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  {[pzCurrent.phase,pzCurrent.theme].filter(Boolean).map(t=><span key={t} style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#f3f4f6",color:T.dim,fontWeight:700}}>{t}</span>)}
                </div>
                {/* Result banner */}
                {pzAttempt==="correct"&&<div style={{fontSize:14,fontWeight:900,color:T.accent,padding:"8px 12px",background:"rgba(5,150,105,0.1)",borderRadius:7,marginBottom:10}}>✓ Отлично! Верный ход</div>}
                {pzAttempt==="wrong"&&<div style={{fontSize:14,fontWeight:900,color:T.danger,padding:"8px 12px",background:"rgba(220,38,38,0.1)",borderRadius:7,marginBottom:10}}>✗ Неверно. Попробуй ещё</div>}
                {pzAttempt==="shown"&&<div style={{fontSize:14,fontWeight:800,color:"#92400e",padding:"8px 12px",background:"#fffbeb",borderRadius:7,marginBottom:10,border:"1px solid #fde68a"}}>💡 Ответ: <span style={{fontFamily:"monospace",background:"#fef3c7",padding:"2px 8px",borderRadius:4}}>{pzCurrent.sol[0]}</span></div>}
                {/* Actions */}
                <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap"}}>
                  <Btn size="md" variant="primary" onClick={nextPz} style={{flex:"1 1 auto",minWidth:120}}>▶ Следующая</Btn>
                  <Btn size="md" variant="secondary" onClick={randomPz} title="Случайная">🎲</Btn>
                  {pzAttempt==="wrong"&&<Btn size="md" variant="secondary" icon={<Icon.Undo width={12} height={12}/>} onClick={()=>{const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sPzAttempt("idle");sLm(null)}}>Заново</Btn>}
                  {pzAttempt!=="correct"&&pzAttempt!=="shown"&&<Btn size="md" variant="gold" icon={<Icon.Lightbulb width={12} height={12}/>} onClick={()=>{if(!spendChessy(5,"подсказка"))return;sPzAttempt("shown")}}>Подсказка · 5</Btn>}
                </div>
              </div>
            </div>:<div style={{padding:"24px",textAlign:"center",color:T.dim,fontSize:14,background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>Выбери задачу из списка ниже ↓</div>}

            {/* ── Stats strip ── */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(90px,1fr))",gap:SPACE[2]}}>
              <Card padding={SPACE[2]} tone="surface1" style={{background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)",borderColor:"#a7f3d0",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:CC.brand,lineHeight:1}}>{pzSolvedCount}</div>
                <div style={{fontSize:10,color:CC.textDim,fontWeight:800,marginTop:2,letterSpacing:0.5,textTransform:"uppercase" as const}}>Решено</div>
              </Card>
              <Card padding={SPACE[2]} tone="surface1" style={{background:"linear-gradient(135deg,#fef2f2,#fff1f2)",borderColor:"#fecaca",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:CC.danger,lineHeight:1}}>{pzFailedCount}</div>
                <div style={{fontSize:10,color:CC.textDim,fontWeight:800,marginTop:2,letterSpacing:0.5,textTransform:"uppercase" as const}}>Ошибок</div>
              </Card>
              <Card padding={SPACE[2]} tone="surface3" style={{textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:CC.text,lineHeight:1}}>{fPz.length}</div>
                <div style={{fontSize:10,color:CC.textDim,fontWeight:800,marginTop:2,letterSpacing:0.5,textTransform:"uppercase" as const}}>В фильтре</div>
              </Card>
              {rushBest>0&&<Card padding={SPACE[2]} tone="surface1" style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",borderColor:"#fcd34d",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:"#78350f",lineHeight:1}}>{rushBest}</div>
                <div style={{fontSize:10,color:"#92400e",fontWeight:800,marginTop:2,letterSpacing:0.5,textTransform:"uppercase" as const}}>Rush best</div>
              </Card>}
            </div>

            {/* ── Category Selector ── */}
            <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,background:"#f9fafb"}}>
                <span style={{fontSize:11,fontWeight:800,color:T.dim,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>📂 Категория</span>
              </div>
              <div style={{padding:"8px",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                {([
                  ["all","🎲 Все задачи",T.text],
                  ["tactics","⚡ Тактика",T.blue],
                  ["mate1","♔ Мат в 1",T.accent],
                  ["mate2","♔ Мат в 2",T.accent],
                  ["mate3","♔ Мат в 3",T.accent],
                  ["mate4plus","♔ Мат 4+",T.accent],
                  ["opening","📖 Дебют",T.purple],
                  ["middlegame","⚔️ Миттельшпиль",T.purple],
                  ["endgame","🏁 Эндшпиль",T.purple],
                ] as const).map(([cat,label,color])=>{
                  // Count puzzles in this category
                  const cnt=PUZZLES.filter(p=>{
                    if(cat==="all")return true;
                    if(cat==="tactics")return p.goal==="Best move";
                    if(cat==="mate1")return p.goal==="Mate"&&p.mateIn===1;
                    if(cat==="mate2")return p.goal==="Mate"&&p.mateIn===2;
                    if(cat==="mate3")return p.goal==="Mate"&&p.mateIn===3;
                    if(cat==="mate4plus")return p.goal==="Mate"&&!!p.mateIn&&p.mateIn>=4;
                    if(cat==="opening")return p.phase==="Opening";
                    if(cat==="middlegame")return p.phase==="Middlegame";
                    if(cat==="endgame")return p.phase==="Endgame";
                    return false;
                  }).length;
                  const active=pzCategory===cat;
                  return<button key={cat} onClick={()=>{
                    // Reset conflicting filters so category selection is respected
                    sPzCategory(cat);sPzI(0);
                    if(cat!=="all"){
                      sPzFilterGoal("all");sPzFilterMate(0);sPzFilterPhase("all");
                    }
                  }} style={{padding:"8px 6px",borderRadius:7,border:active?`2px solid ${color}`:`1px solid ${T.border}`,background:active?`${color}15`:"#fff",color:active?color:T.text,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <span style={{fontSize:13,fontWeight:800}}>{label}</span>
                    <span style={{fontSize:10,color:T.dim,fontWeight:700}}>{cnt}</span>
                  </button>;
                })}
              </div>
            </div>

            {/* ── Mode Selector ── */}
            <Card padding={SPACE[2]} tone="surface1">
              <SectionHeader title="РЕЖИМ" hint={pzMode==="rush"?"+1..+3с per solve":pzMode==="timed3"?"3 мин + bonus":pzMode==="timed5"?"5 мин + bonus":""}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:SPACE[1]}}>
                {([["learn","📚","Обучение"],["timed3","3⏱","3 мин"],["timed5","5⏱","5 мин"],["rush","⚡","Rush"]] as const).map(([m,ic,label])=>{
                  const active=pzMode===m;
                  return <button key={m} onClick={()=>sPzMode(m)} className="cc-focus-ring"
                    style={{padding:"8px 4px",borderRadius:RADIUS.md,
                      border:active?`2px solid ${CC.accent}`:`1px solid ${CC.border}`,
                      background:active?CC.accentSoft:CC.surface1,color:active?CC.accent:CC.textDim,
                      fontSize:12,fontWeight:800,cursor:"pointer",
                      display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                      transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                    <span style={{fontSize:16}}>{ic}</span>
                    <span style={{fontSize:10,fontWeight:800}}>{label}</span>
                  </button>;
                })}
              </div>
            </Card>

            {/* ── Collapsible Filters ── */}
            <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <button onClick={()=>sPzFiltersExpanded(!pzFiltersExpanded)} style={{width:"100%",padding:"10px 14px",border:"none",background:pzFiltersExpanded?"#f9fafb":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:pzFiltersExpanded?`1px solid ${T.border}`:"none"}}>
                <span style={{fontSize:12,fontWeight:800,color:T.text,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>🔍 Фильтры</span>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  {(pzFilterGoal!=="all"||pzFilterPhase!=="all"||pzFilterSide!=="all"||pzFilterTheme!=="all"||pzFilterMate!==0)&&<span style={{fontSize:11,padding:"2px 7px",borderRadius:4,background:T.blue,color:"#fff",fontWeight:800}}>активны</span>}
                  <span style={{fontSize:13,color:T.dim,transform:pzFiltersExpanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
                </div>
              </button>
              {pzFiltersExpanded&&<div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Цель</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["all","Все"],["Mate","Мат"],["Best move","Лучший ход"]].map(([g,l])=>
                      <button key={g} onClick={()=>{sPzFilterGoal(g);if(g!=="Mate")sPzFilterMate(0);sPzI(0)}} style={{padding:"5px 12px",borderRadius:6,border:"none",background:pzFilterGoal===g?T.accent:"#f3f4f6",color:pzFilterGoal===g?"#fff":T.dim,fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>)}
                    {pzFilterGoal==="Mate"&&[1,2,3].map(n=>
                      <button key={n} onClick={()=>{sPzFilterMate(pzFilterMate===n?0:n);sPzI(0)}} style={{padding:"5px 10px",borderRadius:6,border:"none",background:pzFilterMate===n?T.danger:"#f3f4f6",color:pzFilterMate===n?"#fff":T.dim,fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"monospace"}}>M{n}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Фаза</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {[["all","Все"],["Opening","Дебют"],["Middlegame","Миттельшпиль"],["Endgame","Эндшпиль"]].map(([ph,l])=>
                      <button key={ph} onClick={()=>{sPzFilterPhase(ph);sPzI(0)}} style={{padding:"5px 12px",borderRadius:6,border:"none",background:pzFilterPhase===ph?T.blue:"#f3f4f6",color:pzFilterPhase===ph?"#fff":T.dim,fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Сторона</div>
                  <div style={{display:"flex",gap:4}}>
                    {[["all","Все"],["w","⚪ Белые"],["b","⚫ Чёрные"]].map(([s,l])=>
                      <button key={s} onClick={()=>{sPzFilterSide(s);sPzI(0)}} style={{flex:1,padding:"5px",borderRadius:6,border:"none",background:pzFilterSide===s?"#1e293b":"#f3f4f6",color:pzFilterSide===s?"#fff":T.dim,fontSize:12,fontWeight:700,cursor:"pointer"}}>{l}</button>)}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Тема</div>
                  <select value={pzFilterTheme} onChange={e=>{sPzFilterTheme(e.target.value);sPzI(0)}} style={{width:"100%",padding:"6px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,color:T.text,cursor:"pointer",fontWeight:600}}>
                    <option value="all">Все темы</option>
                    {[...new Set(PUZZLES.map(p=>p.theme))].sort().map(th=><option key={th} value={th}>{th}</option>)}
                  </select>
                </div>
                {(pzFilterGoal!=="all"||pzFilterPhase!=="all"||pzFilterSide!=="all"||pzFilterTheme!=="all"||pzFilterMate!==0)&&<button onClick={()=>{sPzFilterGoal("all");sPzFilterPhase("all");sPzFilterSide("all");sPzFilterTheme("all");sPzFilterMate(0);sPzI(0);}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.danger}`,background:"#fff",color:T.danger,fontSize:12,fontWeight:700,cursor:"pointer",alignSelf:"flex-start"}}>✕ Сбросить</button>}
              </div>}
            </div>

            {/* ── Puzzle List (collapsible) ── */}
            <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <button onClick={()=>sPuzzleListOpen(!puzzleListOpen)} style={{width:"100%",padding:"10px 14px",borderBottom:puzzleListOpen?`1px solid ${T.border}`:"none",background:"#f9fafb",display:"flex",justifyContent:"space-between",alignItems:"center",border:"none",cursor:"pointer"}}>
                <span style={{fontSize:12,fontWeight:800,color:T.text,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>📋 Список задач ({fPz.length}/{PUZZLES.length})</span>
                {PUZZLES.length<5000&&<button onClick={()=>sShowPuzzleExpand(true)} className="cc-focus-ring" style={{marginLeft:"auto",padding:"3px 10px",borderRadius:RADIUS.full,background:CC.accentSoft,color:CC.accent,border:`1px solid ${CC.accent}`,fontSize:11,fontWeight:800,cursor:"pointer"}}>+ Расширить до 20k</button>}
                <span style={{fontSize:11,color:T.dim,fontWeight:700,transform:puzzleListOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
              </button>
              {puzzleListOpen&&<>
              <div style={{maxHeight:520,overflowY:"auto"}}>
                {fPz.length===0?<div style={{padding:"28px",textAlign:"center",color:T.dim,fontSize:13,fontStyle:"italic"}}>Нет задач по фильтру</div>:
                fPz.slice(0,100).map((pz,i)=>{
                  // Build readable name: "Мат в 2 · f5+ Kxf5 · Эндшпиль"
                  const goalLabel=pz.goal==="Mate"?`Мат в ${pz.mateIn||1}`:"Лучший ход";
                  const sideLabel=pz.side==="w"?"⚪ Белые":"⚫ Чёрные";
                  const phaseLabel=pz.phase==="Opening"?"📖 Дебют":pz.phase==="Middlegame"?"⚔️ Миттельшп.":pz.phase==="Endgame"?"🏁 Эндшп.":"";
                  return(<button key={i} onClick={()=>ldPz(i)} style={{width:"100%",padding:"14px 16px",border:"none",borderBottom:i<Math.min(fPz.length,100)-1?`1px solid ${T.border}`:"none",background:pzI===i?"rgba(124,58,237,0.06)":"#fff",cursor:"pointer",textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,borderLeft:pzI===i?`4px solid ${T.purple}`:"4px solid transparent"}}>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{fontSize:15,fontWeight:pzI===i?900:700,color:pzI===i?T.purple:T.text,marginBottom:4}}>#{i+1} · {goalLabel}</div>
                      <div style={{fontSize:12,color:T.dim,display:"flex",gap:10,flexWrap:"wrap"}}>
                        <span>{sideLabel}</span>
                        {phaseLabel&&<span>{phaseLabel}</span>}
                        {pz.theme&&<span style={{color:T.blue,fontWeight:600}}>{pz.theme}</span>}
                      </div>
                    </div>
                    <span style={{fontSize:16,fontWeight:900,color:pz.r<600?T.accent:pz.r<1200?T.blue:pz.r<1800?T.purple:T.danger,padding:"6px 14px",borderRadius:7,background:pz.r<600?"#d1fae5":pz.r<1200?"#dbeafe":pz.r<1800?"#ede9fe":"#fee2e2",minWidth:68,textAlign:"center",flexShrink:0}}>{pz.r}</span>
                  </button>);
                })}
              </div>
              </>}
            </div>
          </div>}

          {/* ── MultiPV Analysis Panel ── */}
          {tab==="analysis"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Position import for Analysis — расширенный source picker */}
            <div style={{borderRadius:RADIUS.md,background:"linear-gradient(135deg,#faf5ff,#f5f3ff)",border:"1px solid #ddd6fe",padding:SPACE[3]}}>
              <div style={{fontSize:11,fontWeight:800,color:CC.accent,letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>📥 Источник позиции</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(130px,1fr))",gap:6}}>
                {/* Empty start */}
                <button onClick={()=>{
                  const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol("w");sFlip(false);
                  showToast("Начальная позиция","info");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>🆕 Начальная</button>

                {/* Last saved game */}
                <button onClick={()=>{
                  if(savedGames.length===0){showToast("Нет сыгранных партий","error");return}
                  const last=savedGames[0];
                  const g=new Chess();const fh:string[]=[g.fen()];const mhist:string[]=[];
                  for(const san of last.moves){try{const mv=g.move(san);if(mv){mhist.push(mv.san);fh.push(g.fen())}}catch{break}}
                  setGame(g);sBk(k=>k+1);sHist(mhist);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(last.result);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(last.playerColor);sFlip(last.playerColor==="b");
                  showToast(`Партия · ${mhist.length} ходов`,"success");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>📜 Последняя партия</button>

                {/* All archive */}
                <button onClick={()=>{if(savedGames.length===0){showToast("Архив пуст","info");return}sGamesModalOpen(true)}}
                  className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>
                  📚 Архив ({savedGames.length})
                </button>

                {/* Current puzzle */}
                <button onClick={()=>{
                  if(!pzCurrent){showToast("Нет активного пазла","error");return}
                  const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pzCurrent.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");
                  showToast(`Пазл · ${pzCurrent.name}`,"success");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>🧩 Текущий пазл</button>

                {/* Random puzzle */}
                <button onClick={()=>{
                  if(PUZZLES.length===0){showToast("Пазлы не загружены","error");return}
                  const pz=PUZZLES[Math.floor(Math.random()*PUZZLES.length)];
                  const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pz.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");
                  showToast(`🎲 Случайный пазл · ${pz.r} · ${pz.name}`,"info");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>🎲 Random пазл</button>

                {/* Daily puzzle */}
                <button onClick={()=>{
                  if(!dailyState||!PUZZLES[dailyState.idx]){showToast("Daily puzzle не готов","error");return}
                  const pz=PUZZLES[dailyState.idx];
                  const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pz.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");
                  showToast(`☀ Пазл дня · ${pz.r}`,"info");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>☀ Daily пазл</button>

                {/* Random endgame study */}
                <button onClick={()=>{
                  if(ENDGAMES.length===0){showToast("Этюды недоступны","error");return}
                  const eg=ENDGAMES[Math.floor(Math.random()*ENDGAMES.length)];
                  const g=new Chess(eg.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([eg.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(eg.side);sFlip(eg.side==="b");
                  showToast(`🏰 Этюд · ${eg.name}`,"info");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>🏰 Случайный этюд</button>

                {/* Random opening line */}
                <button onClick={()=>{
                  if(!openingsDb||openingsDb.length===0){showToast("Дебюты не загружены","error");return}
                  const op=openingsDb[Math.floor(Math.random()*openingsDb.length)];
                  const g=new Chess();const fh:string[]=[g.fen()];const mh:string[]=[];
                  const sans=(typeof op.moves==="string"?op.moves.split(/\s+/):[]).filter(Boolean);
                  for(const san of sans){try{const mv=g.move(san);if(mv){mh.push(mv.san);fh.push(g.fen())}}catch{break}}
                  setGame(g);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol("w");sFlip(false);
                  showToast(`♞ ${op.eco} · ${op.name}`,"info");
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>♞ Случайный дебют</button>

                {/* PGN file */}
                <label className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left",display:"block"}}>
                  📁 PGN файл
                  <input type="file" accept=".pgn,.txt" style={{display:"none"}} onChange={e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    const r=new FileReader();
                    r.onload=()=>{try{
                      const g=new Chess();g.loadPgn(r.result as string);
                      const h=g.history();const g2=new Chess();const fh:string[]=[g2.fen()];const mh:string[]=[];
                      for(const san of h){try{const mv=g2.move(san);if(mv){mh.push(mv.san);fh.push(g2.fen())}}catch{break}}
                      setGame(g2);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
                      showToast(`PGN · ${mh.length} ходов`,"success");
                    }catch{showToast("Неверный PGN","error")}};
                    r.readAsText(f);e.target.value="";
                  }}/>
                </label>

                {/* FEN prompt */}
                <button onClick={()=>{
                  const fen=prompt("Введите FEN позиции:");
                  if(!fen)return;
                  try{const g=new Chess(fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");showToast("FEN загружен","success")}catch{showToast("Неверный FEN","error")}
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>🔤 FEN</button>

                {/* PGN text */}
                <button onClick={()=>{
                  const pgn=prompt("Вставьте PGN:");if(!pgn)return;
                  try{
                    const g=new Chess();g.loadPgn(pgn);
                    const h=g.history();const g2=new Chess();const fh:string[]=[g2.fen()];const mh:string[]=[];
                    for(const san of h){try{const mv=g2.move(san);if(mv){mh.push(mv.san);fh.push(g2.fen())}}catch{break}}
                    setGame(g2);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
                    showToast(`PGN · ${mh.length} ходов`,"success");
                  }catch{showToast("Неверный PGN","error")}
                }} className="cc-focus-ring" style={{padding:"8px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,background:CC.surface1,fontSize:12,fontWeight:700,cursor:"pointer",color:CC.text,textAlign:"left"}}>📋 PGN текст</button>
              </div>
            </div>
            {/* Controls */}
            <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <button onClick={()=>sEnginePanelExpanded(!enginePanelExpanded)} style={{width:"100%",padding:"10px 14px",border:"none",background:enginePanelExpanded?"#f9fafb":"#fff",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",borderBottom:enginePanelExpanded?`1px solid ${T.border}`:"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:900,color:T.text}}>⚡ Engine Analysis</span>
                  <span style={{display:"flex",alignItems:"center",gap:4}}>
                    <span style={{width:6,height:6,borderRadius:3,background:sfOk?T.accent:T.danger}}/>
                    <span style={{fontSize:11,color:T.dim}}>{sfOk?"ready":"loading"}</span>
                  </span>
                </div>
                <span style={{fontSize:13,color:T.dim,transform:enginePanelExpanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
              </button>
              {enginePanelExpanded&&<div style={{padding:12,borderTop:`1px solid ${T.border}`}}>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:14,color:T.dim,fontWeight:700}}>Lines</span>
                  {[1,2,3,4,5].map(n=><button key={n} onClick={()=>sMpvCount(n)} style={{width:26,height:26,borderRadius:6,border:mpvCount===n?`2px solid ${T.purple}`:`1px solid ${T.border}`,background:mpvCount===n?"rgba(124,58,237,0.08)":"#fff",color:mpvCount===n?T.purple:T.dim,fontSize:13,fontWeight:800,cursor:"pointer"}}>{n}</button>)}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:14,color:T.dim,fontWeight:700}}>Depth</span>
                  <input type="range" min={8} max={22} value={mpvDepth} onChange={e=>sMpvDepth(+e.target.value)} style={{width:80,accentColor:T.purple}}/>
                  <span style={{fontSize:13,fontWeight:900,color:T.purple,minWidth:20}}>{mpvDepth}</span>
                </div>
                <button onClick={runMultiPV} style={{padding:"6px 14px",borderRadius:7,border:"none",background:T.purple,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}}>{mpvRunning?"Analyzing...":"▶ Analyze"}</button>
                <button onClick={()=>{if(guessMode){sGuessMode(false);runMultiPV()}else startGuess()}} style={{padding:"6px 14px",borderRadius:7,border:guessMode?`2px solid #f59e0b`:`1px solid ${T.border}`,background:guessMode?"#fffbeb":"#fff",color:guessMode?"#92400e":T.dim,fontSize:13,fontWeight:800,cursor:"pointer"}}>{guessMode?"✕ Exit Guess":"🎯 Guess Move"}</button>
              </div>
              {/* Current FEN display only (import buttons are in "Источник позиции" above) */}
              <div style={{display:"flex",gap:4,alignItems:"center"}}>
                <input value={game.fen()} readOnly onClick={e=>(e.target as HTMLInputElement).select()} style={{flex:1,padding:"5px 8px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:12,fontFamily:"monospace",color:T.dim,background:"#f9fafb"}}/>
                <button onClick={()=>{navigator.clipboard.writeText(game.fen());showToast("FEN скопирован","success")}} style={{padding:"5px 10px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,color:T.dim,cursor:"pointer"}}>📋 Copy</button>
              </div>

              {/* Guess Mode Panel */}
              {guessMode&&<div style={{marginTop:8,padding:"12px",borderRadius:8,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fde68a"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:13,fontWeight:900,color:"#92400e"}}>🎯 Найди лучший ход</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{fontSize:13,fontWeight:800,color:T.accent}}>{guessScore.right}</span>
                    <span style={{fontSize:13,color:T.dim}}>/</span>
                    <span style={{fontSize:13,fontWeight:800,color:T.text}}>{guessScore.total}</span>
                    {guessScore.total>0&&<span style={{fontSize:14,fontWeight:700,color:guessScore.right/guessScore.total>=0.7?T.accent:guessScore.right/guessScore.total>=0.4?"#f59e0b":T.danger}}>
                      {Math.round(guessScore.right/guessScore.total*100)}%
                    </span>}
                  </div>
                </div>
                <div style={{fontSize:13,color:"#78716c",marginBottom:6}}>
                  {game.turn()==="w"?"⚪ Ход белых":"⚫ Ход чёрных"} — сделай ход на доске
                </div>
                {guessResult==="correct"&&<div style={{padding:"8px 12px",borderRadius:6,background:"#ecfdf5",border:"1px solid #86efac",fontSize:14,fontWeight:800,color:T.accent,marginBottom:6}}>✓ Правильно! Лучший ход: {guessBestSan}</div>}
                {guessResult==="wrong"&&<div style={{padding:"8px 12px",borderRadius:6,background:"#fef2f2",border:"1px solid #fca5a5",fontSize:14,fontWeight:800,color:T.danger,marginBottom:6}}>✗ Неверно. Лучший ход был: <span style={{fontFamily:"monospace",background:"#fff",padding:"1px 6px",borderRadius:4}}>{guessBestSan}</span></div>}
                {!guessBest&&<div style={{fontSize:14,color:"#a8a29e"}}>⏳ Engine считает лучший ход...</div>}
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  {guessResult!=="idle"&&<button onClick={nextGuess} style={{padding:"6px 14px",borderRadius:7,border:"none",background:"#f59e0b",color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer"}}>▶ Следующая позиция</button>}
                  {guessResult!=="idle"&&<button onClick={()=>{sGuessMode(false);runMultiPV()}} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",color:T.dim,fontSize:13,fontWeight:700,cursor:"pointer"}}>Показать все линии</button>}
                </div>
              </div>}
              </div>}
            </div>

            {mpvLines.length===0&&!mpvRunning&&<div style={{padding:"20px",textAlign:"center",color:T.dim,fontSize:13,background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>
              Click ▶ Analyze or make a move to see engine lines
            </div>}
            {mpvRunning&&<div style={{padding:"20px",textAlign:"center",color:T.purple,fontSize:14,fontWeight:700,background:"rgba(124,58,237,0.04)",borderRadius:10,border:`1px solid rgba(124,58,237,0.2)`}}>
              ⚡ Analyzing depth {mpvDepth} with {mpvCount} lines...
            </div>}
          </div>}

          {/* ── Coach Tab ── */}
          {tab==="coach"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {/* Mode selector — 5 ways to start a Coach session */}
            {(()=>{
              const modeBtn=(icon:string,title:string,sub:string,onClick:()=>void,active?:boolean)=>(
                <button onClick={onClick} style={{padding:"11px 8px",borderRadius:9,border:active?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:active?"rgba(5,150,105,0.08)":"#fff",cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",gap:4,alignItems:"center",minHeight:86,transition:"all 0.15s",boxShadow:active?"0 2px 8px rgba(5,150,105,0.12)":"none"}}>
                  <span style={{fontSize:22,lineHeight:1}}>{icon}</span>
                  <span style={{fontSize:12,fontWeight:800,color:active?T.accent:T.text,lineHeight:1.2}}>{title}</span>
                  <span style={{fontSize:10,color:T.dim,lineHeight:1.3}}>{sub}</span>
                </button>
              );
              const isVsAI=coachAIEnabled&&!editorMode&&on;
              const isSolo=!coachAIEnabled&&!editorMode;
              return (
                <div style={{borderRadius:10,background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)",border:"1px solid #a7f3d0",padding:"10px 12px"}}>
                  <div style={{fontSize:11,fontWeight:800,color:T.accent,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8}}>🎓 Как учимся</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:6}}>
                    {modeBtn("🤖","Против AI","играй с ботом, Coach комментирует",()=>{
                      sCoachAIEnabled(true);sEditorMode(false);
                      const cl=pCol;setGame(new Chess());sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([new Chess().fen()]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);sCurrentOpening(null);pT.reset();aT.reset();
                      showToast("Новая игра против AI","success");
                    },isVsAI)}
                    {modeBtn("✋","За обоих","двигай сам обе стороны",()=>{
                      sCoachAIEnabled(false);sEditorMode(false);
                      const g=new Chess();setGame(g);sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([g.fen()]);sCapW([]);sCapB([]);sPromo(null);sPms([]);sPmSel(null);sOn(false);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);
                      showToast("Свободная игра за обоих","info");
                    },isSolo&&hist.length===0)}
                    {modeBtn("📥","Импорт","PGN / FEN / расстановка",()=>{
                      sCoachAIEnabled(false);
                      const el=document.getElementById("coach-import-section");
                      if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
                      showToast("Выбери источник ниже","info");
                    })}
                    {modeBtn("🧩","Из пазлов","активный пазл",()=>{
                      if(!pzCurrent){showToast("Сначала выбери пазл во вкладке Puzzles","info");sTab("puzzles");return}
                      const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pzCurrent.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sCoachAIEnabled(false);sEditorMode(false);
                      showToast(`Пазл: ${pzCurrent.name}`,"success");
                    })}
                    {modeBtn("📜",savedGames.length>0?`Библиотека · ${savedGames.length}`:"Библиотека","твои партии",()=>{
                      if(savedGames.length===0){showToast("Нет сыгранных партий — сыграй хотя бы одну","error");return}
                      sGamesModalOpen(true);
                    })}
                    {modeBtn("🏰","Эндшпили",`${ENDGAMES.length} классических позиций`,()=>sShowEndgames(true))}
                  </div>
                </div>
              );
            })()}
            {/* Active endgame banner */}
            {currentEndgame&&<div style={{padding:"10px 12px",borderRadius:10,background:"linear-gradient(135deg,#eff6ff,#dbeafe)",border:"1px solid #93c5fd"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <span style={{fontSize:20}}>🏰</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:800,color:T.blue,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Активный эндшпиль · цель: {currentEndgame.goal==="Win"?"победа":"ничья"} за {currentEndgame.side==="w"?"белых":"чёрных"}</div>
                  <div style={{fontSize:15,fontWeight:900,color:T.text,lineHeight:1.2,marginTop:2}}>{currentEndgame.name}</div>
                </div>
                <div style={{fontSize:13,fontWeight:900,color:"#78350f",background:"#fef3c7",padding:"3px 10px",borderRadius:10,whiteSpace:"nowrap"}}>+{currentEndgame.reward} C</div>
              </div>
              <div style={{fontSize:13,color:T.text,lineHeight:1.5,marginTop:4}}>{currentEndgame.hint}</div>
              <button onClick={()=>sCurrentEndgame(null)} style={{marginTop:6,padding:"4px 10px",borderRadius:6,border:"1px solid "+T.border,background:"#fff",color:T.dim,fontSize:12,fontWeight:700,cursor:"pointer"}}>Отказаться</button>
            </div>}
            {/* Position import */}
            <div id="coach-import-section" style={{borderRadius:10,background:"linear-gradient(135deg,#eff6ff,#f0f9ff)",border:"1px solid #bfdbfe",padding:"10px 12px"}}>
              <div style={{fontSize:11,fontWeight:800,color:T.blue,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8}}>📥 Загрузить позицию</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                <button onClick={()=>{
                  const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol("w");sFlip(false);
                  showToast("Начальная позиция","info");
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>🆕 Начальная</button>

                <button onClick={()=>{
                  // Load latest saved game
                  if(savedGames.length===0){showToast("Нет сыгранных партий","error");return}
                  const last=savedGames[0];
                  const g=new Chess();const fh:string[]=[g.fen()];const mhist:string[]=[];
                  for(const san of last.moves){try{const mv=g.move(san);if(mv){mhist.push(mv.san);fh.push(g.fen())}}catch{break}}
                  setGame(g);sBk(k=>k+1);sHist(mhist);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol(last.playerColor);sFlip(last.playerColor==="b");
                  showToast(`Загружена партия · ${mhist.length} ходов`,"success");
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>📜 Последняя партия</button>

                <button onClick={()=>{
                  if(!pzCurrent){showToast("Нет активного пазла","error");return}
                  const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pzCurrent.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol(g.turn());sFlip(g.turn()==="b");
                  showToast(`Из пазла · ${pzCurrent.name}`,"success");
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>🧩 Текущий пазл</button>

                <label style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left",display:"block"}}>
                  📁 PGN файл
                  <input type="file" accept=".pgn,.txt" style={{display:"none"}} onChange={e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    const r=new FileReader();
                    r.onload=()=>{try{
                      const g=new Chess();g.loadPgn(r.result as string);
                      const h=g.history();const g2=new Chess();const fh:string[]=[g2.fen()];const mh:string[]=[];
                      for(const san of h){try{const mv=g2.move(san);if(mv){mh.push(mv.san);fh.push(g2.fen())}}catch{break}}
                      setGame(g2);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);
                      showToast(`PGN · ${mh.length} ходов`,"success");
                    }catch{showToast("Неверный PGN","error")}};
                    r.readAsText(f);e.target.value="";
                  }}/>
                </label>

                <button onClick={()=>{
                  const fen=prompt("Введите FEN позиции:");
                  if(!fen)return;
                  try{const g=new Chess(fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol(g.turn());sFlip(g.turn()==="b");showToast("FEN загружен","success")}catch{showToast("Неверный FEN","error")}
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>🔤 FEN</button>

                <button onClick={()=>{sEditorMode(true)}} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>✏️ Расставить вручную</button>
              </div>
            </div>
            {/* Combined AI Toggle + Level selector */}
            <div style={{borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,padding:"8px 10px",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>sCoachAIEnabled(true)} style={{padding:"6px 10px",borderRadius:6,border:coachAIEnabled?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:coachAIEnabled?"rgba(5,150,105,0.08)":"#fff",color:coachAIEnabled?T.accent:T.dim,fontSize:12,fontWeight:800,cursor:"pointer"}}>🤖 AI</button>
                <button onClick={()=>sCoachAIEnabled(false)} style={{padding:"6px 10px",borderRadius:6,border:!coachAIEnabled?`2px solid ${T.blue}`:`1px solid ${T.border}`,background:!coachAIEnabled?"rgba(37,99,235,0.08)":"#fff",color:!coachAIEnabled?T.blue:T.dim,fontSize:12,fontWeight:800,cursor:"pointer"}}>✏️ Свободно</button>
              </div>
              {coachAIEnabled&&<><span style={{width:1,height:20,background:T.border}}/>
              <span style={{fontSize:11,color:T.dim,fontWeight:700}}>Уровень:</span>
              <div style={{display:"flex",gap:3}}>
                {([["beginner","🌱","до 1200"],["intermediate","📘","1200-1800"],["advanced","🏆","1800+"]] as const).map(([lv,ic,elo])=>
                  <button key={lv} onClick={()=>sCoachLevel(lv)} title={elo} style={{padding:"6px 8px",borderRadius:5,border:coachLevel===lv?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:coachLevel===lv?"rgba(5,150,105,0.08)":"#fff",fontSize:14,cursor:"pointer"}}>{ic}</button>)}
              </div></>}
            </div>

            {/* Collapsible Learning Tips */}
            {coachAIEnabled&&<div style={{borderRadius:10,background:"linear-gradient(135deg,#fef3c7,#fef9c3)",border:"1px solid #fde68a",overflow:"hidden"}}>
              <button onClick={()=>sCoachTipsExpanded(!coachTipsExpanded)} style={{width:"100%",padding:"8px 12px",border:"none",background:"transparent",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <span style={{fontSize:11,fontWeight:800,color:"#92400e",letterSpacing:"0.05em",textTransform:"uppercase" as const}}>💡 Что изучать · {coachLevel==="beginner"?"Новичок":coachLevel==="intermediate"?"Средний":"Продвинутый"}</span>
                <span style={{fontSize:11,color:"#92400e",transform:coachTipsExpanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
              </button>
              {coachTipsExpanded&&<div style={{padding:"0 14px 12px"}}>
                {coachLevel==="beginner"&&<div style={{fontSize:12,lineHeight:1.6,color:"#78350f"}}>
                  <div style={{marginBottom:5}}><b>Основы:</b> правила ходов, шах и мат, пат</div>
                  <div style={{marginBottom:5}}><b>Принципы:</b> развивай фигуры, контролируй центр, рокируй рано</div>
                  <div style={{marginBottom:5}}><b>Задачи:</b> маты в 1-2 хода, угрозы</div>
                  <div><b>Партии:</b> играй с ботами 800-1000 и спрашивай Coach'а</div>
                </div>}
                {coachLevel==="intermediate"&&<div style={{fontSize:12,lineHeight:1.6,color:"#78350f"}}>
                  <div style={{marginBottom:5}}><b>Тактика:</b> вилка, связка, двойной удар, завлечение</div>
                  <div style={{marginBottom:5}}><b>Дебюты:</b> выбери 1-2 за оба цвета, учи 10-15 ходов</div>
                  <div style={{marginBottom:5}}><b>Эндшпиль:</b> ладейные (Лусена, Филидора), пешечные</div>
                  <div><b>Партии:</b> анализируй свои в Analysis</div>
                </div>}
                {coachLevel==="advanced"&&<div style={{fontSize:12,lineHeight:1.6,color:"#78350f"}}>
                  <div style={{marginBottom:5}}><b>Стратегия:</b> слабые поля, форпосты, пешечная структура</div>
                  <div style={{marginBottom:5}}><b>Дебюты:</b> глубокая подготовка, партии гроссмейстеров</div>
                  <div style={{marginBottom:5}}><b>Эндшпиль:</b> оппозиция, цугцванг, технические позиции</div>
                  <div><b>Классика:</b> Капабланка, Фишер, Карлсен · этюды</div>
                </div>}
              </div>}
            </div>}
            {/* Board Editor Toggle */}
            <div style={{borderRadius:10,background:T.surface,border:`1px solid ${editorMode?T.accent:T.border}`,overflow:"hidden"}}>
              <div style={{padding:"10px 14px",borderBottom:editorMode?`1px solid ${T.border}`:"none",background:editorMode?"#ecfdf5":"#f9fafb",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:800,color:editorMode?T.accent:T.text}}>🎨 {editorMode?"Редактор позиции":"Расстановка фигур"}</span>
                </div>
                <button onClick={()=>{sEditorMode(!editorMode);sEditorPiece(null);sOn(false);sOver(null);sPms([]);sPmSel(null);sHist([]);sFenHist([game.fen()]);}} style={{padding:"5px 12px",borderRadius:6,border:"none",background:editorMode?T.danger:T.accent,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>{editorMode?"✕ Выйти":"✏️ Открыть"}</button>
              </div>
              {editorMode&&<div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
                {/* Piece palette */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.dim,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Белые</div>
                  <div style={{display:"flex",gap:4}}>
                    {(["k","q","r","b","n","p"] as const).map(t=>{
                      const sel=editorPiece?.type===t&&editorPiece?.color==="w";
                      const sym={k:"♔",q:"♕",r:"♖",b:"♗",n:"♘",p:"♙"}[t];
                      return<button key={`w${t}`} onClick={()=>sEditorPiece({type:t,color:"w"})} style={{flex:1,padding:"8px 0",borderRadius:6,border:sel?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:sel?"rgba(5,150,105,0.1)":"#fff",fontSize:28,lineHeight:1,cursor:"pointer"}}>{sym}</button>;
                    })}
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.dim,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Чёрные</div>
                  <div style={{display:"flex",gap:4}}>
                    {(["k","q","r","b","n","p"] as const).map(t=>{
                      const sel=editorPiece?.type===t&&editorPiece?.color==="b";
                      const sym={k:"♚",q:"♛",r:"♜",b:"♝",n:"♞",p:"♟"}[t];
                      return<button key={`b${t}`} onClick={()=>sEditorPiece({type:t,color:"b"})} style={{flex:1,padding:"8px 0",borderRadius:6,border:sel?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:sel?"rgba(5,150,105,0.1)":"#fff",fontSize:28,lineHeight:1,cursor:"pointer"}}>{sym}</button>;
                    })}
                  </div>
                </div>
                {/* Eraser + clear + presets */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={()=>sEditorPiece(null)} style={{padding:"6px 12px",borderRadius:6,border:editorPiece===null?`2px solid ${T.danger}`:`1px solid ${T.border}`,background:editorPiece===null?"#fef2f2":"#fff",fontSize:12,fontWeight:700,color:T.text,cursor:"pointer"}}>🧽 Ластик</button>
                  <button onClick={()=>{const g=new Chess();g.clear();const parts=g.fen().split(" ");parts[1]=editorTurn;try{g.load(parts.join(" "));setGame(g);sBk(k=>k+1);}catch{}}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,color:T.text,cursor:"pointer"}}>⚫ Пустая</button>
                  <button onClick={()=>{const g=new Chess();setGame(g);sBk(k=>k+1);sEditorTurn("w");}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,color:T.text,cursor:"pointer"}}>⟲ Начальная</button>
                </div>
                {/* Turn selector */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:T.dim,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Чей ход</div>
                  <div style={{display:"flex",gap:6}}>
                    {(["w","b"] as const).map(c=><button key={c} onClick={()=>{sEditorTurn(c);try{const parts=game.fen().split(" ");parts[1]=c;const g=new Chess();g.load(parts.join(" "));setGame(g);sBk(k=>k+1);}catch{}}} style={{flex:1,padding:"8px",borderRadius:6,border:editorTurn===c?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:editorTurn===c?"rgba(5,150,105,0.1)":"#fff",fontSize:13,fontWeight:800,color:T.text,cursor:"pointer"}}>{c==="w"?"⚪ Белые":"⚫ Чёрные"}</button>)}
                  </div>
                </div>
                {/* Play from this position */}
                <div style={{display:"flex",gap:6,paddingTop:6,borderTop:`1px solid ${T.border}`}}>
                  <button onClick={()=>{try{const v=game.fen();new Chess(v);sEditorMode(false);sEditorPiece(null);sOn(true);sOver(null);sHist([]);sFenHist([v]);sPCol("w");sFlip(false);showToast("Играть белыми","success");}catch{showToast("Невалидная позиция","error")}}} style={{flex:1,padding:"8px",borderRadius:6,border:"none",background:T.accent,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>▶ Играть белыми</button>
                  <button onClick={()=>{try{const v=game.fen();new Chess(v);sEditorMode(false);sEditorPiece(null);sOn(true);sOver(null);sHist([]);sFenHist([v]);sPCol("b");sFlip(true);showToast("Играть чёрными","success");}catch{showToast("Невалидная позиция","error")}}} style={{flex:1,padding:"8px",borderRadius:6,border:"none",background:"#1e293b",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>▶ Играть чёрными</button>
                </div>
                <div style={{fontSize:11,color:T.dim,fontStyle:"italic",textAlign:"center"}}>Клик по клетке — поставить/убрать фигуру</div>
              </div>}
            </div>
          </div>}

          {tab==="coach"&&!editorMode&&coachAIEnabled&&<AiCoach
            fen={game.fen()}
            moves={hist}
            fenHist={fenHist}
            evalCp={evalCp}
            evalMate={evalMate}
            opening={currentOpening}
            playerColor={pCol}
            visible={true}
            onClose={()=>sTab("play")}
            runEngine={runEnginePromise}
            quickEval={quickEvalPromise}
          />}

          {tab==="play"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
            {[{v:sts.w,l:"W",c:T.accent},{v:sts.l,l:"L",c:T.danger},{v:sts.d,l:"D",c:T.dim}].map(s=><div key={s.l} style={{padding:"8px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:13,color:T.dim}}>{s.l}</div></div>)}
          </div>}
        </div>
      </div>}

      {promo&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>sPromo(null)}>
        <div style={{background:"#fff",borderRadius:14,padding:20,border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:14,fontWeight:800,color:T.text,marginBottom:12,textAlign:"center"}}>Promote</div>
          <div style={{display:"flex",gap:8}}>{(["q","r","b","n"] as const).map(pt=><button key={pt} onClick={()=>{exec(promo.from,promo.to,pt);sPromo(null)}} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:"#fff",cursor:"pointer",width:60,height:60}}><Piece type={pt} color={pCol}/></button>)}</div>
        </div>
      </div>}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes diceRoll{0%{transform:rotate(0) scale(0.5);opacity:0.3}50%{transform:rotate(180deg) scale(1.15)}100%{transform:rotate(360deg) scale(1);opacity:1}}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(0.85);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
    {/* Games History Modal */}
    {gamesModalOpen&&(()=>{
      const byCategory=(cat:string)=>savedGames.filter(g=>cat==="all"||g.category===cat);
      const categoryFilter=gamesFilter;
      const sCategoryFilter=sGamesFilter;
      const filtered=byCategory(categoryFilter);
      const ratingHistory=[...savedGames].reverse().map((g,i)=>({x:i,y:g.rating}));
      const minR=Math.min(...ratingHistory.map(p=>p.y),rat)-50;
      const maxR=Math.max(...ratingHistory.map(p=>p.y),rat)+50;
      const range=Math.max(100,maxR-minR);
      const catStats=(cat:string)=>{
        const games=byCategory(cat);
        const wins=games.filter(g=>g.result.includes("You win")||g.result.includes("win!")).length;
        const losses=games.filter(g=>g.result.includes("AI wins")||g.result.includes("resigned")).length;
        const draws=games.length-wins-losses;
        return{total:games.length,wins,losses,draws};
      };
      return<Modal open={gamesModalOpen} onClose={()=>sGamesModalOpen(false)} size="xl"
        title={<span>📜 Мои партии <span style={{fontSize:13,color:CC.textDim,fontWeight:600,marginLeft:8}}>{savedGames.length} · {rat} ELO</span></span>}>

        {ratingHistory.length>1&&<div style={{background:"#0f172a",borderRadius:RADIUS.md,padding:`${SPACE[3]}px ${SPACE[4]}px`,marginBottom:SPACE[3],border:"1px solid #334155"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2],display:"flex",justifyContent:"space-between"}}>
            <span>📈 Прогресс рейтинга</span>
            <span style={{fontSize:10,color:"#64748b"}}>{minR} — {maxR}</span>
          </div>
          <svg viewBox={`0 0 ${Math.max(100,ratingHistory.length*8)} 80`} preserveAspectRatio="none" style={{width:"100%",height:90,background:"linear-gradient(180deg,#1e293b 0%,#0f172a 100%)",borderRadius:6}}>
            <line x1="0" y1="40" x2={ratingHistory.length*8} y2="40" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2"/>
            <polyline fill="none" stroke="#7c3aed" strokeWidth="1.8" points={ratingHistory.map(p=>`${p.x*8},${80-((p.y-minR)/range)*80}`).join(" ")}/>
            {ratingHistory.map(p=><circle key={p.x} cx={p.x*8} cy={80-((p.y-minR)/range)*80} r="1.8" fill="#a78bfa"/>)}
          </svg>
        </div>}

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:SPACE[2],marginBottom:SPACE[3]}}>
          {(["all","Bullet","Blitz","Rapid"] as const).map(cat=>{
            const s=catStats(cat);const active=categoryFilter===cat;
            const icon=cat==="Bullet"?"⚡":cat==="Blitz"?"🔥":cat==="Rapid"?"⏱":"🎯";
            const pct=s.total>0?Math.round(s.wins/s.total*100):0;
            return<button key={cat} onClick={()=>sCategoryFilter(cat)}
              className="cc-focus-ring"
              style={{padding:SPACE[3],borderRadius:RADIUS.md,
                border:active?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                background:active?CC.brandSoft:CC.surface1,cursor:"pointer",textAlign:"left",
                transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
              <div style={{fontSize:13,fontWeight:900,color:active?CC.brand:CC.text,marginBottom:SPACE[1]}}>{icon} {cat==="all"?"Все":cat}</div>
              <div style={{fontSize:22,fontWeight:900,color:CC.text,lineHeight:1}}>{s.total}</div>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:700,marginTop:SPACE[1],textTransform:"uppercase" as const,letterSpacing:0.5}}>партий</div>
              {s.total>0&&<div style={{marginTop:SPACE[2],display:"flex",gap:6,fontSize:11,fontWeight:800}}>
                <span style={{color:CC.brand}}>{s.wins}W</span>
                <span style={{color:CC.danger}}>{s.losses}L</span>
                <span style={{color:CC.textDim}}>{s.draws}D</span>
                <span style={{marginLeft:"auto",color:pct>=60?CC.brand:pct>=40?CC.info:CC.danger}}>{pct}%</span>
              </div>}
            </button>;
          })}
        </div>

        <div style={{border:`1px solid ${CC.border}`,borderRadius:RADIUS.md,overflow:"hidden",maxHeight:400,overflowY:"auto"}}>
          {filtered.length===0?<div style={{padding:40,textAlign:"center",color:CC.textDim,fontSize:14}}>Нет партий в этой категории</div>:
          filtered.map(g=>{
            const isWin=g.result.includes("You win")||g.result.includes("win!");
            const isDraw=g.result.includes("Draw")||g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
            const resCol=isWin?CC.brand:isDraw?CC.textDim:CC.danger;
            const date=new Date(g.date);
            return<button key={g.id} className="cc-focus-ring" onClick={()=>{
              sGamesModalOpen(false);
              const destTab=tab==="coach"?"coach":"analysis";
              sTab(destTab);
              const ch=new Chess();const fh:string[]=[ch.fen()];const mh:string[]=[];
              for(const san of g.moves){try{const mv=ch.move(san);if(mv){mh.push(mv.san);fh.push(ch.fen())}}catch{break}}
              setGame(ch);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(g.result);sOn(false);sSetup(false);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.playerColor);sFlip(g.playerColor==="b");
              if(destTab==="coach"){sCoachAIEnabled(false);sEditorMode(false);}
              showToast(`Партия открыта · ${mh.length} ходов${destTab==="coach"?" · Coach готов к разбору":""}`,"success");
            }} style={{width:"100%",padding:`${SPACE[3]}px ${SPACE[4]}px`,border:"none",borderBottom:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[3],minWidth:0,flex:1}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:resCol+"18",color:resCol,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900,flexShrink:0}}>
                  {isWin?"W":isDraw?"D":"L"}
                </div>
                <div style={{minWidth:0,flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:CC.text,marginBottom:2}}>{g.opening||"Без дебюта"}</div>
                  <div style={{fontSize:11,color:CC.textDim,display:"flex",gap:SPACE[2],flexWrap:"wrap"}}>
                    <span>{g.category||"—"}</span>
                    <span>· {g.aiLevel}</span>
                    <span>· {g.tc}</span>
                    <span>· {g.moves.length} ходов</span>
                    <span>· {g.playerColor==="w"?"⚪":"⚫"}</span>
                  </div>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:SPACE[2]}}>
                <div style={{fontSize:13,fontWeight:900,color:CC.gold}}>{g.rating}</div>
                <div style={{fontSize:10,color:CC.textDim,marginTop:2}}>{date.toLocaleDateString("ru-RU")}</div>
              </div>
            </button>;
          })}
        </div>
      </Modal>;
    })()}

    {/* Chessy Shop */}
    {showShop&&(()=>{
      type ShopItem={id:string;name:string;desc:string;cost:number;kind:"unlock"|"action";onBuy?:()=>void;disabled?:boolean};
      const items:ShopItem[]=[
        {id:"master_ai",name:"Master AI (2400 ELO)",desc:"Разблокирует самого сильного соперника",cost:30,kind:"unlock"},
        {id:"theme_neon",name:"Тема Neon ⚡",desc:"Киберпанк-доска, неоновый градиент",cost:50,kind:"unlock"},
        {id:"theme_obsidian",name:"Тема Obsidian 🖤",desc:"Чёрное с золотом",cost:50,kind:"unlock"},
        {id:"theme_sakura",name:"Тема Sakura 🌸",desc:"Пастель + розовый",cost:50,kind:"unlock"},
        {id:"ai_rival",name:"AI Rival «Алексей» 🧠",desc:"Персональный AI-соперник, который запоминает твои партии и растёт с тобой (beta)",cost:100,kind:"unlock"},
        {id:"hint_ghost",name:"Ghost-подсказка",desc:"На 3 секунды увидишь лучший ход прямо на доске (разовое использование в текущей партии)",cost:15,kind:"action",disabled:!on||!!over,onBuy:()=>{
          if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
          sShowShop(false);
          showToast("🧠 Считаю подсказку...","info");
          sfR.current.go(game.fen(),12,(f,t)=>{
            if(!f||!t){showToast("Не нашёл хода","error");return}
            sArrows([{from:f as Square,to:t as Square,c:"#22c55e"}]);
            setTimeout(()=>sArrows(a=>a.filter(x=>!(x.from===f&&x.to===t))),3000);
          });
        }},
        {id:"deep_review",name:"Глубокий разбор партии",desc:"Coach пройдёт по всем ходам и выдаст план на будущее",cost:20,kind:"action",disabled:hist.length<4,onBuy:()=>{sTab("coach");sShowShop(false);showToast("Открой Coach — разбор готов","info")}},
      ];
      const purchaseUnlock=(id:string,cost:number,name:string)=>{
        if(chessy.owned[id]){showToast("Уже куплено","info");return}
        if(!spendChessy(cost,`покупка: ${name}`))return;
        sChessy(c=>({...c,owned:{...c.owned,[id]:true}}));
        showToast(`✓ Куплено: ${name}`,"success");
      };
      return <Modal open={showShop} onClose={()=>sShowShop(false)} size="lg"
        title={<span>🛒 Chessy · магазин <Badge tone="gold" size="md" style={{marginLeft:8}}><Icon.Coin width={12} height={12}/> {chessy.balance}</Badge></span>}>

        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:SPACE[2],marginBottom:SPACE[4]}}>
          {items.map(it=>{
            const owned=it.kind==="unlock"&&chessy.owned[it.id];
            const afford=chessy.balance>=it.cost;
            const dis=owned||it.disabled||!afford;
            return <div key={it.id} style={{
              padding:`${SPACE[3]}px ${SPACE[4]}px`,borderRadius:RADIUS.lg,
              border:`1px solid ${owned?"#a7f3d0":CC.border}`,
              background:owned?"linear-gradient(135deg,#f0fdf4,#ecfdf5)":CC.surface1,
              display:"flex",flexDirection:"column",gap:SPACE[2],
              boxShadow:SHADOW.sm
            }}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:SPACE[2]}}>
                <div style={{fontWeight:900,color:CC.text,fontSize:14,lineHeight:1.3}}>{it.name}</div>
                {owned?<Badge tone="brand" size="xs">✓ Куплено</Badge>:<Badge tone="gold" size="sm"><Icon.Coin width={11} height={11}/> {it.cost}</Badge>}
              </div>
              <div style={{fontSize:12,color:CC.textDim,lineHeight:1.5}}>{it.desc}</div>
              {!owned&&<Btn
                disabled={!!dis}
                variant={dis?"secondary":"primary"}
                size="sm"
                full
                onClick={()=>{if(it.kind==="unlock")purchaseUnlock(it.id,it.cost,it.name);else if(it.onBuy){if(!spendChessy(it.cost,it.name))return;it.onBuy()}}}
              >
                {it.disabled?"Нужна сыгранная партия":!afford?`Нужно +${it.cost-chessy.balance}`:it.kind==="action"?"Использовать":"Купить"}
              </Btn>}
            </div>;
          })}
        </div>

        <div style={{padding:`${SPACE[3]}px ${SPACE[4]}px`,borderRadius:RADIUS.md,
          background:"linear-gradient(135deg,#fef3c7,#fffbeb)",border:"1px solid #fcd34d"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#92400e",marginBottom:SPACE[1]}}>💡 Как заработать Chessy</div>
          <div style={{fontSize:12,color:"#b45309",lineHeight:1.7}}>
            · Победа против AI: 5–160 (чем сильнее соперник и длиннее партия — тем больше)<br/>
            · Пазл: 2–15 (по рейтингу)<br/>
            · Daily-бонус: 5, 30 (streak 3), 100 (streak 7)<br/>
            · Достижения: 30–400 за вехи
          </div>
        </div>

        {Object.keys(chessy.ach).length>0&&<div style={{marginTop:SPACE[3]}}>
          <div style={{fontSize:12,fontWeight:800,color:CC.textDim,marginBottom:SPACE[2],textTransform:"uppercase" as const,letterSpacing:0.5}}>🏆 Достижения · {Object.keys(chessy.ach).length}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {Object.keys(chessy.ach).map(k=><Badge key={k} tone="neutral" size="sm" style={{padding:"4px 10px"}}>{ACH_LABELS[k]||k}</Badge>)}
          </div>
        </div>}

        {chessyLog.length>0&&<details style={{marginTop:SPACE[3]}}>
          <summary style={{cursor:"pointer",fontSize:12,fontWeight:800,color:CC.textDim,textTransform:"uppercase" as const,letterSpacing:0.5,padding:`${SPACE[2]}px 0`}}>
            📜 История Chessy · last {chessyLog.length}
          </summary>
          <div style={{marginTop:SPACE[2],maxHeight:240,overflowY:"auto",border:`1px solid ${CC.border}`,borderRadius:RADIUS.md}}>
            {chessyLog.map((e,i)=>{
              const ago=Math.max(1,Math.round((Date.now()-e.ts)/60000));
              const agoStr=ago<60?`${ago}м`:ago<1440?`${Math.round(ago/60)}ч`:`${Math.round(ago/1440)}д`;
              return <div key={i} style={{
                display:"flex",alignItems:"center",gap:SPACE[2],
                padding:`${SPACE[1]+2}px ${SPACE[3]}px`,
                borderBottom:i<chessyLog.length-1?`1px solid ${CC.border}`:"none",
                fontSize:12
              }}>
                <span style={{fontWeight:900,color:e.sign>0?CC.brand:CC.danger,minWidth:40,fontFamily:"ui-monospace,monospace"}}>
                  {e.sign>0?"+":"−"}{e.amount}
                </span>
                <span style={{flex:1,color:CC.text}}>{e.reason}</span>
                <span style={{color:CC.textMute,fontSize:11}}>{agoStr}</span>
              </div>;
            })}
          </div>
        </details>}
      </Modal>;
    })()}

    {/* Endgame trainer modal */}
    <Modal open={showEndgames} onClose={()=>sShowEndgames(false)} size="lg"
      title="🏰 Тренировка эндшпилей">
      <div style={{fontSize:13,color:CC.textDim,marginBottom:SPACE[3]}}>
        12 классических позиций от KP–K до KBN–K. Победил = Chessy + разбор от Алексея.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:SPACE[2]}}>
        {ENDGAMES.map((eg,i)=>{
          const gTone:"brand"|"info"=eg.goal==="Win"?"brand":"info";
          return <button key={i} onClick={()=>loadEndgame(eg)}
            className="cc-focus-ring"
            style={{padding:`${SPACE[3]}px ${SPACE[4]}px`,borderRadius:RADIUS.lg,
              border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",
              textAlign:"left",display:"flex",flexDirection:"column",gap:SPACE[1],
              transition:`all ${MOTION.base} ${MOTION.ease}`,
              boxShadow:SHADOW.sm}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
              <div style={{fontWeight:900,color:CC.text,fontSize:14,lineHeight:1.3}}>{eg.name}</div>
              <Badge tone={gTone} size="xs">{eg.goal==="Win"?"Выиграть":"Удержать"} · {eg.side==="w"?"♔":"♚"}</Badge>
            </div>
            <div style={{fontSize:12,color:CC.textDim,lineHeight:1.5}}>{eg.hint.slice(0,110)}{eg.hint.length>110?"…":""}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:SPACE[1]}}>
              <Badge tone="gold" size="xs">+{eg.reward} Chessy</Badge>
              <span style={{fontSize:12,fontWeight:800,color:CC.brand}}>Начать →</span>
            </div>
          </button>;
        })}
      </div>
      <div style={{marginTop:SPACE[3],padding:`${SPACE[2]}px ${SPACE[3]}px`,
        borderRadius:RADIUS.md,background:"#f0fdf4",border:"1px solid #a7f3d0",
        fontSize:12,color:"#065f46"}}>
        💡 Открываются в Coach — спроси Алексея, как играть. Голос включается в шапке Coach'а (🔊).
      </div>
    </Modal>

    {/* First-time welcome tour */}
    {tourStep>=0&&(()=>{
      const slides=[
        {icon:"♞",title:"Добро пожаловать в AEVION CyberChess",body:<>
          <p style={{margin:"0 0 10px"}}>Полноценный шахматный тренажёр с ИИ-коучем, ежедневными задачами и собственной валютой.</p>
          <p style={{margin:0,color:CC.textDim,fontSize:14}}>Ты уже получил <b style={{color:"#b45309"}}>+50 Chessy</b> за регистрацию.</p>
        </>},
        {icon:"💰",title:"Зарабатывай Chessy",body:<>
          <p style={{margin:"0 0 10px"}}>За победы, решённые пазлы, достижения и ежедневный заход. Streak 7 дней — +100.</p>
          <p style={{margin:0,color:CC.textDim,fontSize:14}}>Трать на премиум: разблокировка Master AI, эксклюзивные темы доски, глубокий разбор партии от тренера.</p>
        </>},
        {icon:"🎓",title:"ИИ-тренер Алексей",body:<>
          <p style={{margin:"0 0 10px"}}>Задай любой вопрос по позиции — тренер ответит на основе Stockfish-анализа, без фантазий.</p>
          <p style={{margin:0,color:CC.textDim,fontSize:14}}>Можно <b>включить голос</b> в Coach — ответы будут зачитываться вслух. Этого нет на lichess и chess.com.</p>
        </>},
      ];
      const s=slides[tourStep];const last=tourStep===slides.length-1;
      const finish=()=>{try{localStorage.setItem("aevion_tour_seen_v1","1")}catch{}sTourStep(-1)};
      return <Modal open={tourStep>=0} onClose={finish} size="sm" title={undefined}>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:52,lineHeight:1,marginBottom:10}}>{s.icon}</div>
          <div style={{fontSize:20,fontWeight:900,color:CC.text,marginBottom:12,lineHeight:1.25}}>{s.title}</div>
          <div style={{fontSize:14,color:CC.text,lineHeight:1.6,textAlign:"left"}}>{s.body}</div>
          <div style={{display:"flex",justifyContent:"center",gap:5,margin:"18px 0"}}>
            {slides.map((_,i)=><div key={i} style={{
              width:i===tourStep?22:7,height:7,borderRadius:RADIUS.full,
              background:i===tourStep?CC.brand:CC.surface3,
              transition:`width ${MOTION.base} ${MOTION.ease}`
            }}/>)}
          </div>
          <div style={{display:"flex",gap:SPACE[2]}}>
            <Btn variant="secondary" size="md" full onClick={finish}>Пропустить</Btn>
            <Btn variant="primary" size="md" full onClick={()=>{if(last)finish();else sTourStep(tourStep+1)}}
              style={{flex:2,background:`linear-gradient(135deg,${CC.brand},#10b981)`}}>
              {last?"Поехали! ▶":"Дальше →"}
            </Btn>
          </div>
        </div>
      </Modal>;
    })()}

    {/* Keyboard Shortcuts Help Overlay */}
    <Modal open={showHelp} onClose={()=>sShowHelp(false)} size="md" title="⌨ Горячие клавиши">
      <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[3]}}>Работают во всех вкладках, пока курсор не в поле ввода.</div>
      <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"10px 16px",fontSize:14,alignItems:"center"}}>
        {[
          ["←  / →","Листать ходы назад / вперёд"],
          ["Home / End","К первому / последнему ходу"],
          ["F","Перевернуть доску"],
          ["M","Вкл./выкл. звук"],
          ["N","Новая партия (в Play, до старта)"],
          ["Esc","Сбросить все премувы"],
          ["?","Показать / скрыть эту подсказку"],
          ["ПКМ-drag","Стрелка на доске (Analysis / Coach / после партии)"],
          ["ПКМ клик","Подсветить клетку · Shift=красный, Ctrl=синий"],
        ].map(([k,v])=><React.Fragment key={k}>
          <kbd style={{fontFamily:"ui-monospace, SFMono-Regular, monospace",fontWeight:900,fontSize:12,padding:"4px 10px",borderRadius:RADIUS.sm,background:CC.surface3,border:`1px solid ${CC.border}`,color:CC.text,whiteSpace:"nowrap"}}>{k}</kbd>
          <span style={{color:CC.text}}>{v}</span>
        </React.Fragment>)}
      </div>
    </Modal>

    {/* AI Rival greeting */}
    <Modal open={showRivalGreet&&!!rivalProfile} onClose={()=>sShowRivalGreet(false)} size="sm"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>⚔ {rivalProfile?.name||"AI Rival"}</span>}>
      {rivalProfile&&<div>
        <div style={{display:"flex",alignItems:"center",gap:SPACE[3],marginBottom:SPACE[3]}}>
          <div style={{width:64,height:64,borderRadius:RADIUS.lg,
            background:"linear-gradient(135deg,#1e1b4b,#4c1d95,#7c3aed)",
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:30,color:"#fff",boxShadow:SHADOW.md,flexShrink:0}}>🧠</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:18,fontWeight:900,color:CC.text}}>{rivalProfile.name}</div>
            <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
              <Badge tone="accent" size="xs">⚔ {rivalProfile.rating} ELO</Badge>
              <Badge tone="neutral" size="xs">{rivalSummary(rivalProfile)}</Badge>
            </div>
          </div>
        </div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.accentSoft,border:`1px solid ${CC.accent}`,fontSize:14,color:CC.text,lineHeight:1.55,fontStyle:"italic",marginBottom:SPACE[3]}}>
          «{rivalGreeting(rivalProfile,rat)}»
        </div>
        {rivalProfile.encounters>0&&<div style={{padding:SPACE[2],borderRadius:RADIUS.md,background:CC.surface2,border:`1px solid ${CC.border}`,fontSize:12,color:CC.textDim,marginBottom:SPACE[3]}}>
          <div style={{fontWeight:800,color:CC.text,marginBottom:4}}>📜 Последние встречи</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {rivalProfile.history.slice(0,8).map((h,i)=>{
              const tone:"brand"|"danger"|"neutral"=h.result==="W"?"brand":h.result==="L"?"danger":"neutral";
              return <span key={i} title={`${h.opening||"—"} · ${h.moves} ходов`}><Badge tone={tone} size="xs">{h.result}</Badge></span>;
            })}
          </div>
        </div>}
        <div style={{display:"flex",gap:SPACE[2]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sShowRivalGreet(false)}>Позже</Btn>
          <Btn variant="accent" size="md" full onClick={()=>{
            // Start a Rival match: rating-matched AI
            const targetIdx=rivalProfile.rating<900?1:rivalProfile.rating<1300?2:rivalProfile.rating<1700?3:rivalProfile.rating<2100?4:5;
            const capped=chessy.owned.master_ai?targetIdx:Math.min(targetIdx,4);
            sAiI(capped);sHotseat(false);sRivalMode(true);
            sShowRivalGreet(false);
            setTimeout(()=>newG(),60);
          }}>⚔ Играть</Btn>
        </div>
      </div>}
    </Modal>

    {/* Opening Trainer modal — выбор дебюта */}
    <Modal open={showOpeningTrainer} onClose={()=>sShowOpeningTrainer(false)} size="lg" title="🎓 Opening Trainer">
      <div style={{fontSize:13,color:CC.textDim,marginBottom:SPACE[3]}}>
        Выбери дебют — бот сыграет чёрными, ты ведёшь белыми по скрипту. За безошибочный — <b>+10 Chessy</b>, с ошибками — <b>+5</b>.
      </div>
      <input
        type="text"
        value={openingDrillFilter}
        onChange={e=>sOpeningDrillFilter(e.target.value)}
        placeholder="🔍 Поиск: Сицилианская, Italian, B20..."
        className="cc-focus-ring"
        style={{width:"100%",padding:"8px 12px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:13,marginBottom:SPACE[3]}}
      />
      <div style={{maxHeight:400,overflowY:"auto",border:`1px solid ${CC.border}`,borderRadius:RADIUS.md}}>
        {(()=>{
          const q=openingDrillFilter.trim().toLowerCase();
          const list=(openingsDb||[]).filter(op=>{
            if(!q)return true;
            return op.name.toLowerCase().includes(q)||op.eco.toLowerCase().includes(q);
          }).slice(0,80);
          if(openingsDb.length===0)return <div style={{padding:40,textAlign:"center",color:CC.textDim,fontSize:14}}>База дебютов загружается…</div>;
          if(list.length===0)return <div style={{padding:40,textAlign:"center",color:CC.textDim,fontSize:14}}>Ничего не найдено</div>;
          return list.map((op,i)=>{
            const sans=(typeof op.moves==="string"?op.moves.split(/\s+/):[]).filter(Boolean);
            if(sans.length<2)return null;
            return <button key={op.eco+i}
              className="cc-focus-ring"
              onClick={()=>{
                // Start drill
                const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);
                sLm(null);sSel(null);sVm(new Set());sOver(null);sPms([]);sPmSel(null);
                sPCol("w");sFlip(false);sOn(true);sSetup(false);sTab("play");
                sOpeningDrill({eco:op.eco,name:op.name,moves:sans,ply:0,mistakes:0});
                sShowOpeningTrainer(false);
                showToast(`🎓 ${op.eco} · ${op.name} — ходи!`,"info");
              }}
              style={{width:"100%",padding:`${SPACE[3]}px ${SPACE[4]}px`,border:"none",
                borderBottom:i<list.length-1?`1px solid ${CC.border}`:"none",
                background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:SPACE[3]}}>
              <Badge tone="accent" size="sm">{op.eco}</Badge>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:CC.text,marginBottom:2}}>{op.name}</div>
                <div style={{fontSize:11,color:CC.textMute,fontFamily:"ui-monospace, monospace"}}>
                  {sans.slice(0,6).join(" ")}{sans.length>6?" …":""}
                  <span style={{marginLeft:6,color:CC.textDim}}>· {sans.length} полуходов</span>
                </div>
              </div>
              <span style={{fontSize:12,fontWeight:800,color:CC.brand}}>▶</span>
            </button>;
          });
        })()}
      </div>
    </Modal>

    {/* Game DNA */}
    <Modal open={showGameDna} onClose={()=>sShowGameDna(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>🧬 Твой Game DNA <Badge tone="info" size="sm">{gameDna.total} партий</Badge></span>}>
      {savedGames.length===0?<div style={{padding:SPACE[6],textAlign:"center",color:CC.textDim,fontSize:14}}>
        <div style={{fontSize:40,marginBottom:SPACE[3]}}>🧬</div>
        <div style={{fontWeight:800,marginBottom:SPACE[2]}}>Пока пусто</div>
        <div>Сыграй 5–10 партий — AEVION построит твою персональную диагностику: лучший/худший дебют, любимое время, слабая фаза, тренды.</div>
      </div>:<div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>

        {/* Top stats */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:SPACE[2]}}>
          <Card padding={SPACE[3]} tone="surface2">
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Винрейт</div>
            <div style={{fontSize:28,fontWeight:900,color:gameDna.winPct>=55?CC.brand:gameDna.winPct>=40?CC.info:CC.danger,lineHeight:1.1,marginTop:2}}>{gameDna.winPct}%</div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>{gameDna.wins}W {gameDna.losses}L {gameDna.draws}D</div>
          </Card>
          <Card padding={SPACE[3]} tone="surface2">
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Streak</div>
            <div style={{fontSize:28,fontWeight:900,
              color:gameDna.currentStreak.type==="W"?CC.brand:gameDna.currentStreak.type==="L"?CC.danger:CC.textDim,
              lineHeight:1.1,marginTop:2}}>{gameDna.currentStreak.count>0?`${gameDna.currentStreak.count}${gameDna.currentStreak.type}`:"—"}</div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>
              {gameDna.currentStreak.type==="W"?"побед подряд":gameDna.currentStreak.type==="L"?"поражений":gameDna.currentStreak.type==="D"?"ничьих":"нейтрально"}
            </div>
          </Card>
          <Card padding={SPACE[3]} tone="surface2">
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Тренд 10</div>
            <div style={{fontSize:28,fontWeight:900,
              color:gameDna.recentTrend==="up"?CC.brand:gameDna.recentTrend==="down"?CC.danger:CC.textDim,
              lineHeight:1.1,marginTop:2}}>
              {gameDna.recentTrend==="up"?"↑":gameDna.recentTrend==="down"?"↓":gameDna.recentTrend==="flat"?"≈":"—"}
              {gameDna.recentTrend!=="insufficient"&&<span style={{fontSize:16}}>{gameDna.recentWinPctDelta>0?"+":""}{gameDna.recentWinPctDelta}%</span>}
            </div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>
              {gameDna.recentTrend==="up"?"рост":gameDna.recentTrend==="down"?"спад":gameDna.recentTrend==="flat"?"стабильно":"мало партий"}
            </div>
          </Card>
          <Card padding={SPACE[3]} tone="surface2">
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Цвет</div>
            <div style={{fontSize:28,lineHeight:1.1,marginTop:2}}>
              {gameDna.preferredColor==="w"?"♔":gameDna.preferredColor==="b"?"♚":"⚖"}
            </div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>
              W {gameDna.whiteWinPct}% · B {gameDna.blackWinPct}%
            </div>
          </Card>
        </div>

        {/* Insights list */}
        <Card padding={SPACE[3]} tone="surface1">
          <SectionHeader title="🔍 ИНСАЙТЫ" hint={`${gameDna.insights.length} персональных`}/>
          <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
            {gameDna.insights.map((ins,i)=><div key={i} style={{padding:`${SPACE[2]}px ${SPACE[3]}px`,background:CC.surface2,borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:13,color:CC.text,lineHeight:1.5}}>
              {ins}
            </div>)}
          </div>
        </Card>

        {/* Openings breakdown */}
        {gameDna.bestOpening&&<div style={{display:"grid",gridTemplateColumns:gameDna.worstOpening?"1fr 1fr":"1fr",gap:SPACE[2]}}>
          <Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)",borderColor:"#a7f3d0"}}>
            <SectionHeader title="🟢 СИЛЬНЫЙ ДЕБЮТ"/>
            <div style={{fontSize:14,fontWeight:800,color:CC.text,marginTop:SPACE[1]}}>{gameDna.bestOpening.opening}</div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:SPACE[1]}}>
              <Badge tone="brand" size="xs">{gameDna.bestOpening.winPct}% побед</Badge>
              &nbsp;в {gameDna.bestOpening.total} партиях
            </div>
          </Card>
          {gameDna.worstOpening&&gameDna.worstOpening.opening!==gameDna.bestOpening.opening&&
            <Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#fef2f2,#fff1f2)",borderColor:"#fca5a5"}}>
              <SectionHeader title="🔴 СЛАБЫЙ ДЕБЮТ"/>
              <div style={{fontSize:14,fontWeight:800,color:CC.text,marginTop:SPACE[1]}}>{gameDna.worstOpening.opening}</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:SPACE[1]}}>
                <Badge tone="danger" size="xs">{gameDna.worstOpening.winPct}% побед</Badge>
                &nbsp;в {gameDna.worstOpening.total} партиях
              </div>
            </Card>}
        </div>}

        {/* Timing & length */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:SPACE[2]}}>
          {gameDna.bestHour!==null&&<Card padding={SPACE[3]} tone="surface1">
            <SectionHeader title="⏰ ЛУЧШЕЕ ВРЕМЯ"/>
            <div style={{fontSize:20,fontWeight:900,color:CC.text,marginTop:SPACE[1]}}>
              {gameDna.bestHour}:00–{(gameDna.bestHour+1)%24}:00
            </div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:SPACE[1]}}>
              {gameDna.bestHourWinPct}% побед в этот час
            </div>
          </Card>}
          <Card padding={SPACE[3]} tone="surface1">
            <SectionHeader title="⚡ ДЛИНА ПАРТИИ"/>
            <div style={{fontSize:13,color:CC.text,marginTop:SPACE[1]}}>
              Победы: <b>{Math.round(gameDna.avgLengthWin/2)}</b> ходов<br/>
              Поражения: <b>{Math.round(gameDna.avgLengthLoss/2)}</b> ходов
            </div>
          </Card>
          <Card padding={SPACE[3]} tone="surface1">
            <SectionHeader title="📊 РЕЙТИНГ"/>
            <div style={{fontSize:20,fontWeight:900,color:gameDna.ratingGrowth>=0?CC.brand:CC.danger,marginTop:SPACE[1]}}>
              {gameDna.ratingGrowth>=0?"+":""}{gameDna.ratingGrowth}
            </div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:SPACE[1]}}>
              за {gameDna.total} партий
            </div>
          </Card>
        </div>

        <div style={{display:"flex",gap:SPACE[2]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sShowGameDna(false)}>Закрыть</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{sShowGameDna(false);sGamesModalOpen(true)}}>📜 Все партии</Btn>
        </div>
      </div>}
    </Modal>

    {/* Puzzle Expansion instructions */}
    <Modal open={showPuzzleExpand} onClose={()=>sShowPuzzleExpand(false)} size="md" title="🧩 Расширить базу пазлов до 20 000">
      <div style={{fontSize:13,color:CC.text,lineHeight:1.6}}>
        <p style={{margin:`0 0 ${SPACE[3]}px`}}>
          Lichess выложил <b>~4 миллиона</b> пазлов под CC0. Мы можем импортировать лучшие 20 000 (~5 MB) с стратифицированной выборкой по рейтингу и темам — <b>~5 минут работы</b>, делается один раз.
        </p>
        <ol style={{margin:0,paddingLeft:20,fontSize:13,lineHeight:1.8}}>
          <li>
            Скачай CSV:&nbsp;
            <a href="https://database.lichess.org/#puzzles" target="_blank" rel="noreferrer" style={{color:CC.brand,fontWeight:700}}>
              database.lichess.org/#puzzles
            </a>
            &nbsp;(~300 МБ .zst)
          </li>
          <li>Распакуй (7-Zip на Windows или <code style={{padding:"1px 5px",background:CC.surface3,borderRadius:4,fontSize:12}}>zstd -d</code>)</li>
          <li>Положи <code style={{padding:"1px 5px",background:CC.surface3,borderRadius:4,fontSize:12}}>lichess_db_puzzle.csv</code> в корень проекта <code style={{padding:"1px 5px",background:CC.surface3,borderRadius:4,fontSize:12}}>aevion-core/</code></li>
          <li>
            В PowerShell из корня:
            <div style={{marginTop:SPACE[2],padding:SPACE[2],background:"#0f172a",color:"#d1d5db",borderRadius:RADIUS.sm,fontSize:11,fontFamily:"ui-monospace, monospace",overflowX:"auto",whiteSpace:"nowrap"}}>
              node frontend/scripts/import-lichess-puzzles.mjs --in ./lichess_db_puzzle.csv --out ./frontend/public/puzzles.json --limit 20000 --min-rating 600 --max-rating 2600 --min-plays 100 --min-popularity 80
            </div>
          </li>
          <li>Обнови страницу — <code style={{padding:"1px 5px",background:CC.surface3,borderRadius:4,fontSize:12}}>PUZZLES.length</code> станет 20 000.</li>
        </ol>
        <div style={{marginTop:SPACE[3],padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,fontSize:12,color:"#065f46"}}>
          💡 Скрипт применяет стартовый ход соперника к FEN, так что загружаемая позиция уже «студент ходит». Фильтр по popularity/plays убирает шумные пазлы.
        </div>
        <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[4]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sShowPuzzleExpand(false)}>Закрыть</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{
            const cmd="node frontend/scripts/import-lichess-puzzles.mjs --in ./lichess_db_puzzle.csv --out ./frontend/public/puzzles.json --limit 20000 --min-rating 600 --max-rating 2600 --min-plays 100 --min-popularity 80";
            try{navigator.clipboard.writeText(cmd).then(()=>showToast("✓ Команда скопирована","success")).catch(()=>showToast("Не получилось","error"))}catch{showToast("Clipboard недоступен","error")}
          }}>📋 Копировать команду</Btn>
        </div>
      </div>
    </Modal>

    {/* ═══ Tournament Mode (killer #6) ═══ */}
    <Modal open={showTournament} onClose={()=>sShowTournament(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>🏆 Tournament Mode <Badge tone="gold" size="sm">knockout</Badge></span>}>
      {(()=>{
        const t=tournament;
        if(!t){
          return <div>
            <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,marginBottom:SPACE[3],fontSize:13,color:"#065f46",lineHeight:1.5}}>
              <b>8 ИИ-соперников · 3 раунда · бесконечная драматургия.</b><br/>
              Knockout: 1/4 финала → полуфинал → финал. Параллельные матчи симулируются по Elo. Каждый бот — со своим стилем и репликой. Победитель получает <b>200 Chessy</b> + диплом. {trophies.length>0&&<>В копилке: <b>{trophies.length} трофеев</b>.</>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:SPACE[2],marginBottom:SPACE[4]}}>
              {[
                {p:1,r:200,c:CC.gold,t:"🏆 Чемпион"},
                {p:2,r:100,c:"#9ca3af",t:"🥈 Финал"},
                {p:4,r:50,c:"#fbbf24",t:"🥉 Полуфинал"},
                {p:8,r:20,c:CC.textDim,t:"⚔ 1/4 финала"},
              ].map((x,i)=><div key={i} style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.surface1,border:`1px solid ${CC.border}`,textAlign:"center"}}>
                <div style={{fontSize:14,fontWeight:900,color:x.c}}>{x.t}</div>
                <div style={{fontSize:18,fontWeight:900,color:CC.text,marginTop:2}}>{x.r}</div>
                <div style={{fontSize:10,color:CC.textDim}}>Chessy</div>
              </div>)}
            </div>
            {trophies.length>0&&<div style={{marginBottom:SPACE[3]}}>
              <SectionHeader title="ТРОФЕИ"/>
              <div style={{display:"flex",gap:SPACE[2],overflowX:"auto",paddingBottom:4,marginTop:SPACE[2]}}>
                {trophies.slice(0,10).map((tr,i)=>{
                  const vMeta=tr.variant?VARIANTS.find(v=>v.id===tr.variant):null;
                  return <div key={i} style={{minWidth:120,padding:SPACE[2],borderRadius:RADIUS.md,background:tr.place===1?"linear-gradient(135deg,#fef3c7,#fde68a)":CC.surface1,border:`1px solid ${tr.place===1?"#fcd34d":CC.border}`}}>
                    <div style={{fontSize:24,textAlign:"center"}}>{tr.place===1?"🏆":tr.place===2?"🥈":tr.place===4?"🥉":"⚔"}</div>
                    <div style={{fontSize:11,fontWeight:800,color:CC.text,textAlign:"center"}}>{tr.place===1?"Чемпион":tr.place===2?"Финалист":tr.place===4?"Полуфинал":"1/4"}</div>
                    {vMeta&&vMeta.id!=="standard"&&<div style={{fontSize:10,fontWeight:700,color:"#9a3412",textAlign:"center",marginTop:2}}>{vMeta.emoji} {vMeta.name}</div>}
                    <div style={{fontSize:10,color:CC.textDim,textAlign:"center",marginTop:2}}>{new Date(tr.ts).toLocaleDateString("ru-RU")}</div>
                  </div>;
                })}
              </div>
            </div>}
            {/* Variant selector for tournament format */}
            <div style={{marginBottom:SPACE[3]}}>
              <SectionHeader title="ФОРМАТ ТУРНИРА"/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:SPACE[2],marginTop:SPACE[2]}}>
                {VARIANTS.map(v=>{
                  const sel=tournamentVariantPick===v.id;
                  return <button key={v.id} onClick={()=>sTournamentVariantPick(v.id)} className="cc-focus-ring"
                    style={{padding:SPACE[2],borderRadius:RADIUS.md,
                      background:sel?"linear-gradient(135deg,#fef3c7,#fde68a)":CC.surface1,
                      border:sel?`2px solid ${CC.gold}`:`1px solid ${CC.border}`,
                      cursor:"pointer",textAlign:"left",
                      transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                      <span style={{fontSize:18}}>{v.emoji}</span>
                      <span style={{fontSize:12,fontWeight:900,color:CC.text}}>{v.name}</span>
                    </div>
                    <div style={{fontSize:10,color:CC.textDim,lineHeight:1.3}}>{v.shortDesc}</div>
                  </button>;
                })}
              </div>
              <div style={{marginTop:SPACE[2],fontSize:11,color:CC.textDim,fontStyle:"italic"}}>
                Все 7 партий турнира пройдут в выбранном режиме.
              </div>
            </div>
            <Btn variant="primary" size="lg" full onClick={()=>{
              const fresh=createTournament(rat,tournamentVariantPick);
              const resolved=resolveBotMatches(fresh);
              sTournament(resolved);
              const formatLabel=tournamentVariantPick==="standard"?"":` (${VARIANTS.find(v=>v.id===tournamentVariantPick)?.name})`;
              showToast(`🎉 Турнир запущен${formatLabel}! Тебе светит первый матч.`,"success");
            }}>🚀 Старт турнира {tournamentVariantPick!=="standard"&&<Badge tone="gold" size="xs">{VARIANTS.find(v=>v.id===tournamentVariantPick)?.name}</Badge>}</Btn>
          </div>;
        }
        const fieldById=new Map(t.field.map(p=>[p.id,p]));
        const nm=(id:string)=>id==="?"?"?":id==="you"?"Ты":(fieldById.get(id)?.name||id);
        const flag=(id:string)=>id==="?"?"":id==="you"?"🇰🇿":(fieldById.get(id)?.flag||"");
        const elo=(id:string)=>id==="?"?0:id==="you"?t.playerElo:(fieldById.get(id)?.elo||0);
        const renderMatch=(m:typeof t.bracket.qf[0],idx:number)=>{
          const isPlayerMatch=m.needsPlayer;
          const winner=m.winner;
          const isLoss=winner&&winner!=="you"&&isPlayerMatch;
          return <div key={idx} style={{
            padding:SPACE[2],borderRadius:RADIUS.md,
            background:isPlayerMatch?(winner?(winner==="you"?"#ecfdf5":"#fef2f2"):"linear-gradient(135deg,#fef3c7,#fde68a)"):CC.surface1,
            border:isPlayerMatch?(winner?(winner==="you"?`1px solid ${CC.brand}`:"1px solid #fca5a5"):"2px solid #fcd34d"):`1px solid ${CC.border}`,
            fontSize:12,marginBottom:6
          }}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:winner==="you"||(winner&&winner===m.a)?900:600,color:winner&&winner===m.a?CC.text:winner?CC.textDim:CC.text,textDecoration:winner&&winner!==m.a&&!isLoss?"line-through":"none"}}>
              <span style={{fontSize:14,minWidth:18}}>{flag(m.a)}</span>
              <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nm(m.a)}</span>
              <span style={{fontSize:10,color:CC.textDim}}>{elo(m.a)||""}</span>
              {winner===m.a&&<span style={{color:CC.brand,fontWeight:900,fontSize:11}}>1</span>}
              {winner&&winner===m.b&&<span style={{color:CC.textDim,fontWeight:600,fontSize:11}}>0</span>}
            </div>
            <div style={{fontSize:10,color:CC.textDim,textAlign:"center",margin:"2px 0"}}>vs</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontWeight:winner&&winner===m.b?900:600,color:winner&&winner===m.b?CC.text:winner?CC.textDim:CC.text,textDecoration:winner&&winner!==m.b&&winner!=="?"?"line-through":"none"}}>
              <span style={{fontSize:14,minWidth:18}}>{flag(m.b)}</span>
              <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{nm(m.b)}</span>
              <span style={{fontSize:10,color:CC.textDim}}>{elo(m.b)||""}</span>
              {winner===m.b&&<span style={{color:CC.brand,fontWeight:900,fontSize:11}}>1</span>}
              {winner&&winner===m.a&&<span style={{color:CC.textDim,fontWeight:600,fontSize:11}}>0</span>}
            </div>
            {isPlayerMatch&&!winner&&<div style={{textAlign:"center",fontSize:10,fontWeight:900,color:"#92400e",marginTop:4,letterSpacing:1}}>ТВОЙ МАТЧ →</div>}
          </div>;
        };
        const place=t.currentRound==="done"?finalPlace(t):null;
        const nextMatch=nextPlayerMatch(t);
        const nextOpp=nextMatch?(nextMatch.a==="you"?fieldById.get(nextMatch.b):fieldById.get(nextMatch.a)):null;
        return <div>
          {/* Active variant badge */}
          {t.variant&&t.variant!=="standard"&&<div style={{padding:"6px 10px",borderRadius:RADIUS.sm,background:"linear-gradient(135deg,#fef3c7,#fed7aa)",border:"1px solid #fb923c",fontSize:12,color:"#9a3412",marginBottom:SPACE[2],display:"inline-flex",alignItems:"center",gap:6}}>
            <span style={{fontSize:16}}>{VARIANTS.find(v=>v.id===t.variant)?.emoji}</span>
            <span style={{fontWeight:900}}>Формат: {VARIANTS.find(v=>v.id===t.variant)?.name}</span>
          </div>}
          {place&&<div style={{padding:SPACE[4],borderRadius:RADIUS.md,background:place===1?"linear-gradient(135deg,#fef3c7,#fde68a,#fcd34d)":CC.brandSoft,border:`2px solid ${place===1?"#f59e0b":CC.brand}`,marginBottom:SPACE[3],textAlign:"center"}}>
            <div style={{fontSize:54,lineHeight:1}}>{place===1?"🏆":place===2?"🥈":place===4?"🥉":"⚔"}</div>
            <div style={{fontSize:22,fontWeight:900,color:place===1?"#78350f":CC.text,marginTop:SPACE[2]}}>{place===1?"ЧЕМПИОН!":place===2?"Финалист":place===4?"3-4 место":"1/4 финала"}</div>
            <div style={{fontSize:12,color:CC.textDim,marginTop:4}}>+{placeReward(place)} Chessy {defeatedByPlayer(t).length>0&&`· обыграл ${defeatedByPlayer(t).join(", ")}`}</div>
          </div>}
          {nextOpp&&<div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#1e1b4b,#4c1d95)",color:"#fff",marginBottom:SPACE[3]}}>
            <div style={{fontSize:11,fontWeight:800,opacity:0.85,letterSpacing:1,textTransform:"uppercase" as const}}>Следующий матч · {t.currentRound==="qf"?"1/4 финала":t.currentRound==="sf"?"полуфинал":"ФИНАЛ"}</div>
            <div style={{display:"flex",alignItems:"center",gap:SPACE[3],marginTop:SPACE[2]}}>
              <div style={{fontSize:34}}>{nextOpp.flag}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:18,fontWeight:900}}>{nextOpp.name}</div>
                <div style={{fontSize:12,opacity:0.85}}>{nextOpp.elo} · {nextOpp.style}</div>
                <div style={{fontSize:11,opacity:0.7,fontStyle:"italic",marginTop:2}}>"{nextOpp.motto}"</div>
              </div>
              <Btn variant="gold" size="md" onClick={()=>startTournamentMatch(nextOpp)}>▶ Играть</Btn>
            </div>
          </div>}
          <div className="cc-no-scrollbar" style={{display:"grid",gridTemplateColumns:"minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)",gap:SPACE[3],overflowX:"auto",paddingBottom:4}}>
            <div>
              <div style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1,marginBottom:SPACE[2]}}>1/4 ФИНАЛА</div>
              {t.bracket.qf.map(renderMatch)}
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1,marginBottom:SPACE[2]}}>ПОЛУФИНАЛ</div>
              <div style={{paddingTop:34}}>{t.bracket.sf.map(renderMatch)}</div>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1,marginBottom:SPACE[2]}}>ФИНАЛ</div>
              <div style={{paddingTop:80}}>{renderMatch(t.bracket.final,0)}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[4]}}>
            <Btn variant="ghost" size="md" onClick={()=>{
              if(confirm("Сбросить текущий турнир и начать новый?")){
                sTournament(null);tournamentLearnedRef.current=null;
                showToast("Турнир сброшен","info");
              }
            }}>↻ Новый турнир</Btn>
            <Btn variant="secondary" size="md" full onClick={()=>sShowTournament(false)}>Закрыть</Btn>
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Manual Asymmetric Army Builder ═══ */}
    <Modal open={showArmyBuilder} onClose={()=>sShowArmyBuilder(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>⚔ Army Builder <Badge tone="info" size="sm">бюджет 39pt × 2</Badge></span>}>
      {(()=>{
        const PV:Record<string,number>={Q:9,R:5,B:3,N:3};
        const wBudget=builderWhite.reduce((a,p)=>a+PV[p],0);
        const bBudget=builderBlack.reduce((a,p)=>a+PV[p],0);
        const renderArmy=(slots:("Q"|"R"|"B"|"N")[],setSlots:(s:("Q"|"R"|"B"|"N")[])=>void,label:string,budget:number,color:string)=>{
          const isOk=budget===39&&slots.length===7;
          return <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.surface1,border:`2px solid ${isOk?CC.brand:CC.danger}`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:SPACE[2]}}>
              <div style={{fontSize:14,fontWeight:900,color}}>{label}</div>
              <div style={{fontSize:13,fontWeight:900,color:isOk?CC.brand:CC.danger}}>
                {budget}/39pt {isOk?"✓":""}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",minHeight:50,padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface2,border:`1px dashed ${CC.border}`,marginBottom:SPACE[2]}}>
              {slots.length===0?<span style={{fontSize:11,color:CC.textDim,fontStyle:"italic"}}>Нажимай фигуры ↓ чтобы добавить (нужно ровно 7 слотов)</span>:slots.map((p,i)=><button key={i} onClick={()=>setSlots(slots.filter((_,j)=>j!==i))}
                style={{padding:"4px 10px",borderRadius:RADIUS.full,background:color===CC.text?"#1f2937":"#fff",color:color===CC.text?"#fff":"#1f2937",border:`1px solid ${CC.border}`,cursor:"pointer",fontSize:14,fontWeight:900}}>
                {p} ({PV[p]})
              </button>)}
            </div>
            <div style={{display:"flex",gap:SPACE[1]}}>
              {(["Q","R","B","N"] as const).map(p=>{
                const tooMany=slots.length>=7;
                const tooExpensive=budget+PV[p]>39;
                const dis=tooMany||tooExpensive;
                return <button key={p} onClick={()=>setSlots([...slots,p])} disabled={dis}
                  style={{flex:1,padding:"8px 4px",borderRadius:RADIUS.sm,
                    background:dis?CC.surface3:CC.surface1,border:`1px solid ${CC.border}`,
                    cursor:dis?"not-allowed":"pointer",opacity:dis?0.4:1,
                    fontSize:13,fontWeight:900,color:CC.text}}>
                  +{p} <span style={{fontSize:10,color:CC.textDim}}>({PV[p]})</span>
                </button>;
              })}
              <button onClick={()=>setSlots([])}
                style={{padding:"8px 12px",borderRadius:RADIUS.sm,background:CC.surface3,border:`1px solid ${CC.border}`,cursor:"pointer",fontSize:11,color:CC.danger}}>
                ✕
              </button>
            </div>
          </div>;
        };
        const builtOk=wBudget===39&&bBudget===39&&builderWhite.length===7&&builderBlack.length===7;
        return <div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#ecfeff,#cffafe)",border:"1px solid #67e8f9",marginBottom:SPACE[3],fontSize:13,color:"#155e75",lineHeight:1.5}}>
            <b>Сконструируй обе армии вручную.</b> Каждая ровно 7 фигур (король+пешки фиксированы), бюджет 39 очков (Q=9, R=5, B=N=3). Создай асимметрию — например 3 ферзя vs 6 ладей.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2],marginBottom:SPACE[3]}}>
            {renderArmy(builderWhite,sBuilderWhite,"⚪ Белые",wBudget,CC.text)}
            {renderArmy(builderBlack,sBuilderBlack,"⚫ Чёрные",bBudget,CC.text)}
          </div>
          <SectionHeader title="ПРЕСЕТЫ"/>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:SPACE[1],marginTop:SPACE[2],marginBottom:SPACE[3]}}>
            {ARMY_PRESETS.map((p,i)=><div key={i} style={{display:"flex",flexDirection:"column",gap:4,padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface1,border:`1px solid ${CC.border}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:18}}>{p.emoji}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:900,color:CC.text}}>{p.name}</div>
                  <div style={{fontSize:10,color:CC.textDim}}>{p.desc}</div>
                </div>
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>sBuilderWhite([...p.slots])}
                  style={{flex:1,padding:"3px 6px",borderRadius:RADIUS.sm,background:CC.surface2,border:`1px solid ${CC.border}`,cursor:"pointer",fontSize:10,color:CC.text}}>← W</button>
                <button onClick={()=>sBuilderBlack([...p.slots])}
                  style={{flex:1,padding:"3px 6px",borderRadius:RADIUS.sm,background:CC.surface2,border:`1px solid ${CC.border}`,cursor:"pointer",fontSize:10,color:CC.text}}>B →</button>
              </div>
            </div>)}
          </div>
          <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[3]}}>
            <Btn variant="ghost" size="md" onClick={()=>{
              sBuilderWhite([]);sBuilderBlack([]);sManualArmyFen("");
            }}>Сбросить</Btn>
            <Btn variant="ghost" size="md" onClick={()=>{
              // Random both
              const w=["R","R","B","B","N","N","Q"] as ("Q"|"R"|"B"|"N")[];
              for(let i=w.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[w[i],w[j]]=[w[j],w[i]]}
              sBuilderWhite(w);
              const b=["R","R","B","B","N","N","Q"] as ("Q"|"R"|"B"|"N")[];
              for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}
              sBuilderBlack(b);
            }}>🎲 Рандом</Btn>
            <Btn variant="primary" size="md" full disabled={!builtOk} onClick={()=>{
              const built=buildArmyFen(builderWhite,builderBlack);
              if(!built){showToast("Армии должны иметь ровно 7 фигур по 39pt каждая","error");return}
              sManualArmyFen(built.fen);
              sVariant("asymmetric");
              sShowArmyBuilder(false);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sTab("play");
              setTimeout(()=>newG(),50);
              showToast(`⚔ Партия запущена с твоей асимметрией`,"success");
            }}>▶ Запустить с этими армиями</Btn>
          </div>
          {!builtOk&&<div style={{marginTop:SPACE[2],fontSize:11,color:CC.danger,textAlign:"center"}}>
            Каждая армия должна быть ровно 7 фигур и 39 очков. Сейчас: ⚪ {builderWhite.length} фигур / {wBudget}pt, ⚫ {builderBlack.length} фигур / {bBudget}pt.
          </div>}
        </div>;
      })()}
    </Modal>

    {/* ═══ Chess Variants (Fischer 960 · Asymmetric · Twin Kings · Diceblade · Reinforcement) ═══ */}
    <Modal open={showVariants} onClose={()=>sShowVariants(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>🎲 Chess Variants <Badge tone="gold" size="sm">{VARIANTS.length} режимов</Badge></span>}>
      <div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fef3c7,#fed7aa)",border:"1px solid #fb923c",marginBottom:SPACE[3],fontSize:13,color:"#9a3412",lineHeight:1.5}}>
          <b>Шахматные вариации без теории.</b><br/>
          Выбери режим — следующая партия начнётся с его правилами. Текущий: <b>{VARIANTS.find(v=>v.id===variant)?.name||variant}</b>.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2]}}>
          {VARIANTS.map(v=>{
            const isActive=variant===v.id;
            const isDaily=dailyVariantInfo?.variant===v.id&&!dailyVariantInfo.played;
            const tagColor=v.tag==="Theory-free"?CC.brand:v.tag==="Asymmetric"?CC.accent:v.tag==="Chaos"?CC.danger:CC.textDim;
            return <button key={v.id} onClick={()=>{
              sVariant(v.id);sShowVariants(false);
              if(v.id!=="standard")showToast(`🎲 Режим: ${v.name}. Запусти новую партию.`,"info");
              else showToast(`Стандартный режим включён`,"info");
            }} className="cc-focus-ring"
              style={{textAlign:"left",padding:SPACE[3],borderRadius:RADIUS.md,
                background:isActive?"linear-gradient(135deg,#fef3c7,#fde68a)":CC.surface1,
                border:isActive?`2px solid ${CC.gold}`:`1px solid ${CC.border}`,
                color:CC.text,cursor:"pointer",transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[1]}}>
                <div style={{fontSize:28}}>{v.emoji}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:900,display:"flex",alignItems:"center",gap:6}}>
                    {v.name}
                    {isDaily&&<span title="Daily Challenge — +50 Chessy за победу" style={{fontSize:10,fontWeight:900,color:"#fff",background:"linear-gradient(90deg,#7c3aed,#a78bfa)",padding:"1px 6px",borderRadius:RADIUS.full}}>⭐ DAILY +50</span>}
                  </div>
                  <div style={{fontSize:11,color:CC.textDim}}>{v.shortDesc}</div>
                </div>
                {isActive&&<Badge tone="gold" size="xs">active</Badge>}
              </div>
              <div style={{fontSize:11,color:CC.text,lineHeight:1.5,marginTop:SPACE[1],marginBottom:SPACE[2]}}>{v.longDesc}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:800,color:tagColor,background:`${tagColor}1a`,padding:"2px 6px",borderRadius:RADIUS.full}}>{v.tag}</span>
                {v.notes?.map((n,i)=><span key={i} style={{fontSize:10,color:CC.textDim,fontStyle:"italic"}}>· {n}</span>)}
              </div>
              {(()=>{
                const vs=variantStats[v.id]||{w:0,l:0,d:0};
                const total=vs.w+vs.l+vs.d;
                if(total===0)return null;
                const wr=Math.round(vs.w/total*100);
                return <div style={{marginTop:SPACE[2],display:"flex",gap:8,fontSize:10,color:CC.textDim,alignItems:"center"}}>
                  <span><b style={{color:CC.brand}}>{vs.w}W</b></span>
                  <span><b style={{color:CC.danger}}>{vs.l}L</b></span>
                  <span>{vs.d}D</span>
                  <span style={{color:wr>=50?CC.brand:CC.danger,fontWeight:700}}>· {wr}% WR</span>
                </div>;
              })()}
            </button>;
          })}
        </div>
        {variant==="asymmetric"&&<div style={{marginTop:SPACE[3],padding:SPACE[2],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#ecfeff,#cffafe)",border:"1px solid #67e8f9"}}>
          <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
            <span style={{fontSize:18}}>🛠</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:900,color:"#155e75"}}>Хочешь сам собрать армии?</div>
              <div style={{fontSize:11,color:CC.textDim}}>Manual Builder — выбираешь обе стороны</div>
            </div>
            <Btn variant="primary" size="sm" onClick={()=>{sShowVariants(false);setTimeout(()=>sShowArmyBuilder(true),100)}}>Открыть</Btn>
          </div>
        </div>}
        <div style={{marginTop:SPACE[3],display:"flex",gap:SPACE[2]}}>
          <Btn variant="secondary" size="md" onClick={()=>{sShowVariants(false);setTimeout(()=>sShowVariantStats(true),100)}}>📊 Статы</Btn>
          <Btn variant="secondary" size="md" full onClick={()=>sShowVariants(false)}>Закрыть</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{
            sShowVariants(false);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sTab("play");
            if(variant==="asymmetric")sManualArmyFen("");
            setTimeout(()=>newG(),50);
          }}>▶ Сыграть</Btn>
        </div>
        <div style={{marginTop:SPACE[3],fontSize:11,color:CC.textDim,textAlign:"center",lineHeight:1.5}}>
          Variants работают с любым AI level и любым timing.
        </div>
      </div>
    </Modal>

    {/* ═══ Variant Stats Dashboard ═══ */}
    <Modal open={showVariantStats} onClose={()=>sShowVariantStats(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>📊 Variant Stats <Badge tone="info" size="sm">{totalVariantGames(variantStats)} партий</Badge></span>}>
      {(()=>{
        const total=totalVariantGames(variantStats);
        const fav=favoriteVariant(variantStats);
        const bestWr=bestWinrateVariant(variantStats);
        const favMeta=fav?VARIANTS.find(v=>v.id===fav):null;
        const bwMeta=bestWr?VARIANTS.find(v=>v.id===bestWr.variant):null;
        return <div>
          {total===0?(
            <div style={{padding:`${SPACE[5]}px ${SPACE[4]}px`,textAlign:"center"}}>
              <div style={{fontSize:64,lineHeight:1,marginBottom:SPACE[3],animation:"pop 0.5s ease-out"}}>📊</div>
              <div style={{fontSize:16,fontWeight:900,color:CC.text,marginBottom:SPACE[2]}}>Пока пусто</div>
              <div style={{fontSize:13,color:CC.textDim,marginBottom:SPACE[4],lineHeight:1.5,maxWidth:400,margin:"0 auto"}}>
                Сыграй несколько партий в любом из 12 режимов — статистика появится здесь. Начни с любимого варианта!
              </div>
              <div style={{display:"flex",gap:SPACE[2],justifyContent:"center",flexWrap:"wrap",marginTop:SPACE[3]}}>
                <Btn variant="primary" size="md" onClick={()=>{
                  sShowVariantStats(false);setTimeout(()=>sShowVariants(true),100);
                }}>🎲 Выбрать режим</Btn>
                <Btn variant="secondary" size="md" onClick={()=>{
                  const r=randomVariant();
                  sVariant(r);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sTab("play");
                  if(r==="asymmetric")sManualArmyFen("");
                  sShowVariantStats(false);
                  setTimeout(()=>newG(),50);
                  showToast(`🎰 ${VARIANTS.find(v=>v.id===r)?.name}`,"success");
                }}>🎰 Surprise Me</Btn>
              </div>
            </div>
          ):(<>
            {/* Top stats */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:SPACE[2],marginBottom:SPACE[3]}}>
              <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,textAlign:"center"}}>
                <div style={{fontSize:10,color:CC.brand,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Всего партий</div>
                <div style={{fontSize:32,fontWeight:900,color:CC.brand,lineHeight:1.1,marginTop:2}}>{total}</div>
              </div>
              {favMeta&&<div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.goldSoft,border:"1px solid #fcd34d",textAlign:"center"}}>
                <div style={{fontSize:10,color:"#92400e",fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Любимый режим</div>
                <div style={{fontSize:24,fontWeight:900,color:"#78350f",marginTop:2}}>{favMeta.emoji}</div>
                <div style={{fontSize:12,fontWeight:800,color:"#78350f"}}>{favMeta.name}</div>
              </div>}
              {bwMeta&&bestWr&&<div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.accentSoft,border:`1px solid ${CC.accent}`,textAlign:"center"}}>
                <div style={{fontSize:10,color:CC.accent,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Сильнейший</div>
                <div style={{fontSize:24,fontWeight:900,color:CC.accent,marginTop:2}}>{bwMeta.emoji}</div>
                <div style={{fontSize:12,fontWeight:800,color:CC.accent}}>{bwMeta.name}</div>
                <div style={{fontSize:11,color:CC.textDim}}>{Math.round(bestWr.wr*100)}% winrate</div>
              </div>}
            </div>
            {/* Per-variant table */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {VARIANTS.filter(v=>v.id!=="standard").map(v=>{
                const s=variantStats[v.id]||{w:0,l:0,d:0};
                const t=s.w+s.l+s.d;
                const wr=t>0?Math.round(s.w/t*100):0;
                return <div key={v.id} style={{display:"flex",alignItems:"center",gap:SPACE[2],padding:"8px 12px",borderRadius:RADIUS.sm,background:t>0?CC.surface1:CC.surface2,border:`1px solid ${CC.border}`}}>
                  <span style={{fontSize:20,minWidth:26}}>{v.emoji}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:800,color:CC.text}}>{v.name}</div>
                    {t>0?<div style={{display:"flex",height:6,borderRadius:RADIUS.full,overflow:"hidden",marginTop:4,background:CC.surface3}}>
                      <div style={{width:`${s.w/t*100}%`,background:CC.brand}}/>
                      <div style={{width:`${s.d/t*100}%`,background:"#9ca3af"}}/>
                      <div style={{width:`${s.l/t*100}%`,background:CC.danger}}/>
                    </div>:<div style={{fontSize:11,color:CC.textDim,fontStyle:"italic"}}>не играл</div>}
                  </div>
                  {t>0&&<div style={{fontSize:12,color:CC.textDim,minWidth:90,textAlign:"right",fontFamily:"ui-monospace, monospace"}}>
                    <b style={{color:CC.brand}}>{s.w}</b>/<b style={{color:CC.danger}}>{s.l}</b>/{s.d} · <b style={{color:wr>=50?CC.brand:CC.danger}}>{wr}%</b>
                  </div>}
                </div>;
              })}
            </div>
          </>)}
          <Btn variant="secondary" size="md" full style={{marginTop:SPACE[4]}} onClick={()=>sShowVariantStats(false)}>Закрыть</Btn>
        </div>;
      })()}
    </Modal>

    {/* ═══ Daily Brilliancy Hunt (killer #10) ═══ */}
    <Modal open={showBrilliancy} onClose={()=>sShowBrilliancy(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>💎 Daily Brilliancy Hunt <Badge tone="gold" size="sm">{new Date().toLocaleDateString("ru-RU")}</Badge></span>}>
      {brilliancyHunt&&brilliancyState&&(()=>{
        const lb=simulatedLeaderboard(brilliancyState.idx);
        const renderMiniBoard=()=>{
          try{
            const ch=new Chess(brilliancyHunt.fen);
            const board=ch.board();
            const flip=brilliancyHunt.side==="b";
            const rows=flip?[...board].reverse().map(r=>[...r].reverse()):board;
            return <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",width:"100%",maxWidth:360,aspectRatio:"1/1",border:`2px solid ${CC.text}`,borderRadius:RADIUS.sm,overflow:"hidden",margin:"0 auto"}}>
              {rows.flatMap((row,r)=>row.map((p,c)=>{
                const isLight=(r+c)%2===0;
                return <div key={`${r}-${c}`} style={{
                  background:isLight?"#f0d9b5":"#b58863",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"calc(min(5vw, 28px))",lineHeight:1,
                  color:p?.color==="w"?"#fff":"#000",
                  textShadow:p?.color==="w"?"0 0 1px #000, 0 1px 2px rgba(0,0,0,0.5)":"0 0 1px #fff",
                }}>{p?PM[`${p.color}${p.type}`]||"":""}</div>;
              }))}
            </div>;
          }catch{return <div style={{padding:SPACE[3],color:CC.danger}}>Не могу отрисовать позицию</div>}
        };
        return <div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",marginBottom:SPACE[3]}}>
            <div style={{fontSize:14,fontWeight:900,color:"#78350f"}}>{brilliancyHunt.title}</div>
            <div style={{fontSize:12,color:"#92400e",marginTop:4,lineHeight:1.5}}>{brilliancyHunt.story}</div>
            <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[2],flexWrap:"wrap"}}>
              <Badge tone="gold" size="xs">★ {brilliancyHunt.difficulty}/5</Badge>
              {brilliancyHunt.year&&<Badge tone="info" size="xs">{brilliancyHunt.year}</Badge>}
              <Badge tone={brilliancyHunt.side==="w"?"gold":"info"} size="xs">{brilliancyHunt.side==="w"?"⚪ ход белых":"⚫ ход чёрных"}</Badge>
            </div>
          </div>
          {renderMiniBoard()}
          {!brilliancyState.solved&&!brilliancyState.givenUp&&<>
            <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[3]}}>
              <input type="text" value={brilliancyInput} onChange={e=>{sBrilliancyInput(e.target.value);sBrilliancyResult(null)}}
                placeholder="Введи ход (напр. Be7, Nxc3, O-O, e5)"
                style={{flex:1,padding:"10px 14px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:14,fontFamily:"ui-monospace, monospace",background:CC.surface1}}
                onKeyDown={e=>{
                  if(e.key==="Enter"&&brilliancyInput.trim()){
                    const{state:newState,correct,reward}=applyGuess(brilliancyHunt,brilliancyState,brilliancyInput.trim());
                    sBrilliancyState(newState);sBrilliancyResult({correct,reward});
                    if(correct&&reward>0)addChessy(reward,`💎 brilliancy "${brilliancyHunt.title.slice(0,30)}"`);
                  }
                }}/>
              <Btn variant="primary" size="md" disabled={!brilliancyInput.trim()} onClick={()=>{
                const{state:newState,correct,reward}=applyGuess(brilliancyHunt,brilliancyState,brilliancyInput.trim());
                sBrilliancyState(newState);sBrilliancyResult({correct,reward});
                if(correct&&reward>0)addChessy(reward,`💎 brilliancy "${brilliancyHunt.title.slice(0,30)}"`);
              }}>Проверить</Btn>
            </div>
            {brilliancyResult&&!brilliancyResult.correct&&<div style={{marginTop:SPACE[2],padding:SPACE[2],borderRadius:RADIUS.md,background:CC.dangerSoft,border:`1px solid ${CC.danger}`,fontSize:12,color:"#991b1b"}}>
              ✗ Не тот ход. Попыток: {brilliancyState.attempts}. Это «{brilliancyInput}» — попробуй ещё. Думай о геометрии, а не очевидном взятии.
            </div>}
            {brilliancyState.hintShown&&<div style={{marginTop:SPACE[2],padding:SPACE[2],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,fontSize:12,color:"#065f46"}}>
              💡 <b>Подсказка:</b> {hintFor(brilliancyHunt)}
            </div>}
            <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[3]}}>
              <Btn variant="ghost" size="sm" disabled={brilliancyState.hintShown} onClick={()=>{sBrilliancyState(showHint(brilliancyHunt,brilliancyState))}}>💡 Подсказка (-40% reward)</Btn>
              <Btn variant="ghost" size="sm" onClick={()=>{
                if(confirm("Сдаёшься? Streak обнулится."))sBrilliancyState(giveUp(brilliancyHunt,brilliancyState))
              }}>🏳 Сдаюсь</Btn>
            </div>
          </>}
          {brilliancyState.solved&&<div style={{marginTop:SPACE[3],padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#ecfdf5,#a7f3d0)",border:`2px solid ${CC.brand}`,textAlign:"center"}}>
            <div style={{fontSize:48,lineHeight:1}}>💎</div>
            <div style={{fontSize:18,fontWeight:900,color:"#065f46",marginTop:SPACE[2]}}>BRILLIANCY!</div>
            <div style={{fontSize:13,color:"#065f46",marginTop:4}}>Ход <b>{brilliancyHunt.solutionSan}</b> · с {brilliancyState.attempts} попытк{brilliancyState.attempts===1?"и":"и"}</div>
            <div style={{fontSize:14,color:"#065f46",marginTop:SPACE[2]}}>+{brilliancyResult?.reward||0} Chessy · streak <b>{brilliancyState.streak}</b> дн.</div>
          </div>}
          {brilliancyState.givenUp&&<div style={{marginTop:SPACE[3],padding:SPACE[3],borderRadius:RADIUS.md,background:CC.surface2,border:`1px solid ${CC.border}`,textAlign:"center"}}>
            <div style={{fontSize:36,lineHeight:1}}>🏳</div>
            <div style={{fontSize:14,fontWeight:800,color:CC.text,marginTop:SPACE[2]}}>Решение: <b>{brilliancyHunt.solutionSan}</b></div>
            <div style={{fontSize:12,color:CC.textDim,marginTop:4}}>Streak обнулён. Возвращайся завтра.</div>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:SPACE[2],marginTop:SPACE[3]}}>
            <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface1,border:`1px solid ${CC.border}`,textAlign:"center"}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800}}>Streak 🔥</div>
              <div style={{fontSize:18,fontWeight:900,color:CC.danger}}>{brilliancyState.streak}</div>
            </div>
            <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface1,border:`1px solid ${CC.border}`,textAlign:"center"}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800}}>Лучший</div>
              <div style={{fontSize:18,fontWeight:900,color:CC.gold}}>{brilliancyState.bestStreak}</div>
            </div>
            <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface1,border:`1px solid ${CC.border}`,textAlign:"center"}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800}}>Решили</div>
              <div style={{fontSize:18,fontWeight:900,color:CC.brand}}>{lb.solved}</div>
              <div style={{fontSize:9,color:CC.textDim}}>из {lb.players}</div>
            </div>
            <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:CC.surface1,border:`1px solid ${CC.border}`,textAlign:"center"}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800}}>Avg попыт.</div>
              <div style={{fontSize:18,fontWeight:900,color:CC.text}}>{lb.avgAttempts}</div>
            </div>
          </div>
          {brilliancyState.history.length>0&&<div style={{marginTop:SPACE[3]}}>
            <SectionHeader title="ИСТОРИЯ"/>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:SPACE[2]}}>
              {brilliancyState.history.slice(0,14).map((h,i)=><div key={i} title={`${h.date}: ${h.solved?`✓ ${h.attempts} попыт.`:"✗"}`}
                style={{width:24,height:24,borderRadius:6,background:h.solved?CC.brand:CC.danger,opacity:h.solved?1:0.6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff"}}>
                {h.solved?"✓":"✗"}
              </div>)}
            </div>
          </div>}
          <div style={{marginTop:SPACE[3],fontSize:11,color:CC.textDim,textAlign:"center",lineHeight:1.5}}>
            Завтра в 00:00 — новая партия из коллекции {BRILLIANCIES.length} брилл-ходов.
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Ghost Mode (killer #9) ═══ */}
    <Modal open={showGhost} onClose={()=>sShowGhost(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>👻 Ghost Mode <Badge tone="gold" size="sm">GM спарринг</Badge></span>}>
      <div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#1f2937,#0f172a)",color:"#fbbf24",marginBottom:SPACE[3],fontSize:13,lineHeight:1.5}}>
          <b>Играй против призрака гроссмейстера.</b><br/>
          Каждый бот использует мини-книгу дебютов реального игрока + стилевые предпочтения (Tal жертвует, Petrosian защищается, Magnus давит эндшпиль). Это не точный клон — это эмуляция стиля.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2]}}>
          {GHOSTS.map(g=>{
            const isActive=ghostMode&&activeGhost?.id===g.id;
            return <button key={g.id} onClick={()=>{
              sActiveGhost(g);sGhostMode(true);sShowGhost(false);sTab("play");sHotseat(false);sRivalMode(false);sCloneMode(false);
              const lvl=chessy.owned.master_ai?g.aiLevel:Math.min(4,g.aiLevel);
              sAiI(lvl);
              setTimeout(()=>newG(),50);
              showToast(`👻 Призрак ${g.name} принимает вызов...`,"info");
              setTimeout(()=>showToast(`«${g.motto}»`,"info"),1500);
            }} className="cc-focus-ring"
              style={{textAlign:"left",padding:SPACE[3],borderRadius:RADIUS.md,
                background:isActive?"linear-gradient(135deg,#fef3c7,#fde68a)":"linear-gradient(135deg,#1f2937,#374151)",
                border:isActive?`2px solid ${CC.gold}`:"1px solid #4b5563",
                color:isActive?CC.text:"#fff",cursor:"pointer",
                transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <div style={{fontSize:32}}>{g.flag}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:900}}>{g.name}</div>
                  <div style={{fontSize:11,opacity:0.85}}>{g.era} · {g.rating}</div>
                </div>
                {isActive&&<Badge tone="gold" size="xs">active</Badge>}
              </div>
              <div style={{fontSize:12,fontStyle:"italic",opacity:0.9,marginBottom:SPACE[1]}}>«{g.motto}»</div>
              <div style={{fontSize:11,opacity:0.7}}>{g.signatureGames}</div>
              <div style={{display:"flex",gap:6,marginTop:SPACE[2],flexWrap:"wrap"}}>
                {g.style.aggression>0.6&&<Badge tone="danger" size="xs">атакёр</Badge>}
                {g.style.sacrifice>0.5&&<Badge tone="gold" size="xs">жертвенник</Badge>}
                {g.style.positional>0.7&&<Badge tone="info" size="xs">позиционный</Badge>}
                {g.style.endgameAffinity>0.85&&<Badge tone="accent" size="xs">эндшпиль</Badge>}
                {g.style.aggression<0&&<Badge tone="info" size="xs">защитник</Badge>}
              </div>
            </button>;
          })}
        </div>
        {ghostMode&&activeGhost&&<div style={{marginTop:SPACE[3],padding:SPACE[2],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,fontSize:12,color:"#065f46",textAlign:"center"}}>
          Активный призрак: <b>{activeGhost.name}</b>.
          <Btn variant="ghost" size="sm" style={{marginLeft:SPACE[2]}} onClick={()=>{sGhostMode(false);sActiveGhost(null);showToast("Ghost-режим выключен","info")}}>Выкл</Btn>
        </div>}
        <div style={{marginTop:SPACE[3],fontSize:11,color:CC.textDim,lineHeight:1.5,textAlign:"center"}}>
          Победа над призраком — <b>+25 Chessy</b>. Эти боты сильнее обычных AI того же уровня за счёт книги дебютов.
        </div>
      </div>
    </Modal>

    {/* ═══ Style Cloner (killer #7) ═══ */}
    <Modal open={showCloner} onClose={()=>sShowCloner(false)} size="lg"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>🧬 Style Cloner <Badge tone="info" size="sm">Lichess</Badge></span>}>
      <div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"#ecfeff",border:"1px solid #67e8f9",marginBottom:SPACE[3],fontSize:13,color:"#155e75",lineHeight:1.5}}>
          <b>Импортируй до 50 партий с Lichess</b> — мы проанализируем дебюты, тактику, агрессию, размены — и создадим <b>бота-клона</b> с твоим стилем. Поделись ссылкой — друг сыграет «против тебя».
        </div>
        <div style={{display:"flex",gap:SPACE[2],marginBottom:SPACE[3]}}>
          <input type="text" value={clonerUsername} onChange={e=>sClonerUsername(e.target.value.trim())}
            placeholder="Lichess username (например, DrNykterstein)"
            style={{flex:1,padding:"10px 14px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:14,background:CC.surface1}}/>
          <Btn variant="primary" size="md" disabled={!clonerUsername||clonerLoading} onClick={async()=>{
            sClonerError("");sClonerLoading(true);
            try{
              const games=await fetchLichessGames(clonerUsername,30);
              if(games.length===0){sClonerError("Партий не найдено. Проверь username.");sClonerLoading(false);return}
              const profile=analyzeGames(games,clonerUsername);
              if(profile.gamesAnalyzed===0){sClonerError("Не удалось разобрать ни одной партии.");sClonerLoading(false);return}
              sClones(list=>[profile,...list].slice(0,20));
              addChessy(15,`клон ${clonerUsername} создан`);
              sClonerLoading(false);
            }catch(e:any){
              sClonerError(`Ошибка: ${e?.message||"не удалось получить партии"}. Lichess может блокировать CORS — попробуй другой username.`);
              sClonerLoading(false);
            }
          }}>{clonerLoading?<Spinner/>:"⚡ Создать клон"}</Btn>
        </div>
        {clonerError&&<div style={{padding:SPACE[2],borderRadius:RADIUS.md,background:CC.dangerSoft,border:`1px solid ${CC.danger}`,color:"#991b1b",fontSize:12,marginBottom:SPACE[3]}}>{clonerError}</div>}
        {clones.length===0?(
          <div style={{padding:`${SPACE[4]}px ${SPACE[3]}px`,textAlign:"center"}}>
            <div style={{fontSize:48,lineHeight:1,marginBottom:SPACE[2],animation:"pop 0.5s ease-out"}}>🧬</div>
            <div style={{fontSize:14,fontWeight:800,color:CC.text,marginBottom:SPACE[1]}}>Пока нет клонов</div>
            <div style={{fontSize:12,color:CC.textDim,lineHeight:1.5,maxWidth:340,margin:"0 auto"}}>
              Введи Lichess username выше и нажми «Создать клон» — мы проанализируем 30 партий и создадим бот-клон.
            </div>
            <div style={{marginTop:SPACE[3],fontSize:11,color:CC.textDim,fontStyle:"italic"}}>
              Попробуй: <button onClick={()=>sClonerUsername("DrNykterstein")} style={{background:"none",border:"none",color:CC.brand,cursor:"pointer",fontWeight:700,fontStyle:"italic",padding:0,fontSize:11}}>DrNykterstein</button> · <button onClick={()=>sClonerUsername("Hikaru")} style={{background:"none",border:"none",color:CC.brand,cursor:"pointer",fontWeight:700,fontStyle:"italic",padding:0,fontSize:11}}>Hikaru</button> · <button onClick={()=>sClonerUsername("penguingm1")} style={{background:"none",border:"none",color:CC.brand,cursor:"pointer",fontWeight:700,fontStyle:"italic",padding:0,fontSize:11}}>penguingm1</button>
            </div>
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
            {clones.map((cl,i)=><div key={i} style={{
              padding:SPACE[3],borderRadius:RADIUS.md,
              background:activeCloneId===i?"linear-gradient(135deg,#ecfeff,#cffafe)":CC.surface1,
              border:activeCloneId===i?`2px solid #06b6d4`:`1px solid ${CC.border}`
            }}>
              <div style={{display:"flex",alignItems:"start",gap:SPACE[2]}}>
                <div style={{fontSize:34,lineHeight:1}}>🧬</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:SPACE[2],flexWrap:"wrap"}}>
                    <div style={{fontSize:16,fontWeight:900,color:CC.text}}>{cl.username}</div>
                    <Badge tone="gold" size="sm">{cl.rating}</Badge>
                    <Badge tone={cl.style==="Aggressive"||cl.style==="Wild"?"danger":cl.style==="Tactical"?"info":"accent"} size="sm">{cl.style}</Badge>
                  </div>
                  <div style={{fontSize:12,color:CC.textDim,marginTop:4,lineHeight:1.5}}>
                    {cl.gamesAnalyzed} партий · {cl.avgMoves} ходов в среднем · W/B winrate {Math.round(cl.whiteWinRate*100)}/{Math.round(cl.blackWinRate*100)}%
                  </div>
                  <div style={{fontSize:12,color:CC.text,marginTop:4,fontStyle:"italic"}}>{styleVerdict(cl)}</div>
                  {cl.topOpenings.length>0&&<div style={{fontSize:11,color:CC.textDim,marginTop:4}}>
                    Любимые: {cl.topOpenings.slice(0,3).map(o=>o.line).join(" · ")}
                  </div>}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:SPACE[1],marginTop:SPACE[2]}}>
                    <div style={{fontSize:10}}><span style={{color:CC.textDim}}>Ранний ферзь</span><br/><b>{Math.round(cl.earlyQueenRate*100)}%</b></div>
                    <div style={{fontSize:10}}><span style={{color:CC.textDim}}>Рокировка</span><br/><b>{Math.round(cl.castleRate*100)}%</b></div>
                    <div style={{fontSize:10}}><span style={{color:CC.textDim}}>Размены</span><br/><b>{Math.round(cl.captureRate*100)}%</b></div>
                    <div style={{fontSize:10}}><span style={{color:CC.textDim}}>Жертвы</span><br/><b>{Math.round(cl.sacrificeRate*100)}%</b></div>
                  </div>
                </div>
              </div>
              <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[3],flexWrap:"wrap"}}>
                <Btn variant="primary" size="sm" onClick={()=>{
                  sActiveCloneId(i);sCloneMode(true);sShowCloner(false);sTab("play");sHotseat(false);sRivalMode(false);
                  // Set AI level to clone's rating-matched level
                  const lvl=chessy.owned.master_ai?cl.aiLevel:Math.min(4,cl.aiLevel);
                  sAiI(lvl);
                  setTimeout(()=>newG(),50);
                  showToast(`▶ Играешь vs клон ${cl.username} (${cl.rating} · ${cl.style})`,"success");
                }}>▶ Играть</Btn>
                <Btn variant="secondary" size="sm" onClick={()=>{
                  const code=profileToShareCode(cl);
                  const url=`${window.location.origin}${window.location.pathname}?clone=${code}`;
                  try{navigator.clipboard.writeText(url).then(()=>showToast("✓ Ссылка на клон скопирована","success")).catch(()=>showToast("Clipboard недоступен","error"))}catch{showToast("Clipboard недоступен","error")}
                }}>🔗 Share-link</Btn>
                <Btn variant="ghost" size="sm" onClick={()=>{
                  if(confirm(`Удалить клон ${cl.username}?`)){
                    sClones(list=>list.filter((_,j)=>j!==i));
                    if(activeCloneId===i){sActiveCloneId(null);sCloneMode(false)}
                  }
                }}>🗑</Btn>
              </div>
            </div>)}
          </div>
        )}
        {cloneMode&&activeClone&&<div style={{marginTop:SPACE[3],padding:SPACE[2],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`,fontSize:12,color:"#065f46",textAlign:"center"}}>
          <b>Активный клон: {activeClone.username}</b> — следующая партия пройдёт против него.
          <Btn variant="ghost" size="sm" style={{marginLeft:SPACE[2]}} onClick={()=>{sCloneMode(false);sActiveCloneId(null);showToast("Clone-режим выключен","info")}}>Выкл</Btn>
        </div>}
        <div style={{marginTop:SPACE[4],fontSize:11,color:CC.textDim,lineHeight:1.5}}>
          Lichess API публичный, без auth. Иногда блокируется по CORS — тогда работает только импорт через PGN. Анализ локальный, профиль не уходит на сервер.
        </div>
      </div>
    </Modal>

    {/* ═══ Auto-Reels Generator (killer #8) ═══ */}
    <Modal open={showReel} onClose={()=>{sShowReel(false);if(reelBlobUrl){URL.revokeObjectURL(reelBlobUrl);sReelBlobUrl("")}}} size="md"
      title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}>🎬 Auto-Reel Generator <Badge tone="gold" size="sm">vertical 9:16</Badge></span>}>
      <div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fdf2f8,#fce7f3)",border:"1px solid #f9a8d4",marginBottom:SPACE[3],fontSize:13,color:"#9d174d",lineHeight:1.5}}>
          <b>Из этой партии — вертикальное видео 1080×1920 для TikTok / Reels / Shorts.</b><br/>
          Интро → ускоренная партия → 3 ключевых хода с подсветкой → финальная позиция. Длительность ~{Math.round(estimateReelSeconds(hist.length,{msPerMove:reelSpeed}))} сек.
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2],marginBottom:SPACE[3]}}>
          <div style={{padding:SPACE[2],borderRadius:RADIUS.md,background:CC.surface1,border:`1px solid ${CC.border}`}}>
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Партия</div>
            <div style={{fontSize:13,fontWeight:700,color:CC.text,marginTop:2}}>⚪ {reelMeta.white}</div>
            <div style={{fontSize:13,fontWeight:700,color:CC.text}}>⚫ {reelMeta.black}</div>
            <div style={{fontSize:11,color:CC.textDim,marginTop:4}}>{hist.length} ходов · {reelMeta.result}</div>
          </div>
          <div style={{padding:SPACE[2],borderRadius:RADIUS.md,background:CC.surface1,border:`1px solid ${CC.border}`}}>
            <label style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const,display:"block"}}>Скорость хода</label>
            <input type="range" min={150} max={800} step={50} value={reelSpeed} onChange={e=>sReelSpeed(+e.target.value)}
              style={{width:"100%",accentColor:CC.brand}}/>
            <div style={{fontSize:12,color:CC.text,marginTop:2}}>{reelSpeed} мс / ход</div>
            <div style={{fontSize:10,color:CC.textDim}}>{reelSpeed<300?"быстро":reelSpeed<500?"средне":"медленно"}</div>
          </div>
        </div>
        {reelBlobUrl?(
          <div>
            <video src={reelBlobUrl} controls autoPlay muted loop style={{width:"100%",maxHeight:480,borderRadius:RADIUS.md,background:"#000"}}/>
            <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[3]}}>
              <a href={reelBlobUrl} download={`aevion-chess-${Date.now()}.webm`} style={{flex:1,textDecoration:"none"}}>
                <Btn variant="primary" size="md" full>⬇ Скачать WebM</Btn>
              </a>
              <Btn variant="secondary" size="md" onClick={()=>{URL.revokeObjectURL(reelBlobUrl);sReelBlobUrl("")}}>↻ Перегенерировать</Btn>
            </div>
            <div style={{marginTop:SPACE[2],fontSize:11,color:CC.textDim,lineHeight:1.5}}>
              💡 WebM поддерживается TikTok, YouTube Shorts. Для Instagram Reels конвертируй в MP4 онлайн (cloudconvert.com).
            </div>
          </div>
        ):(
          <Btn variant="primary" size="lg" full disabled={reelGenerating||hist.length<2} onClick={async()=>{
            sReelGenerating(true);
            try{
              const{highlights,captions}=pickHighlights(hist);
              const blob=await generateReel(hist,{
                white:reelMeta.white,black:reelMeta.black,result:reelMeta.result,
                msPerMove:reelSpeed,highlightMoves:highlights,captions,
              });
              const url=URL.createObjectURL(blob);
              sReelBlobUrl(url);
              addChessy(8,"reel сгенерирован");
            }catch(e:any){
              showToast(`Ошибка: ${e?.message||"не удалось"}. Safari не поддерживает MediaRecorder WebM — используй Chrome/Firefox/Edge.`,"error");
            }
            sReelGenerating(false);
          }}>{reelGenerating?<><Spinner/> Рендерю кадры…</>:"🎬 Создать Reel"}</Btn>
        )}
      </div>
    </Modal>

    {/* Chessy Explainer */}
    <Modal open={showChessyInfo} onClose={()=>sShowChessyInfo(false)} size="md" title={<span style={{display:"inline-flex",alignItems:"center",gap:8}}><Icon.Coin width={20} height={20}/> Как работает Chessy</span>}>
      <div style={{fontSize:14,color:CC.text,lineHeight:1.55}}>
        <p style={{margin:`0 0 ${SPACE[3]}px`}}>
          <b>Chessy</b> — игровая валюта AEVION CyberChess. Зарабатывай, играя и решая пазлы. Трать на премиум-функции, подсказки и тренировки.
        </p>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[3],marginBottom:SPACE[4]}}>
          {/* Earn */}
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`}}>
            <div style={{fontSize:12,fontWeight:900,color:CC.brand,letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>💰 Как заработать</div>
            <ul style={{margin:0,paddingLeft:18,fontSize:12,color:CC.text,lineHeight:1.8}}>
              <li><b>Победа</b> 5–160 (зависит от силы AI и времени)</li>
              <li><b>Пазл</b> 2–15 (по рейтингу задачи)</li>
              <li><b>Daily puzzle</b> +50 за первое решение в день</li>
              <li><b>Daily bonus</b> +5 / +30 (streak 3) / +100 (streak 7)</li>
              <li><b>Puzzle Rush</b> 2 за пазл + бонус по best streak</li>
              <li><b>Исправленная ошибка</b> +3 (Blunder Rewind)</li>
              <li><b>Достижения</b> 30–400</li>
              <li><b>Welcome</b> +50 при первом визите</li>
            </ul>
          </div>
          {/* Spend */}
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.dangerSoft,border:`1px solid ${CC.danger}`}}>
            <div style={{fontSize:12,fontWeight:900,color:CC.danger,letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>🛒 На что тратить</div>
            <ul style={{margin:0,paddingLeft:18,fontSize:12,color:CC.text,lineHeight:1.8}}>
              <li><b>Takeback</b> 3 (откат хода в партии vs AI)</li>
              <li><b>Подсказка в пазле</b> 5</li>
              <li><b>Ghost-подсказка</b> 15 (стрелка лучшего хода)</li>
              <li><b>Глубокий разбор</b> 20 (Coach)</li>
              <li><b>Master AI unlock</b> 30 (2400 ELO)</li>
              <li><b>Premium-тема</b> 50 (Neon / Obsidian / Sakura)</li>
              <li><b>AI Rival Алексей</b> 100 (beta)</li>
            </ul>
          </div>
        </div>

        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.goldSoft,border:"1px solid #fcd34d",marginBottom:SPACE[3]}}>
          <div style={{fontSize:12,fontWeight:900,color:"#92400e",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>📊 Твоя статистика</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:SPACE[2]}}>
            <div><div style={{fontSize:11,color:"#b45309",fontWeight:700}}>Сейчас</div><div style={{fontSize:22,fontWeight:900,color:"#78350f"}}>{chessy.balance}</div></div>
            <div><div style={{fontSize:11,color:"#b45309",fontWeight:700}}>Всего</div><div style={{fontSize:22,fontWeight:900,color:"#78350f"}}>{chessy.lifetime}</div></div>
            <div><div style={{fontSize:11,color:"#b45309",fontWeight:700}}>Streak</div><div style={{fontSize:22,fontWeight:900,color:"#78350f"}}>{chessy.streak} дн.</div></div>
          </div>
        </div>

        {/* Leaderboard — local simulated */}
        {(()=>{
          const board:{name:string;rating:number;chessy:number;country:string;isMe?:boolean}[]=[
            {name:"Magnus C.",rating:2847,chessy:8800,country:"🇳🇴"},
            {name:"Hikaru N.",rating:2795,chessy:7600,country:"🇺🇸"},
            {name:"Fabiano C.",rating:2758,chessy:6900,country:"🇺🇸"},
            {name:"Ding L.",rating:2720,chessy:5800,country:"🇨🇳"},
            {name:"Alireza F.",rating:2692,chessy:5200,country:"🇫🇷"},
            {name:"Anish G.",rating:2668,chessy:4700,country:"🇳🇱"},
            {name:"Ian N.",rating:2633,chessy:4100,country:"🇷🇺"},
            {name:"Wesley So",rating:2610,chessy:3600,country:"🇺🇸"},
            {name:"Jan-Krz. D.",rating:2582,chessy:3100,country:"🇵🇱"},
            {name:"Leinier D.",rating:2551,chessy:2800,country:"🇺🇸"},
            {name:"Ты",rating:rat,chessy:chessy.lifetime,country:"🇰🇿",isMe:true},
          ];
          board.sort((a,b)=>b.rating-a.rating);
          const meIdx=board.findIndex(x=>x.isMe);
          return <div style={{marginTop:SPACE[3],padding:SPACE[3],borderRadius:RADIUS.md,background:CC.accentSoft,border:`1px solid ${CC.accent}`}}>
            <div style={{fontSize:12,fontWeight:900,color:CC.accent,letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>
              🏆 Глобальный лидерборд
              <Badge tone="accent" size="xs" style={{marginLeft:6,fontSize:9}}>демо</Badge>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              {board.slice(0,Math.max(10,meIdx+1)).map((p,i)=>{
                const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":"";
                return <div key={i} style={{
                  display:"flex",alignItems:"center",gap:SPACE[2],
                  padding:"6px 10px",borderRadius:RADIUS.sm,
                  background:p.isMe?CC.brandSoft:"rgba(255,255,255,0.5)",
                  border:p.isMe?`1px solid ${CC.brand}`:"1px solid transparent"
                }}>
                  <div style={{width:24,textAlign:"center",fontSize:12,fontWeight:900,color:p.isMe?CC.brand:CC.textDim}}>
                    {medal||`#${i+1}`}
                  </div>
                  <span style={{fontSize:14}}>{p.country}</span>
                  <div style={{flex:1,fontSize:13,fontWeight:p.isMe?900:700,color:p.isMe?CC.brand:CC.text}}>{p.name}</div>
                  <Badge tone="gold" size="xs">{p.rating}</Badge>
                  <span style={{fontSize:11,color:CC.textDim,fontFamily:"ui-monospace, monospace",minWidth:50,textAlign:"right"}}>{p.chessy}c</span>
                </div>;
              })}
            </div>
            <div style={{fontSize:10,color:CC.textDim,marginTop:SPACE[2],fontStyle:"italic",lineHeight:1.4}}>
              Топ-10 мировых гроссмейстеров — симулировано. Реальный лидерборд появится с запуском multiplayer.
            </div>
          </div>;
        })()}

        <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[4]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sShowChessyInfo(false)}>Понятно</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{sShowChessyInfo(false);sShowShop(true)}}>🛒 В магазин</Btn>
        </div>
      </div>
    </Modal>

    {/* Chessy gain floating animation */}
    {chessyFloat&&<ChessyFloat key={chessyFloat.key} amount={chessyFloat.amount} onDone={()=>sChessyFloat(null)}/>}

    {/* Puzzle Rush — final result */}
    <Modal open={!!rushResult} onClose={()=>sRushResult(null)} size="sm" title={rushResult?.isNewBest?"🏆 Новый рекорд!":"⚡ Rush завершён"}>
      {rushResult&&<div style={{textAlign:"center"}}>
        <div style={{fontSize:60,lineHeight:1,marginBottom:SPACE[3]}}>{rushResult.isNewBest?"🏆":"⚡"}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:SPACE[2],marginBottom:SPACE[4]}}>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`}}>
            <div style={{fontSize:10,color:CC.brand,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Решено</div>
            <div style={{fontSize:28,fontWeight:900,color:CC.brand,lineHeight:1.1,marginTop:2}}>{rushResult.score}</div>
          </div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"#fef2f2",border:"1px solid #fca5a5"}}>
            <div style={{fontSize:10,color:CC.danger,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Streak 🔥</div>
            <div style={{fontSize:28,fontWeight:900,color:CC.danger,lineHeight:1.1,marginTop:2}}>{rushResult.streak}</div>
          </div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.goldSoft,border:"1px solid #fcd34d"}}>
            <div style={{fontSize:10,color:CC.gold,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Лучшее</div>
            <div style={{fontSize:28,fontWeight:900,color:CC.gold,lineHeight:1.1,marginTop:2}}>{rushResult.best}</div>
          </div>
        </div>
        <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",marginBottom:SPACE[3]}}>
          <div style={{fontSize:12,fontWeight:800,color:"#92400e"}}>Начислено Chessy</div>
          <div style={{fontSize:22,fontWeight:900,color:"#78350f",display:"inline-flex",alignItems:"center",gap:4,marginTop:2}}>
            <Icon.Coin width={20} height={20}/>+{rushResult.chessy}
          </div>
        </div>
        <div style={{display:"flex",gap:SPACE[2]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sRushResult(null)}>Закрыть</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{
            sRushResult(null);sPzMode("rush");
            // Force reinit rush
            sPzTimeLeft(90);sRushActive(true);sRushScore(0);sRushStreak(0);sRushBestStreak(0);
          }}>⚡ Ещё раз</Btn>
        </div>
      </div>}
    </Modal>

    </ProductPageShell></main>);
}