"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import Piece, { PIECE_SETS, useActivePieceSet, setActivePieceSet } from "./Pieces";
import AiCoach from "./AiCoach";
import CoachKnowledge from "./CoachKnowledgeModal";
import { COACH_KNOWLEDGE } from "./coachKnowledge";
import CoachLessonsModal from "./CoachLessonsModal";
import { SYM, SymTab, SymBadge, SymCrest } from "./symbols";
import { detectPhase, PHASE_TIPS } from "./coachPhase";
import { Btn, Card, Badge, Tabs as UiTabs, Modal, Icon, Spinner, SectionHeader, ChessyFloat, Confetti } from "./ui";
import { COLOR as CC_LIGHT, SPACE, RADIUS, SHADOW, MOTION, Z } from "./theme";

// Dark theme palette — mirrors the keys of COLOR (./theme.ts) so the
// component can swap CC=CC_LIGHT vs CC=CC_DARK at runtime via theme toggle.
// Keep keys 1:1 with theme.ts COLOR or TS will narrow CC's type.
// CC_DARK — lichess-inspired palette: коричневато-тёмный фон (не синий), высокий контраст
const CC_DARK = {
  bg: "#161512",           // lichess background
  surface1: "#262421",     // lichess sidebar panels
  surface2: "#1e1c19",     // deeper surfaces
  surface3: "#100f0d",     // deepest
  surfaceGlass: "rgba(22,21,18,0.85)",

  text: "#bababa",         // lichess text — не ослепительно белый
  textDim: "#8b8987",
  textMute: "#5d5b59",
  textInv: "#161512",

  border: "#3d3b39",
  borderStrong: "#5d5b59",

  brand: "#759900",        // lichess зелёный (ходы, кнопки)
  brandHover: "#88b300",
  brandSoft: "rgba(117,153,0,0.2)",
  accent: "#d1a227",       // lichess золотой акцент
  accentSoft: "rgba(209,162,39,0.2)",
  gold: "#e8a908",
  goldSoft: "rgba(232,169,8,0.2)",
  danger: "#e04040",
  dangerSoft: "rgba(224,64,64,0.18)",
  info: "#4990a4",
  infoSoft: "rgba(73,144,164,0.18)",

  // Board interaction overlays
  sqSel: "rgba(20,85,30,0.9)",     // lichess green selection
  sqValid: "rgba(20,85,30,0.6)",
  sqCap: "rgba(224,64,64,0.5)",
  sqLast: "rgba(184,128,40,0.45)", // lichess yellow last move
  sqCheck: "rgba(224,64,64,0.7)",
  sqPremove: "rgba(73,144,164,0.5)",
  sqPremoveStrong: "rgba(73,144,164,0.7)",
} as const;
import { computeGameDNA, type GameDNA } from "./gameDna";
import { useBoardInput, premoveLegalMoves } from "./useBoardInput";
import { StreamerOverlay } from "./StreamerOverlay";
import { BoardDebugHud } from "./BoardDebugHud";
import { ldRival, svRival, createRival, learnFromEncounter, rivalGreeting, rivalSummary, type RivalProfile } from "./aiRival";
import { ldTournament, svTournament, ldTrophies, svTrophies, createTournament, resolveBotMatches, applyPlayerResult, advanceBracket, nextPlayerMatch, finalPlace, placeReward, defeatedByPlayer, type Tournament, type Trophy, type Persona, PERSONAS } from "./tournament";
import { ldClones, svClones, fetchLichessGames, analyzeGames, profileToShareCode, shareCodeToProfile, clonePreferredMove, styleVerdict, type CloneProfile } from "./styleCloner";
import { generateReel, pickHighlights, estimateReelSeconds } from "./reelsGen";
import { GHOSTS, ghostBookMove, pickGhostStyleMove, type Ghost, type GhostId } from "./ghostMode";
import { todayHunt, applyGuess, showHint, giveUp, hintFor, simulatedLeaderboard, BRILLIANCIES, type BrilliancyHunt, type BrilliancyState } from "./brilliancy";
import { getTopWithMe, getFullBoardAroundMe, findMyRank, CATEGORY_LABEL, type LbCategory, type LbEntry } from "./leaderboards";
import { createTierPaymentRequest, pollPaymentRequest, type ChessyTier } from "./billing";
import MultiPanel from "./MultiPanel";
import { useWorkspace } from "./useWorkspace";
import WorkspaceToolbar from "./WorkspaceToolbar";
import WorkspaceMediaPane from "./WorkspaceMediaPane";
import WorkspaceDock from "./WorkspaceDock";
import MusicPlayer from "./MusicPlayer";
import { CHESS_SOUND_PRESETS, playChessSound, loadSoundPreset, saveSoundPreset } from "./chessSounds";
import CommandPalette, { type Command as PaletteCommand } from "./CommandPalette";
import { loadBookmarks, addBookmark, removeBookmark, type Bookmark } from "./bookmarks";
import { whisperPosition, whisperAndSpeak } from "./positionWhisper";
import { VARIANTS, fischer960Fen, asymmetricFen, twinKingsFen, twinKingsLossSide, rollDice, filterMovesByDice, pickReinforcement, atomicFen, applyExplosion, kothFen, kothWinner, threeCheckFen, knightRidersFen, pawnApocalypseFen, buildArmyFen, ARMY_PRESETS, randomVariant, getDailyVariantState, markDailyVariantPlayed, ldVariantStats, svVariantStats, recordVariantResult, VARIANT_TUTORIAL, VARIANT_ACH_REWARDS, variantAchKey, variantAchLabel, totalVariantGames, favoriteVariant, bestWinrateVariant, type VariantId, type ArmySlot, type VariantStats } from "./variants";
import { EMPTY_POOL, addToPool, removeFromPool, poolSize, isDropLegal, applyDrop, isDropAvailable, POOL_GLYPH, type DropPool } from "./powerDrop";
import { computeThreatMap, cellColor as threatCellColor, reportThreatMap, type ThreatMap } from "./threatMap";
import { startSession as coordStart, registerHit as coordHit, isExpired as coordExpired, timeLeftMs as coordTimeLeft, summarize as coordSummarize, saveToLeaderboard as coordSaveLB, loadLeaderboard as coordLoadLB, rankTitle as coordRank, type CoordSession, type CoordResult, type CoordLeaderboardEntry } from "./coordTrainer";
import { QUESTIONS as QUIZ_Q, PLAYERS as QUIZ_PLAYERS, scoreQuiz, loadResult as ldQuizResult, saveResult as svQuizResult, type QuizResult, type PlayerStyle } from "./personality";
import { emptyBoard as edEmpty, startingBoard as edStart, fenToBoard as edFromFen, boardToFen as edToFen, validateBoard as edValidate, PIECE_TYPES as ED_PIECES, PIECE_NAMES as ED_NAMES, type EditorBoard, type Cell as EdCell } from "./boardEditor";
import { computeInsights, type Insights } from "./insights";
import { getValidGames as ldMasterGames, buildFenLine as masterFenLine, scoreGuess as masterScoreGuess, recordCompletion as masterRecord, type MasterGame } from "./masters";
import { fetchOpening, whitePct as oeWhitePct, drawPct as oeDrawPct, blackPct as oeBlackPct, shortNum as oeShortNum, type OpeningEntry } from "./openingExplorer";
import { fetchTablebase, isTablebaseEligible, categoryLabel as tbLabel, categoryColor as tbColor, type TablebaseEntry } from "./tablebase";
import RepertoireModal, { loadRepertoire, saveRepertoire, matchHist, type Repertoire, type RepertoireEntry } from "./Repertoire";
import DailyMission, { bumpDaily } from "./DailyMission";
import WhatIfButton from "./WhatIfButton";
import BoardArtOverlay, { BOARD_ART_OPTIONS, type BoardArt as BoardArtId } from "./BoardArt";
import { useP2P, genRoomId, type P2PMessage } from "./P2P";
import { generateShareSVG, downloadFile } from "./gameShare";
import CoachPredictions from "./CoachPredictions";
import OnboardingOverlay, { hasCompletedOnboarding, markOnboardingDone, type OnboardingChoice } from "./OnboardingOverlay";
import { getDueReminders, dismissReminder } from "./coachKnowledge";
import WorkspacePiP, { useWorkspacePiP, detectMediaSource } from "./WorkspacePiP";
import { makeDuelConfig, getGhostMoveAt, checkDivergence, formatPastDate, type GhostDuelConfig, type GhostSourceGame } from "./ghostDuel";
import Link from "next/link";
import { MetricsCollector, computeCPL, type MoveMetric, type PVLine as MetricsPVLine } from "./stockfishMetrics";
import { applyGameToCPI } from "./cpi";

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
  {name:"Beginner",elo:400,depth:1,color:"#94a3b8",rand:200,thinkMs:600},
  {name:"Casual",elo:800,depth:2,color:"#10b981",rand:80,thinkMs:480},
  {name:"Club",elo:1200,depth:3,color:"#3b82f6",rand:30,thinkMs:380},
  {name:"Advanced",elo:1600,depth:4,color:"#a78bfa",rand:12,thinkMs:280},
  {name:"Expert",elo:2000,depth:5,color:"#f87171",rand:5,thinkMs:180},
  {name:"Master",elo:2400,depth:6,color:"#fbbf24",rand:2,thinkMs:100},
];
const SFD: Record<number,number> = {3:8,4:12,5:16};
const RANKS = [{min:0,t:"Beginner",i:"●"},{min:600,t:"Novice",i:"◆"},{min:900,t:"Amateur",i:"■"},{min:1200,t:"Club",i:"▲"},{min:1500,t:"Tournament",i:"★"},{min:1800,t:"CM",i:"✦"},{min:2000,t:"FM",i:"✧"},{min:2200,t:"IM",i:"✪"},{min:2400,t:"GM",i:"♛"}];

type Puzzle = {fen:string;sol:string[];name:string;r:number;theme:string;phase?:"Opening"|"Middlegame"|"Endgame";side?:"w"|"b";goal?:"Mate"|"Best move";mateIn?:number};

/* ═══ Stockfish with MultiPV ═══ */
type PVLine = {pv:number;cp:number;mate:number;depth:number;moves:string[]};
class SF{private w:Worker|null=null;private ok=false;private cb:((f:string,t:string,p?:string)=>void)|null=null;private ecb:((cp:number,mate:number,depth?:number)=>void)|null=null;private mpvCb:((lines:PVLine[])=>void)|null=null;private mpvLines:PVLine[]=[];
  init(){if(this.w)return;try{this.w=new Worker("/stockfish-18-lite.js");this.w.onmessage=e=>{const l=String(e.data||"");
    // Diagnostic: log Stockfish init/feature lines so we can verify NNUE + threads in DevTools.
    // Look for: "info string NNUE evaluation using ..." and "info string Using N threads".
    if(l.startsWith("info string")||l==="readyok"||l==="uciok")try{console.log("[SF]",l)}catch{}
    if(l.startsWith("info")&&l.includes("score")){
      const cpM=l.match(/score cp (-?\d+)/);const mM=l.match(/score mate (-?\d+)/);
      const pvM=l.match(/multipv (\d+)/);const depM=l.match(/depth (\d+)/);
      const movesM=l.match(/ pv (.+)/);
      const cp=cpM?parseInt(cpM[1]):0;const mate=mM?parseInt(mM[1]):0;
      const pvNum=pvM?parseInt(pvM[1]):1;const depth=depM?parseInt(depM[1]):0;
      const moves=movesM?movesM[1].trim().split(" "):[];
      if(this.ecb)this.ecb(cp,mate,depth);
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
    if(l==="uciok"){
      // ── Stockfish performance tuning ────────────────────────────────────
      // To compete with Lichess (depth 40+) we maximize cores, RAM, and
      // analysis-mode behavior. Real "Lichess-grade" requires also swapping
      // the binary to a NNUE+SIMD multi-threaded build — see
      // CYBERCHESS_STOCKFISH_UPGRADE.md for the Level 2/3 upgrade path.
      try{
        // Threads: leave 1 core for UI/render. SAB-enabled context required
        // for >1 thread to actually parallelize; we set COEP=credentialless
        // globally in next.config.ts so SAB should be available.
        const cores=typeof navigator!=="undefined"&&navigator.hardwareConcurrency?Math.max(1,navigator.hardwareConcurrency-1):4;
        this.w!.postMessage(`setoption name Threads value ${cores}`);
        // Hash 1024 MB — quadruple vs prior 256. Modern machines (≥8 GB) handle this comfortably,
        // and transposition-table hits dominate analysis throughput. Worth ~2-3x on long thinks.
        this.w!.postMessage("setoption name Hash value 1024");
        // Analysis mode prevents move-time cutoffs (we control via "go depth N").
        this.w!.postMessage("setoption name UCI_AnalyseMode value true");
        // Contempt 0 = balanced eval (no anti-draw bias). Default is engine-dependent.
        this.w!.postMessage("setoption name Contempt value 0");
        // Skill 20 = max strength — no internal handicap.
        this.w!.postMessage("setoption name Skill Level value 20");
      }catch{}
      this.ok=true;this.w!.postMessage("isready");
    }};this.w.postMessage("uci")}catch{this.w=null}}
  ready(){return this.ok&&!!this.w}
  go(fen:string,d:number,cb:(f:string,t:string,p?:string)=>void,ecb?:(cp:number,mate:number,depth?:number)=>void){if(!this.w)return cb("","");this.cb=cb;this.ecb=ecb||null;this.mpvCb=null;try{this.w.postMessage("stop")}catch{};this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  eval(fen:string,d:number,ecb:(cp:number,mate:number,depth?:number)=>void,done:()=>void){if(!this.w)return done();this.cb=()=>done();this.ecb=ecb;this.mpvCb=null;try{this.w.postMessage("stop")}catch{};this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
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
// snd проксирует в playChessSound с текущим preset из localStorage. Сам preset
// меняется через Settings → "Звуки фигур". Если "silent" — функция просто выходит.
function snd(t:string){if(isMuted())return;try{
  const preset=loadSoundPreset();
  const evt=(t==="move"||t==="capture"||t==="check"||t==="castle"||t==="premove"||t==="cancel"||t==="x")?t:"move";
  playChessSound(preset,evt);
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
// Symbol map from our UI annotation to standard PGN NAG codes
const ANNOT_NAG:Record<string,string>={"!!":"$3","!":"$1","!?":"$5","?!":"$6","?":"$2","??":"$4"};

function buildPGN(
  moves:string[],
  meta:{white?:string;black?:string;result?:string;date?:string;event?:string}={},
  annotations:Record<number,string>={}
):string{
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
    const n=i/2+1;
    const w=moves[i];
    const wNag=annotations[i]?` ${ANNOT_NAG[annotations[i]]||""}`.trimEnd():"";
    const b=moves[i+1];
    const bNag=b&&annotations[i+1]?` ${ANNOT_NAG[annotations[i+1]]||""}`.trimEnd():"";
    body.push(b?`${n}. ${w}${wNag} ${b}${bNag}`:`${n}. ${w}${wNag}`);
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
const T={bg:"#f3f4f6",surface:"#fff",border:"#e5e7eb",text:"#111827",dim:"#6b7280",accent:"#059669",gold:"#d97706",danger:"#dc2626",blue:"#2563eb",purple:"#7c3aed",sel:"rgba(5,150,105,0.45)",valid:"rgba(5,150,105,0.35)",cap:"rgba(220,38,38,0.35)",last:"rgba(217,119,6,0.50)",chk:"rgba(220,38,38,0.55)",pm:"rgba(37,99,235,0.35)",pmS:"rgba(37,99,235,0.5)"};

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

/* ═══════════════════════════════════════════════════════════════════════
   Memoized Board Cell — рендерится 64 раза каждый рендер board'а.
   React.memo + примитивные props → 60+ cells skip re-render когда ход
   меняет состояние только 2-4 cells.
   ═══════════════════════════════════════════════════════════════════════ */

type CellProps={
  sq:Square;
  pieceType:"p"|"n"|"b"|"r"|"q"|"k"|null;
  pieceColor:"w"|"b"|null;
  bg:string;
  cursor:"grab"|"default";
  iS:boolean;iV:boolean;iCk:boolean;iPM:boolean;iPS:boolean;
  iL:boolean;isShadow:boolean;isAnimDest:boolean;isDragOrigin:boolean;
  iHover?:boolean;iHoverCap?:boolean;
  pmIdx?:number;
  coordFile?:string;
  coordRank?:number;
};

const Cell=React.memo(function Cell({sq,pieceType,pieceColor,bg,cursor,iS,iV,iCk,iPM,iPS,iL,isShadow,isAnimDest,isDragOrigin,iHover,iHoverCap,pmIdx,coordFile,coordRank}:CellProps){
  void iPM;
  const hasPiece=pieceType&&pieceColor;
  const isLifted=(iS||iPS)&&!isDragOrigin;
  // Coord label color: contrast against cell background
  const coordCol=bg.includes("e2e8f0")||bg.includes("f8fafc")||bg.includes("cbd5e1")||bg.includes("bfdbfe")||bg.includes("dcfce7")||bg.includes("fed7aa")||bg.includes("fef9c3")?"rgba(30,41,59,0.5)":"rgba(255,255,255,0.55)";
  // Snap-on-land: when isAnimDest flips true→false, the slide just landed —
  // briefly apply cc-piece-snap so the piece "settles" with a tiny bounce.
  const prevAnimDestRef=useRef(false);
  const[snapNonce,setSnapNonce]=useState(0);
  useEffect(()=>{
    if(prevAnimDestRef.current&&!isAnimDest){
      setSnapNonce(n=>n+1);
    }
    prevAnimDestRef.current=isAnimDest;
  },[isAnimDest]);
  // The inner piece div is keyed on snapNonce so a snap-trigger remounts it
  // and the cc-piece-snap class plays its animation once on the fresh element.
  const snapClass=snapNonce>0&&iL&&!iCk?"cc-piece-snap":"";
  return <div data-sq={sq}
    className={`cc-board-cell${iS||iPS?" cc-board-cell-selected":""}${iL?" cc-board-cell-lastmove":""}`}
    style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(40px,7.5vw,80px)",background:bg,cursor,position:"relative",lineHeight:1}}>
    {/* Lichess-style move dots и кольца захвата */}
    {(iV&&!hasPiece)||(iHover&&!iHoverCap&&!hasPiece)
      ?<div style={{width:"30%",height:"30%",borderRadius:"50%",background:"rgba(15,23,42,0.20)",position:"absolute",pointerEvents:"none",transition:"opacity 80ms"}}/>
      :null}
    {/* Кольцо захвата: iV&&hasPiece (clicked) или iHoverCap (hover) */}
    {((iV&&!!hasPiece)||iHoverCap)&&<div style={{position:"absolute",inset:0,borderRadius:"50%",boxShadow:"inset 0 0 0 clamp(3px,9%,9px) rgba(15,23,42,0.28)",pointerEvents:"none"}}/>}
    {hasPiece&&<div key={snapNonce} className={snapClass} style={{width:"88%",height:"88%",transform:"none",filter:isShadow?"drop-shadow(0 2px 3px rgba(0,0,0,0.25))":"drop-shadow(0 2px 3px rgba(0,0,0,0.35))",opacity:isDragOrigin||isAnimDest?0:(isShadow?0.55:1),transition:"opacity 100ms ease-out",animation:iCk?"cc-pulse-glow 1.2s ease-in-out infinite":undefined,borderRadius:iCk?"50%":undefined,pointerEvents:"none"}}><Piece type={pieceType} color={pieceColor}/></div>}
    {pmIdx!==undefined&&<div style={{position:"absolute",top:3,right:3,minWidth:18,height:18,padding:"0 5px",borderRadius:9,background:"#2563eb",color:"#fff",fontSize:11,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.4)",pointerEvents:"none",lineHeight:1,fontFamily:"monospace"}}>{pmIdx}</div>}
    {coordRank!==undefined&&<div style={{position:"absolute",top:"6%",left:"6%",fontSize:"clamp(8px,1.1vw,12px)",fontWeight:800,color:coordCol,pointerEvents:"none",lineHeight:1,userSelect:"none"}}>{coordRank}</div>}
    {coordFile&&<div style={{position:"absolute",bottom:"5%",right:"6%",fontSize:"clamp(8px,1.1vw,12px)",fontWeight:800,color:coordCol,pointerEvents:"none",lineHeight:1,userSelect:"none"}}>{coordFile}</div>}
  </div>;
});

/* ═══ Component ═══ */
export default function CyberChessPage(){
  const{showToast}=useToast();
  // Workspace preset (Focus / Standard / Stream / Study / Coach), keys 1..5.
  const _ws=useWorkspace();
  const wsPreset=_ws.preset; const sWsPreset=_ws.setPreset;
  const wsShowMedia=_ws.showMediaPane;
  const wsShowRight=_ws.showRightPanel;
  // SSR / hydration gate — все десятки state-init читают localStorage,
  // на сервере они дают defaults, на клиенте — реальные сохранения.
  // Без gate React детектит mismatch и регенерирует tree, ивент-хэндлеры
  // прыгают, ходы / премувы / drag не работают стабильно.
  const[mounted,sMounted]=useState(false);
  useEffect(()=>{sMounted(true)},[]);
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
  // Hover preview — показываем возможные ходы при наведении мыши (без клика, как у lichess).
  const[hoverSq,sHoverSq]=useState<Square|null>(null);
  const[hoverVm,sHoverVm]=useState<Set<string>>(new Set());
  const[lm,sLm]=useState<{from:string;to:string}|null>(null);
  const[over,sOver]=useState<string|null>(null);
  const[hist,sHist]=useState<string[]>([]);
  const[think,sThink]=useState(false);
  const[capW,sCapW]=useState<string[]>([]);
  const[capB,sCapB]=useState<string[]>([]);
  const[promo,sPromo]=useState<{from:Square;to:Square}|null>(null);
  const[pms,sPms]=useState<Pre[]>([]);
  const[pmSel,sPmSel]=useState<Square|null>(null);
  // Scratch / Analysis-during-play: отдельный Chess-инстанс для разбора
  // вариантов пока соперник думает. Real game нетронут; выход из scratch
  // возвращает к актуальной позиции.
  const[repertoire,sRepertoire]=useState<Repertoire>(()=>loadRepertoire());
  useEffect(()=>{saveRepertoire(repertoire)},[repertoire]);
  const[repertoireOpen,sRepertoireOpen]=useState(false);
  const[boardArt,sBoardArt]=useState<BoardArtId>(()=>{try{return(localStorage.getItem("aevion_chess_art_v1")||"off") as BoardArtId}catch{return"off"}});
  useEffect(()=>{try{localStorage.setItem("aevion_chess_art_v1",boardArt)}catch{}},[boardArt]);
  const[p2pMode,sP2pMode]=useState(false);
  const[p2pRoomId,sP2pRoomId]=useState("");
  const[p2pOpponentName,sP2pOpponentName]=useState("Оппонент");
  const[ghostDuelMode,sGhostDuelMode]=useState(false);
  const[ghostDuelConfig,sGhostDuelConfig]=useState<GhostDuelConfig|null>(null);
  const[ghostDuelDivergePly,sGhostDuelDivergePly]=useState<number|null>(null);
  const[scratchOn,sScratchOn]=useState(false);
  const[scratchGame,sScratchGame]=useState<Chess|null>(null);
  const[scratchHist,sScratchHist]=useState<string[]>([]);
  const[scratchBk,sScratchBk]=useState(0);
  void scratchBk;
  const[scratchSel,sScratchSel]=useState<Square|null>(null);
  const[scratchVm,sScratchVm]=useState<Set<string>>(new Set());
  const[scratchLm,sScratchLm]=useState<{from:string;to:string}|null>(null);
  const enterScratch=useCallback(()=>{
    try{const g=new Chess(game.fen());sScratchGame(g);sScratchHist([]);sScratchSel(null);sScratchVm(new Set());sScratchLm(null);sScratchOn(true);sScratchBk(k=>k+1)}catch{}
  },[game]);
  const resetScratch=useCallback(()=>{
    try{const g=new Chess(game.fen());sScratchGame(g);sScratchHist([]);sScratchSel(null);sScratchVm(new Set());sScratchLm(null);sScratchBk(k=>k+1)}catch{}
  },[game]);
  const exitScratch=useCallback(()=>{
    sScratchOn(false);sScratchGame(null);sScratchHist([]);sScratchSel(null);sScratchVm(new Set());sScratchLm(null);
  },[]);
  const pmsRef=useRef<Pre[]>([]);
  const pmSelRef=useRef<Square|null>(null);
  useEffect(()=>{pmsRef.current=pms},[pms]);
  useEffect(()=>{pmSelRef.current=pmSel},[pmSel]);
  // Refs mirroring sel/vm — read by useBoardInput priority logic.
  // Updated synchronously inside the hook when sSel/sVm are called from there,
  // so a fast follow-up click sees fresh state without waiting for re-render.
  // useEffect catches up external changes (exec, new game, etc).
  const selRef=useRef<Square|null>(null);
  const vmRef=useRef<Set<string>>(new Set());
  useEffect(()=>{selRef.current=sel},[sel]);
  useEffect(()=>{vmRef.current=vm},[vm]);
  const[pmLim,sPmLim]=useState(30);
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
  const[coachAIEnabled,sCoachAIEnabled]=useState(false);  // default off — user opts in via 🔮 button
  // Coach Quick-Actions remark — shown inline in the in-game panel after a quick-action.
  // null = nothing to show; { kind, title, body } = panel content.
  const[coachRemark,sCoachRemark]=useState<{kind:"plan"|"tactic"|"position"|"weakness"|"explain";title:string;body:string;hint?:string}|null>(null);
  // Move annotations — user-added symbols per ply index (0-based). Persists per-game via
  // a ref so it survives re-renders but resets on newG. Symbols: !! ! !? ?! ? ??
  const[moveAnnotations,sMoveAnnotations]=useState<Record<number,string>>({});
  // Annotation picker popup state
  const[annotPicker,sAnnotPicker]=useState<{ply:number;x:number;y:number}|null>(null);
  const ANNOT_SYMS=[{s:"!!",c:"#10b981",t:"Блестящий"},{"s":"!",c:"#22c55e",t:"Хороший"},{"s":"!?",c:"#f59e0b",t:"Интересный"},{"s":"?!",c:"#f97316",t:"Сомнительный"},{"s":"?",c:"#ef4444",t:"Ошибка"},{"s":"??",c:"#dc2626",t:"Зевок"}];

  // Time-per-move tracker — milliseconds spent per ply for time-management analytics.
  // Reset on newG; appended on each move via execTime(). Index aligns with hist.
  const moveTimesRef=useRef<number[]>([]);
  const lastMoveStartRef=useRef<number>(Date.now());
  const[moveTimes,sMoveTimes]=useState<number[]>([]);
  // F2-phase: AEVION CPI per-move metrics collector. Pure data, no UI.
  // Filled on each successful exec(), drained on game-end into applyGameToCPI().
  // engineTop3 currently uses a minimal heuristic (live evalCp scalar); F2-phase-2
  // will swap in real multiPV=3 output from the Stockfish worker.
  const metricsRef=useRef(new MetricsCollector());
  const cpiAppliedRef=useRef<string|null>(null);
  const prevEvalCpForCpiRef=useRef<number>(0);
  const gameStartTimeRef=useRef<number>(Date.now());
  // Coach Chat — conversational AI tutor with current position as context.
  // Messages: { role, content }. Sent to /api/coach/chat with a coach system prompt.
  type CoachMsg={role:"user"|"assistant";content:string;ts:number};
  // Coach chat persistence — restore last session's conversation from localStorage
  const COACH_CHAT_KEY="aevion_coach_chat_v2";
  function ldCoachChat():CoachMsg[]{
    try{const raw=localStorage.getItem(COACH_CHAT_KEY);if(!raw)return[];const d=JSON.parse(raw);
    // Keep only last 7 days
    const cutoff=Date.now()-7*86_400_000;
    return Array.isArray(d)?d.filter((m:CoachMsg)=>m.ts>cutoff):[];}catch{return[]}
  }
  const[coachChat,sCoachChat]=useState<CoachMsg[]>(()=>typeof window!=="undefined"?ldCoachChat():[]);
  useEffect(()=>{try{localStorage.setItem(COACH_CHAT_KEY,JSON.stringify(coachChat.slice(-50)))}catch{}},[coachChat]);
  const[coachChatInput,sCoachChatInput]=useState("");
  const[coachChatLoading,sCoachChatLoading]=useState(false);
  const coachChatScrollRef=useRef<HTMLDivElement|null>(null);
  // Coach prefill — when puzzle page triggers "🎓 Coach →" we queue a question here
  const[coachPrefillQ,sCoachPrefillQ]=useState<string|null>(null);
  // Auto-scroll chat to bottom on new message
  useEffect(()=>{
    const el=coachChatScrollRef.current;
    if(el)el.scrollTop=el.scrollHeight;
  },[coachChat,coachChatLoading]);
  const[showKnowledge,sShowKnowledge]=useState(false);
  const[showFlashcards,sShowFlashcards]=useState(false);
  const[flashcardIdx,sFlashcardIdx]=useState(0);
  const[flashcardFlipped,sFlashcardFlipped]=useState(false);
  const[dailyReward,sDailyReward]=useState<{bonus:number;streak:number;isWelcome:boolean}|null>(null);
  const[showLessons,sShowLessons]=useState(false);
  // Active lesson tracking — when user loads a position from a lesson step, show a sticky
  // "return to lesson" banner at the top of the board. Stores {lessonId, step, lessonTitle}.
  const[activeLesson,sActiveLesson]=useState<{id:string;step:number;title:string;emoji:string}|null>(null);
  const[coachLevel,sCoachLevel]=useState<"beginner"|"intermediate"|"advanced">("intermediate");
  const[coachTipsExpanded,sCoachTipsExpanded]=useState(false);
  // Puzzle theme performance — track correct/wrong per theme
  const TP_KEY="aevion_pz_theme_perf_v1";
  type ThemePerf=Record<string,{c:number;w:number}>;
  const[themePerf,sThemePerf]=useState<ThemePerf>(()=>{try{const r=localStorage.getItem(TP_KEY);return r?JSON.parse(r):{}}catch{return{}}});
  useEffect(()=>{try{localStorage.setItem(TP_KEY,JSON.stringify(themePerf))}catch{}},[themePerf]);
  const addThemeResult=(theme:string,correct:boolean)=>sThemePerf(p=>({...p,[theme]:{c:(p[theme]?.c||0)+(correct?1:0),w:(p[theme]?.w||0)+(correct?0:1)}}));

  // Blunder Book — positions where user blundered, for later practice
  type BlunderEntry={fen:string;san:string;date:string;opening?:string;moveNum:number};
  const BB_KEY="aevion_blunder_book_v1";
  const[blunderBook,sBlunderBook]=useState<BlunderEntry[]>(()=>{
    try{const raw=localStorage.getItem(BB_KEY);return raw?JSON.parse(raw):[];}catch{return[];}
  });
  useEffect(()=>{try{localStorage.setItem(BB_KEY,JSON.stringify(blunderBook.slice(0,50)))}catch{}},[blunderBook]);
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
  // totalGames at component scope for daily goals tracking
  const totalGames=sts.w+sts.l+sts.d;
  const[evalCp,sEvalCp]=useState(0);
  const[evalMate,sEvalMate]=useState(0);
  // F2-phase-2: live Stockfish search depth — pushed by the SF info-parser through
  // the ecb callback (3rd arg). Displayed as a small "d18/35" badge next to evalCp
  // so users can see progressive deepening in real time.
  const[evalDepth,sEvalDepth]=useState(0);
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
  // Library v2: full-text search across opening + AI level + result + sort modes
  const[gamesSearch,sGamesSearch]=useState<string>("");
  const[gamesSort,sGamesSort]=useState<"date"|"rating"|"length"|"result">("date");
  const[gamesResult,sGamesResult]=useState<"all"|"win"|"loss"|"draw">("all");
  const[analysis,sAnalysis]=useState<{move:number;cp:number;mate:number;quality:"great"|"good"|"inacc"|"mistake"|"blunder"}[]>([]);
  const[showAnal,sShowAnal]=useState(false);
  const[browseIdx,sBrowseIdx]=useState(-1); // -1 = live position, 0+ = viewing that move
  // Hover-scrub: when user hovers a move in the move list, board previews that position
  // without disturbing the canonical browseIdx. previewIdx===null = no preview active.
  const[previewIdx,sPreviewIdx]=useState<number|null>(null);
  // Live rating-delta chip — fires when `rat` changes; floats top-right for ~3.5s.
  // Tracks the previous rating so we can compute the signed delta (+/- N).
  const[ratDelta,sRatDelta]=useState<{d:number;newRat:number;ts:number}|null>(null);
  const ratPrevRef=useRef<number|null>(null);
  // Lichess Daily Puzzle — fetched once per day via public API; cached for instant reload.
  const[lichessLoading,sLichessLoading]=useState(false);
  // Command palette (Ctrl/Cmd+K) — fuzzy-search any action without hunting menus.
  const[palOpen,sPalOpen]=useState(false);
  // Position bookmarks — saved FENs the user wants to revisit. Loaded once on mount.
  const[bookmarks,sBookmarks]=useState<Bookmark[]>([]);
  useEffect(()=>{sBookmarks(loadBookmarks())},[]);
  const[PUZZLES,sPuzzles]=useState<Puzzle[]>([]);
  // Puzzle system
  const[pzMode,sPzMode]=useState<"learn"|"timed3"|"timed5"|"rush"|"custom">("learn");
  const[pzCustomSec,sPzCustomSec]=useState<number>(()=>{try{const v=parseInt(localStorage.getItem("aevion_pz_custom_sec_v1")||"600");return isNaN(v)||v<30||v>3600?600:v}catch{return 600}});
  useEffect(()=>{try{localStorage.setItem("aevion_pz_custom_sec_v1",String(pzCustomSec))}catch{}},[pzCustomSec]);
  const[pzTimeLeft,sPzTimeLeft]=useState(0);
  const[pzAttempt,sPzAttempt]=useState<"idle"|"wrong"|"correct"|"shown">("idle");
  const[pzCurrent,sPzCurrent]=useState<Puzzle|null>(null);
  const[pzSolvedCount,sPzSolvedCount]=useState(0);
  const[pzFailedCount,sPzFailedCount]=useState(0);
  // Cross-session puzzle streak — persisted in localStorage
  const PZ_STREAK_KEY="aevion_pz_streak_v1";
  const[pzStreak,sPzStreak]=useState<{cur:number;best:number}>(()=>{try{const v=JSON.parse(localStorage.getItem(PZ_STREAK_KEY)||"{}");return{cur:v.cur??0,best:v.best??0}}catch{return{cur:0,best:0}}});
  const savePzStreak=(s:{cur:number;best:number})=>{try{localStorage.setItem(PZ_STREAK_KEY,JSON.stringify(s))}catch{}};
  const incPzStreak=()=>sPzStreak(s=>{const n=s.cur+1;const nb=Math.max(s.best,n);const ns={cur:n,best:nb};savePzStreak(ns);return ns});
  const resetPzStreak=()=>sPzStreak(s=>{if(chessy.owned.streak_shield&&s.cur>=3){sChessy(c=>({...c,owned:{...c.owned,streak_shield:false}}));showToast("🛡 Щит стрика поглотил ошибку!","success");return s;}const ns={cur:0,best:s.best};savePzStreak(ns);return ns});
  // Daily goals tracking — stored by todayKey() in localStorage
  const DG_KEY="aevion_daily_goals_v1";
  const[dailyGoals,sDailyGoals]=useState<{coachOpened:boolean;gamesGoal:number;puzzleGoal:number;date:string}>(()=>{
    const today=todayKey();
    try{const raw=localStorage.getItem(DG_KEY);if(raw){const d=JSON.parse(raw);if(d?.date===today)return d;}}catch{}
    return{coachOpened:false,gamesGoal:5,puzzleGoal:5,date:today};
  });
  useEffect(()=>{try{localStorage.setItem(DG_KEY,JSON.stringify(dailyGoals))}catch{}},[dailyGoals]);
  // Puzzle Rush state
  const[rushActive,sRushActive]=useState(false);
  const[rushScore,sRushScore]=useState(0);
  const[rushStreak,sRushStreak]=useState(0);
  const[rushBestStreak,sRushBestStreak]=useState(0);
  const[rushBest,sRushBest]=useState(()=>{try{return parseInt(localStorage.getItem("aevion_puzzle_rush_best_v1")||"0")||0}catch{return 0}});
  const[rushResult,sRushResult]=useState<null|{score:number;streak:number;best:number;chessy:number;isNewBest:boolean}>(null);
  // Timed mode (3min/5min/custom) session result — separate from Rush
  const[timedResult,sTimedResult]=useState<null|{solved:number;failed:number;mode:string;totalSec:number}>(null);
  // Rush duration в секундах — юзер сам выбирает 1.5 / 3 / 5 / 10 / custom
  const[rushDuration,sRushDuration]=useState<number>(()=>{try{const v=parseInt(localStorage.getItem("aevion_rush_duration_v1")||"180");return v>=30&&v<=1800?v:180}catch{return 180}});
  useEffect(()=>{try{localStorage.setItem("aevion_rush_duration_v1",String(rushDuration))}catch{}},[rushDuration]);
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
  const[showSettings,sShowSettings]=useState(false);
  const[showMusicPlayer,sShowMusicPlayer]=useState(false);
  // Color theme (light/dark) — separate from boardTheme. Persists to localStorage
  // key aevion_chess_color_theme_v1. The shadowed `CC` const below switches the
  // entire palette at render time; all ~720 CC.* references pick it up automatically.
  // Default: dark (как lichess). Пользователь переключает в Settings.
  const[themeMode,sThemeMode]=useState<"light"|"dark">(()=>{try{const v=localStorage.getItem("aevion_chess_color_theme_v1");return v==="light"?"light":"dark"}catch{return"dark"}});
  useEffect(()=>{try{localStorage.setItem("aevion_chess_color_theme_v1",themeMode)}catch{}},[themeMode]);
  // Active palette — shadows the imported CC_LIGHT so every existing CC.* lookup
  // in this component reads the active theme. Top-level helpers above the
  // component still see CC_LIGHT via the import alias (kept for backwards compat
  // of any module-scoped colors, though currently none use CC.* outside the fn).
  const CC = themeMode==="dark" ? CC_DARK : CC_LIGHT;
  // Apply body background so chrome around <main> matches the active theme.
  useEffect(()=>{
    if(typeof document==="undefined")return;
    const prev=document.body.style.background;
    document.body.style.background=themeMode==="dark"?CC_DARK.bg:CC_LIGHT.bg;
    return()=>{document.body.style.background=prev};
  },[themeMode]);
  // Текущий звуковой пресет (40 пресетов + молчание). Сохраняется в localStorage.
  const[soundPresetId,sSoundPresetId]=useState<string>(()=>loadSoundPreset());
  useEffect(()=>{saveSoundPreset(soundPresetId)},[soundPresetId]);
  // Auto-queen: при превращении пешки сразу ставится ферзь без модалки. По умолчанию ВКЛ —
  // в bullet/blitz/premove'ах модалка ломает темп. Кому надо underpromotion — выключит.
  const[autoQueen,sAutoQueen]=useState(()=>{try{return localStorage.getItem("aevion_chess_autoqueen_v1")!=="0"}catch{return true}});
  useEffect(()=>{try{localStorage.setItem("aevion_chess_autoqueen_v1",autoQueen?"1":"0")}catch{}},[autoQueen]);
  // F2 phase-3 — Stockfish analysis depth для CPI/metrics recall. 18 = быстро (по умолчанию),
  // 25 = точнее, 30 = максимум. Влияет только на recordMoveWithMultiPV и top-3 metrics —
  // не на playing strength AI противника (тот настраивается отдельно через Skill Level).
  const[sfDepth,sSfDepth]=useState<number>(()=>{try{const v=parseInt(localStorage.getItem("aevion_chess_sf_depth_v1")||"18");return v>=12&&v<=40?v:18}catch{return 18}});
  useEffect(()=>{try{localStorage.setItem("aevion_chess_sf_depth_v1",String(sfDepth))}catch{}},[sfDepth]);
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
  // Premium tier helpers — Pro and Ultimate are mutually-additive: Ultimate implies Pro,
  // so most gates check `isPro` (= pro OR ultimate). `isUltimate` is for tier-only perks.
  const isPro=!!chessy.owned.pro||!!chessy.owned.ultimate;
  const isUltimate=!!chessy.owned.ultimate;
  const[showShop,sShowShop]=useState(false);
  // QPayNet payment-request flow for Chessy Pro/Ultimate tiers (see ./billing.ts)
  const[billingPending,sBillingPending]=useState<null|{tier:ChessyTier;tierName:string;requestId:string;token:string;payUrl:string;busy:boolean}>(null);
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
  // Variant tutorial overlay — shown ONCE per variant on first launch (vs the prior subtle toast).
  // Tracks dismissed variants in localStorage so repeated plays don't re-show the modal.
  const[variantTutorialFor,sVariantTutorialFor]=useState<VariantId|null>(null);
  const[seenVariantTutorials,sSeenVariantTutorials]=useState<Set<string>>(()=>{
    if(typeof window==="undefined")return new Set();
    try{const r=localStorage.getItem("aevion_variant_tutorial_seen_v1");return new Set(r?JSON.parse(r):[])}catch{return new Set()}
  });
  useEffect(()=>{try{localStorage.setItem("aevion_variant_tutorial_seen_v1",JSON.stringify(Array.from(seenVariantTutorials)))}catch{}},[seenVariantTutorials]);
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
  const[showOnboarding,sShowOnboarding]=useState<boolean>(false);
  const[dueReminders,sDueReminders]=useState<Array<{entryId:string;milestone:1|3|7;daysSinceStudy:number}>>([]);
  const[hotseat,sHotseat]=useState(false);
  const[showEndgames,sShowEndgames]=useState(false);
  const[currentEndgame,sCurrentEndgame]=useState<Endgame|null>(null);
  const[streamerMode,sStreamerMode]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem("aevion_streamer_v1")==="1"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("aevion_streamer_v1",streamerMode?"1":"0")}catch{}},[streamerMode]);
  const streamerToolbarRef=useRef<{showYT:()=>void;showTW:()=>void;ytVisible:boolean;twVisible:boolean}|null>(null);
  const activePieceSet=useActivePieceSet();
  // Threat Heatmap (killer #12) — overlay контроля доски, нет ни у chess.com, ни у lichess
  const[showThreatMap,sShowThreatMap]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem("aevion_threatmap_v1")==="1"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("aevion_threatmap_v1",showThreatMap?"1":"0")}catch{}},[showThreatMap]);
  // Coordinates Trainer (killer #13)
  const[showCoord,sShowCoord]=useState(false);
  const[coordSession,sCoordSession]=useState<CoordSession|null>(null);
  const[coordResult,sCoordResult]=useState<CoordResult|null>(null);
  const[coordLB,sCoordLB]=useState<CoordLeaderboardEntry[]>([]);
  const[coordTick,sCoordTick]=useState(0); // forces re-render for timer
  const[coordFlash,sCoordFlash]=useState<{sq:string;ok:boolean;ts:number}|null>(null);
  // Personality Quiz (killer #14)
  const[showQuiz,sShowQuiz]=useState(false);
  const[quizAnswers,sQuizAnswers]=useState<number[]>([]);
  const[quizResult,sQuizResult]=useState<QuizResult|null>(null);
  const[savedQuizResult,sSavedQuizResult]=useState<{ts:number;result:QuizResult}|null>(()=>(typeof window!=="undefined"?ldQuizResult():null));
  // Board Editor (killer #15)
  const[showEditor,sShowEditor]=useState(false);
  const[editorBoard,sEditorBoard]=useState<EditorBoard>(()=>edStart());
  const[editorSide,sEditorSide]=useState<"w"|"b">("w");
  const[editorPalette,sEditorPalette]=useState<{type:"p"|"n"|"b"|"r"|"q"|"k"|"erase";color:"w"|"b"}>({type:"p",color:"w"});
  const[editorErrors,sEditorErrors]=useState<string[]>([]);
  // Insights v2 (killer #16)
  const[showInsights,sShowInsights]=useState(false);
  // Master Games (killer #17)
  const[showMasters,sShowMasters]=useState(false);
  const[lbExpanded,sLbExpanded]=useState<LbCategory|null>(null);
  const[showMultiPanel,sShowMultiPanel]=useState(false);
  // PiP — floating Picture-in-Picture для YouTube/Twitch стримов поверх доски.
  // Hook возвращает: open (bool), source (PiPSource|null), show(), hide(), toggle()
  const pip = useWorkspacePiP();
  // PiP UX polish: pulsing "variant-of-day stream?" suggestion. Dismissed by user
  // clicking either the open-stream CTA or the × button; remembered per-day so we
  // don't nag (key includes ISO date YYYY-MM-DD).
  const[pipSuggestDismissed,sPipSuggestDismissed]=useState(false);
  // Auto-restore previous PiP session on mount. WorkspacePiP itself persists the
  // source to localStorage; we hydrate the same key here and call pip.show() once
  // so the floating window reappears in the same state as last visit.
  const pipAutoRestoredRef=useRef(false);
  useEffect(()=>{
    if(pipAutoRestoredRef.current)return;
    pipAutoRestoredRef.current=true;
    if(typeof window==="undefined")return;
    try{
      const raw=localStorage.getItem("aevion_cyberchess_pip_src_v1");
      if(!raw)return;
      const j=JSON.parse(raw);
      if(j&&j.kind&&j.url)pip.show(j as {kind:"youtube"|"twitch"|"url";url:string;title?:string});
    }catch{/* ignore — first visit or corrupt storage */}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Variant-of-day → suggested-stream pulse. Only show when:
  //   - we have a daily variant info today
  //   - PiP is currently closed
  //   - user hasn't dismissed the suggestion today
  const todayIso=new Date().toISOString().slice(0,10);
  const pipDismissKey=`aevion_cyberchess_pip_suggest_dismissed_${todayIso}`;
  useEffect(()=>{
    if(typeof window==="undefined")return;
    try{if(localStorage.getItem(pipDismissKey)==="1")sPipSuggestDismissed(true)}catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const showPipSuggest=!pip.open&&!pipSuggestDismissed&&!!dailyVariantInfo&&!dailyVariantInfo.played;
  const dismissPipSuggest=useCallback(()=>{
    sPipSuggestDismissed(true);
    try{localStorage.setItem(pipDismissKey,"1")}catch{}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pipDismissKey]);
  // Активная "дашборд-плитка" (3 крупные карточки на лендинге).
  // play = варианты/режимы партии · learn = тренажёры · meta = аналитика+стрим.
  const[activeDash,sActiveDash]=useState<"play"|"learn"|"meta"|null>(null);
  const[masterCurrent,sMasterCurrent]=useState<MasterGame|null>(null);
  const[masterPly,sMasterPly]=useState(0);
  const[masterMode,sMasterMode]=useState<"replay"|"guess">("replay");
  const[masterGuessInput,sMasterGuessInput]=useState("");
  const[masterGuessFeedback,sMasterGuessFeedback]=useState<{correct:boolean;actual:string;guess:string}|null>(null);
  const[masterStats,sMasterStats]=useState<{hits:number;misses:number}>({hits:0,misses:0});
  const[masterVoice,sMasterVoice]=useState(()=>{try{return typeof window!=="undefined"&&localStorage.getItem("aevion_master_voice_v1")==="1"}catch{return false}});
  useEffect(()=>{try{localStorage.setItem("aevion_master_voice_v1",masterVoice?"1":"0")}catch{}},[masterVoice]);
  const lastSpokenPlyRef=useRef<string>("");
  useEffect(()=>{
    if(!masterVoice||!masterCurrent||!showMasters)return;
    if(typeof window==="undefined"||!window.speechSynthesis)return;
    const key=`${masterCurrent.id}#${masterPly}`;
    if(lastSpokenPlyRef.current===key)return;
    lastSpokenPlyRef.current=key;
    const text=masterPly===0?masterCurrent.blurb:(masterCurrent.notes[masterPly-1]||masterCurrent.notes[masterPly]);
    if(!text)return;
    try{
      const utt=new SpeechSynthesisUtterance(text);
      utt.lang="ru-RU";utt.rate=1.05;utt.volume=0.85;utt.pitch=1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utt);
    }catch{}
  },[masterVoice,masterCurrent,masterPly,showMasters]);
  // Stop master TTS as soon as the modal closes — otherwise queued utterances keep talking.
  useEffect(()=>{
    if(showMasters)return;
    if(typeof window==="undefined"||!window.speechSynthesis)return;
    try{window.speechSynthesis.cancel()}catch{}
    lastSpokenPlyRef.current="";
  },[showMasters]);
  // Opening Explorer (killer #18)
  const[showOpeningExp,sShowOpeningExp]=useState(()=>{try{const v=localStorage.getItem("aevion_opening_exp_v1");return v===null?true:v==="1"}catch{return true}});
  useEffect(()=>{try{localStorage.setItem("aevion_opening_exp_v1",showOpeningExp?"1":"0")}catch{}},[showOpeningExp]);
  const[openingData,sOpeningData]=useState<OpeningEntry|null>(null);
  const[openingLoading,sOpeningLoading]=useState(false);
  // Endgame Tablebase (killer #19)
  const[tbData,sTbData]=useState<TablebaseEntry|null>(null);
  const[tbLoading,sTbLoading]=useState(false);
  useEffect(()=>{svChessy(chessy)},[chessy]);
  const[chessyFloat,sChessyFloat]=useState<{amount:number;key:number}|null>(null);
  const[showConfetti,sShowConfetti]=useState(false);
  const lastWinKeyRef=useRef<string|null>(null);
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
  // Coord trainer tick (defined here so addChessy is in scope)
  useEffect(()=>{
    if(!coordSession||coordResult)return;
    const id=setInterval(()=>{
      sCoordTick(x=>x+1);
      if(coordExpired(coordSession)){
        const res=coordSummarize(coordSession);
        sCoordResult(res);
        sCoordLB(coordSaveLB(res));
        const rank=coordRank(res.score);
        addChessy(rank.reward,`Coord: ${rank.title}`);
        clearInterval(id);
      }
    },100);
    return()=>clearInterval(id);
  },[coordSession,coordResult,addChessy]);
  // Clipboard auto-load (Ctrl+V) — works in Analysis OR on the home setup screen.
  // Three input formats handled, in priority order:
  //   1. Lichess game URL (https://lichess.org/abc12345 or with /white|/black/orient suffix) →
  //      fetches the PGN from the public export endpoint and loads it.
  //   2. FEN (single line, 6 space-separated fields, last is move number).
  //   3. PGN (has [Header] tags or SAN moves).
  // Skipped while typing in input/textarea/contentEditable.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    const loadPgnText=(txt:string)=>{
      try{
        const ch=new Chess();
        ch.loadPgn(txt);
        const moves=ch.history();
        if(moves.length<2)return false;
        const replay=new Chess();
        const fens=[replay.fen()];
        for(const san of moves){replay.move(san);fens.push(replay.fen())}
        setGame(replay);sBk(k=>k+1);sHist(moves);sFenHist(fens);sLm(null);sSel(null);sVm(new Set());sOver(null);sOn(false);sSetup(false);sTab("analysis");sBrowseIdx(-1);
        return true;
      }catch{return false}
    };
    const handler=(e:ClipboardEvent)=>{
      // Allow on analysis tab OR on the home setup screen — anywhere user might paste.
      const allowedTab=tab==="analysis"||(tab==="play"&&setup);
      if(!allowedTab)return;
      const tgt=e.target as HTMLElement|null;
      const tag=tgt?.tagName?.toLowerCase()||"";
      if(tag==="input"||tag==="textarea"||tgt?.isContentEditable)return;
      const txt=(e.clipboardData?.getData("text/plain")||"").trim();
      if(!txt||txt.length<6)return;

      // ── 1. Lichess game URL — fetch PGN and load
      const liMatch=txt.match(/lichess\.org\/([a-zA-Z0-9]{8})(?:[a-zA-Z0-9]{4})?/);
      if(liMatch){
        const gameId=liMatch[1];
        e.preventDefault();
        showToast(`⏳ Загружаю партию ${gameId} с Lichess…`,"info");
        fetch(`https://lichess.org/game/export/${gameId}?moves=true&clocks=false&evals=false&opening=true`,{
          headers:{Accept:"application/x-chess-pgn"}
        }).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}).then(pgn=>{
          if(!loadPgnText(pgn)){showToast("PGN загружен, но позиций мало","error");return}
          showToast(`📋 Партия ${gameId} загружена в Анализ`,"success");
        }).catch(err=>showToast(`Lichess: ${err?.message||"не найдено"}`,"error"));
        return;
      }

      // ── 2. FEN detection
      const oneLine=txt.split(/\r?\n/).find(l=>l.trim().length>=10);
      if(oneLine){
        const parts=oneLine.trim().split(/\s+/);
        if(parts.length===6&&/^[1-9]\d*$/.test(parts[5])&&parts[0].split("/").length===8){
          try{
            const ch=new Chess(oneLine.trim());
            setGame(ch);sBk(k=>k+1);sHist([]);sFenHist([ch.fen()]);sLm(null);sSel(null);sVm(new Set());sOver(null);sOn(false);sSetup(false);sTab("analysis");sBrowseIdx(-1);sPCol(ch.turn());sFlip(ch.turn()==="b");
            showToast("📋 FEN загружен из буфера","success");
            e.preventDefault();
            return;
          }catch{}
        }
      }

      // ── 3. PGN detection
      if(!/\b[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8]/.test(txt)&&!/\[\w+\s+"/.test(txt))return;
      if(loadPgnText(txt)){
        const moveCount=new Chess();try{moveCount.loadPgn(txt);showToast(`📋 PGN загружен: ${moveCount.history().length} ходов`,"success")}catch{showToast("📋 PGN загружен","success")}
        e.preventDefault();
      }
    };
    window.addEventListener("paste",handler);
    return()=>window.removeEventListener("paste",handler);
  },[tab,setup,showToast]);

  // Onboarding hint — fires once for new users to surface the Command Palette.
  // Localstorage-gated so it never shows twice. Delayed so it doesn't compete
  // with the welcome toast on first visit.
  useEffect(()=>{
    if(typeof window==="undefined")return;
    try{
      if(localStorage.getItem("aevion_chess_palette_hint_v1")==="1")return;
      const t=window.setTimeout(()=>{
        showToast("⌕ Жми Ctrl+K чтобы найти любую команду — игру, пазл, анализ, стрим…","info");
        try{localStorage.setItem("aevion_chess_palette_hint_v1","1")}catch{}
      },2400);
      return()=>window.clearTimeout(t);
    }catch{}
  },[showToast]);
  // Opening Explorer + Tablebase: fetch when on Analysis tab + position changes
  useEffect(()=>{
    if(tab!=="analysis"||!showOpeningExp){sOpeningData(null);return}
    const fen=game.fen();
    sOpeningLoading(true);
    const ac=new AbortController();
    fetchOpening(fen,ac.signal).then(d=>{sOpeningData(d);sOpeningLoading(false)}).catch(()=>sOpeningLoading(false));
    return()=>ac.abort();
  },[tab,bk,showOpeningExp]);
  useEffect(()=>{
    if(tab!=="analysis"){sTbData(null);return}
    const fen=game.fen();
    if(!isTablebaseEligible(fen)){sTbData(null);return}
    sTbLoading(true);
    const ac=new AbortController();
    fetchTablebase(fen,ac.signal).then(d=>{sTbData(d);sTbLoading(false)}).catch(()=>sTbLoading(false));
    return()=>ac.abort();
  },[tab,bk]);

  const tc:TC=useCustom?{name:`${customMin}+${customInc}`,ini:customMin*60,inc:customInc,cat:customMin<3?"Bullet":customMin<8?"Blitz":customMin<20?"Rapid":"Classical"}:TCS[tcI];
  const lv=ALS[aiI],rk=gRank(rat);
  const aiC:ChessColor=pCol==="w"?"b":"w",myT=game.turn()===pCol,chk=game.isCheck(),useSF=aiI>=3;
  const pT=useTimer(tc.ini,tc.inc,on&&myT&&!over&&tc.ini>0,()=>{sOver("Time out");snd("x")});
  const aT=useTimer(tc.ini,tc.inc,on&&!myT&&!over&&tc.ini>0,()=>{sOver("AI timed out — you win!");snd("x")});
  // "Your turn" board glow — fires for ~700ms when AI just moved.
  // Suppressed during hotseat/p2p (those use other cues), and on first myT.
  const prevMyTRef=useRef(myT);
  const[turnFlashKey,sTurnFlashKey]=useState(0);
  useEffect(()=>{
    if(!prevMyTRef.current&&myT&&on&&!over&&!hotseat){
      sTurnFlashKey(k=>k+1);
    }
    prevMyTRef.current=myT;
  },[myT,on,over,hotseat]);
  const hR=useRef<HTMLDivElement>(null),sfR=useRef<SF|null>(null);
  const moveListScrollRef=useRef<HTMLDivElement>(null);
  // Hover-scrub snapshot — captured FEN+browseIdx at the moment hover started; restored on leave.
  // Click clears it so the new state isn't reverted by the trailing mouseleave.
  const hoverSnapRef=useRef<{fen:string;idx:number}|null>(null);
  const previewLeaveTimer=useRef<number|null>(null);
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
      // Quick-share FEN: ?fen=... loads the position into Analysis tab.
      // Companion to the S hotkey which generates these URLs.
      // Return from /bank purchase: ?paid=pro|ultimate → activate tier
      const paid=params.get("paid");
      if(paid==="pro"||paid==="ultimate"){
        sChessy(c=>({...c,owned:{...c.owned,[paid]:true}}));
        setTimeout(()=>{
          showToast(`✨ ${paid==="ultimate"?"Ultimate":"Pro"} активирован! Добро пожаловать в ${paid==="ultimate"?"Ultimate":"Pro"}`,"success");
          sShowShop(true); // show shop so user sees their new tier
        },600);
        // Clean URL param so refresh doesn't re-activate
        try{const u=new URL(window.location.href);u.searchParams.delete("paid");u.searchParams.delete("amount");window.history.replaceState({},"",u.pathname+u.search);}catch{}
      }
      const fenParam=params.get("fen");
      if(fenParam){
        try{
          const ch=new Chess(decodeURIComponent(fenParam));
          setGame(ch);sBk(k=>k+1);sHist([]);sFenHist([ch.fen()]);sOn(false);sSetup(false);sTab("analysis");sBrowseIdx(-1);sLm(null);sSel(null);sVm(new Set());sPCol(ch.turn());sFlip(ch.turn()==="b");
          setTimeout(()=>showToast("▣ Открыта позиция из ссылки","info"),300);
          return;
        }catch{showToast("Невалидный FEN в ссылке","error");return}
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

  // Live rating-delta chip — animates floating chip whenever `rat` changes.
  // Skips first set (initial load from localStorage) using ratPrevRef===null guard.
  useEffect(()=>{
    if(ratPrevRef.current===null){ratPrevRef.current=rat;return;}
    const d=rat-ratPrevRef.current;
    ratPrevRef.current=rat;
    if(d===0)return;
    sRatDelta({d,newRat:rat,ts:Date.now()});
    const t=window.setTimeout(()=>sRatDelta(null),3800);
    return()=>window.clearTimeout(t);
  },[rat]);

  // Command palette toggle (Ctrl/Cmd+K) — works even from inside inputs (esc clears).
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&(e.key==="k"||e.key==="K")){
        e.preventDefault();
        sPalOpen(o=>!o);
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[]);

  useEffect(()=>{sRat(ldR());sSts(ldS());sSavedGames(loadGames());
    const rs=loadResume();if(rs&&rs.hist.length>0)sResumeOffer(rs);
    // Chessy welcome + daily bonus + first-time tour
    const c=ldChessy();const tk=todayKey();
    let tourSeen=false;try{tourSeen=localStorage.getItem("aevion_tour_seen_v1")==="1"}catch{}
    // First-time onboarding overlay (3-step color/AI/time choice) — runs BEFORE tour.
    if(!hasCompletedOnboarding())setTimeout(()=>sShowOnboarding(true),400);
    if(!c.welcome){
      sChessy(x=>({...x,balance:x.balance+50,lifetime:x.lifetime+50,welcome:true,lastDaily:tk,streak:1}));
      setTimeout(()=>sDailyReward({bonus:50,streak:1,isWelcome:true}),800);
      if(!tourSeen)setTimeout(()=>sTourStep(0),2200);
    }else if(c.lastDaily!==tk){
      // Compute streak: consecutive days? Simple check — yesterday continues, else reset to 1
      const y=new Date();y.setDate(y.getDate()-1);const yk=`${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;
      const newStreak=c.lastDaily===yk?c.streak+1:1;
      const bonus=newStreak>=14?200:newStreak>=7?100:newStreak>=3?30:5;
      sChessy(x=>({...x,balance:x.balance+bonus,lifetime:x.lifetime+bonus,lastDaily:tk,streak:newStreak}));
      setTimeout(()=>sDailyReward({bonus,streak:newStreak,isWelcome:false}),800);
    }
    // Coach SR — surface due review reminders (1/3/7-day milestones).
    try{const due=getDueReminders();if(due.length>0)sDueReminders(due)}catch{}
    // Bundled puzzles — грузим сразу (нужно для Daily puzzle и Quick Puzzle на главной).
    // Cloud API extension убрана из mount — зовём lazy только когда пользователь
    // открывает Puzzle tab (см. отдельный useEffect ниже).
    fetch("/puzzles.json").then(r=>r.json()).then((d:Puzzle[])=>sPuzzles(d)).catch(()=>sPuzzles([]));
    // Openings DB — defer в idle/setTimeout чтобы не блокировать первый рендер.
    const loadOpenings=()=>{
      fetch("/openings.json").then(r=>r.json()).then((d:Opening[])=>{
        const map=new Map<string,OpeningIndexed>();const indexed:OpeningIndexed[]=[];
        for(const op of d){try{
          const g=new Chess();const uciList=op.moves.trim().split(/\s+/);
          for(const uci of uciList){if(uci.length<4)continue;g.move({from:uci.slice(0,2) as Square,to:uci.slice(2,4) as Square,promotion:uci.length>4?uci[4] as any:undefined});}
          const parts=g.fen().split(" ");const fenKey=`${parts[0]} ${parts[1]} ${parts[2]}`;
          const entry:OpeningIndexed={...op,fenKey,plyLen:uciList.length};indexed.push(entry);
          const existing=map.get(fenKey);if(!existing||existing.plyLen<entry.plyLen)map.set(fenKey,entry);
        }catch{}}
        openingMapRef.current=map;sOpeningsDb(indexed);
      }).catch(()=>sOpeningsDb([]));
    };
    if(typeof window!=="undefined"&&"requestIdleCallback" in window){
      (window as any).requestIdleCallback(loadOpenings,{timeout:6000});
    }else{setTimeout(loadOpenings,2000);}
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
  // Lazy Stockfish init: грузим WASM только когда пользователь начинает играть или
  // открывает Analysis/Coach. На setup screen Stockfish не нужен.
  function ensureSF(){
    if(sfR.current)return;
    const s=new SF();s.init();sfR.current=s;
    const c=setInterval(()=>{if(s.ready()){sSfOk(true);clearInterval(c)}},200);
    setTimeout(()=>clearInterval(c),15000);
  }
  // Триггер: пользователь вошёл в игру или открыл анализ/коуча
  useEffect(()=>{
    if(on||tab==="analysis"||tab==="coach")ensureSF();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[on,tab]);
  // Terminate Stockfish worker on unmount so the WASM process doesn't outlive the page.
  useEffect(()=>()=>{try{sfR.current?.terminate()}catch{};sfR.current=null},[]);
  // Live eval on position change.
  useEffect(()=>{
    if(setup||!sfR.current?.ready())return;
    if(tab!=="analysis"&&tab!=="play"&&tab!=="coach")return;
    if(tab!=="analysis"&&over)return;
    if(tab!=="analysis"&&think)return;
    let done=false;
    const sign=game.turn()==="w"?1:-1;
    // Defer eval до idle, чтобы не блокировать UI на момент ходa.
    const idleId=typeof window!=="undefined"&&"requestIdleCallback" in window
      ?(window as any).requestIdleCallback(()=>{
        if(done||!sfR.current?.ready())return;
        sfR.current.eval(game.fen(),13,(cp,mate,depth)=>{
          if(done)return;
          sEvalCp(cp*sign);sEvalMate(mate*sign);
          if(typeof depth==="number"&&depth>0)sEvalDepth(depth);
        },()=>{done=true});
      },{timeout:200})
      :setTimeout(()=>{
        if(done||!sfR.current?.ready())return;
        sfR.current.eval(game.fen(),13,(cp,mate,depth)=>{
          if(done)return;
          sEvalCp(cp*sign);sEvalMate(mate*sign);
          if(typeof depth==="number"&&depth>0)sEvalDepth(depth);
        },()=>{done=true});
      },150);
    return()=>{
      done=true;
      try{
        if(typeof window!=="undefined"&&"cancelIdleCallback" in window&&typeof idleId==="number")
          (window as any).cancelIdleCallback(idleId);
        else if(idleId)clearTimeout(idleId as any);
      }catch{}
      sfR.current?.stop();
    };
  },[bk,tab,setup,think,over,sfOk]);

  // Real-time blunder/brilliant detection: compare eval before and after user's move.
  const prevEvalCpRef=useRef<number>(0);
  const prevBkRef=useRef<number>(-1);
  useEffect(()=>{
    if(!on||over||tab!=="play"||hist.length<1)return;
    const lastMoveWasMine=hist.length%2===(pCol==="w"?1:0);
    if(!lastMoveWasMine)return; // only react to user's own moves
    const prevCp=prevEvalCpRef.current;
    const curCp=evalCp;
    const cpFromMePerspective=pCol==="w"?curCp:-curCp;
    const prevFromMe=pCol==="w"?prevCp:-prevCp;
    const drop=prevFromMe-cpFromMePerspective;
    if(drop>=300)showToast(`?? Блундер! Потеряно ${(drop/100).toFixed(1)} (${pCol==="w"?"―"+Math.round(curCp/100):"+"+(Math.round(-curCp/100))})`, "error");
    else if(drop>=150)showToast(`? Неточность — позиция ухудшилась`, "error");
    else if(cpFromMePerspective-prevFromMe>=200)showToast("!! Блестящий ход", "success");
  },[evalCp]);// eslint-disable-line react-hooks/exhaustive-deps
  // track prev eval
  useEffect(()=>{
    if(bk===prevBkRef.current)return;
    prevBkRef.current=bk;
    prevEvalCpRef.current=evalCp;
  },[bk]);// eslint-disable-line react-hooks/exhaustive-deps

  // F2-phase-2: Background multiPV=3 prefetch for the CURRENT position.
  // The collector will consume this top-3 snapshot when the NEXT move is played
  // (via consumePendingTop3 keyed on fenBefore). Non-blocking: we never await
  // this in exec(). Depth 18 is a balance between accuracy and not stomping on
  // the live single-pv eval (which uses depth 13 and the same SF worker).
  //
  // Note: SF has a single shared worker → multiPV calls cancel the live eval
  // briefly. To minimise contention we delay this pass to idle, and only run
  // when the user is actively playing (tab === "play", game on, not in P2P).
  useEffect(()=>{
    if(!on||over||tab!=="play"||p2pMode||hotseat||setup)return;
    if(!sfR.current?.ready())return;
    if(currentEndgame||pzCurrent)return; // skip in puzzle/endgame loops
    const fenForTop3=game.fen();
    let cancelled=false;
    const idleId=typeof window!=="undefined"&&"requestIdleCallback" in window
      ?(window as any).requestIdleCallback(()=>{
        if(cancelled||!sfR.current?.ready())return;
        sfR.current.multiPV(fenForTop3,sfDepth,3,(lines)=>{
          if(cancelled||!lines||lines.length===0)return;
          try{
            // Convert in-page PVLine shape to MetricsPVLine (structurally identical).
            metricsRef.current.setPendingTop3(fenForTop3,lines as unknown as MetricsPVLine[]);
          }catch{/* never break gameplay on metrics errors */}
        });
      },{timeout:600})
      :setTimeout(()=>{
        if(cancelled||!sfR.current?.ready())return;
        sfR.current.multiPV(fenForTop3,sfDepth,3,(lines)=>{
          if(cancelled||!lines||lines.length===0)return;
          try{metricsRef.current.setPendingTop3(fenForTop3,lines as unknown as MetricsPVLine[])}catch{}
        });
      },400);
    return()=>{
      cancelled=true;
      try{
        if(typeof window!=="undefined"&&"cancelIdleCallback" in window&&typeof idleId==="number")
          (window as any).cancelIdleCallback(idleId);
        else if(idleId)clearTimeout(idleId as any);
      }catch{}
    };
  },[bk,on,over,tab,p2pMode,hotseat,setup,sfOk]);// eslint-disable-line react-hooks/exhaustive-deps

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
          const ev=await evalAt(fen,8);
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
        const ev=await evalAt(fen,14);
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

  // ── P2P friend play ─────────────────────────────────────────────────────
  const p2pMsgRef=useRef<((msg:P2PMessage)=>void)|null>(null);
  const p2p=useP2P({onMessage:(msg)=>p2pMsgRef.current?.(msg)});
  const p2pRef=useRef({mode:false,send:p2p.send});
  p2pRef.current={mode:p2pMode,send:p2p.send};
  // Auto-join via URL param: /cyberchess?room=ABC123&color=w
  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const room=params.get("room");const hostColor=(params.get("color")||"w") as ChessColor;
    if(!room)return;
    sP2pMode(true);sP2pRoomId(room);
    p2p.join(room);
    // Take opposite color of host
    const myColor:ChessColor=hostColor==="w"?"b":"w";
    sPCol(myColor);sFlip(myColor==="b");
    showToast(`🤝 Подключаюсь к комнате ${room}…`,"info");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Когда true — следующий апдейт lm (свой ход юзера) НЕ запускает slide-animation.
  // Юзер только что сам перетащил/щёлкнул — анимация лишь добавляет восприятия лага.
  const skipNextAnimRef=useRef(false);
  const exec=useCallback((from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>{
    skipNextAnimRef.current=true;
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
        if(!mv){
          // Move object was null — позиция/ход рассинхронизирован. Не идём дальше.
          showToast("Ошибка: ход не выполнен. Перезагрузи задачу.","error");
          return false;
        }
        sLm({from:mv.from,to:mv.to});sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1);
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
                sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");incPzStreak();
                if(pzCurrent.theme)addThemeResult(pzCurrent.theme,true);
                // Rush: +1..+3 sec по сложности, streak, score, Chessy
                if(pzMode==="rush"){
                  const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
                  sPzTimeLeft(v=>Math.min(180,v+bonus));
                  sRushScore(s=>s+1);
                  sRushStreak(st=>{const n=st+1;sRushBestStreak(b=>Math.max(b,n));return n});
                  showToast(`✓ +${bonus}с · ${pzCurrent.r}`,"success");
                  // Rush auto-advance on correct — Lichess Puzzle Streak feel
                  setTimeout(()=>{if(fPz.length){const nx=(pzI+1)%fPz.length;ldPz(nx)}},650);
                }else if(pzMode==="timed3"||pzMode==="timed5"||pzMode==="custom"){
                  const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
                  sPzTimeLeft(v=>v+bonus);
                  showToast(`✓ +${bonus}с`,"success");
                  // Auto-advance in timed modes (chess.com 3min/5min behaviour)
                  setTimeout(()=>{if(fPz.length){const nx=(pzI+1)%fPz.length;ldPz(nx)}},900);
                }else{
                  showToast(`✓ Решено! ${pzCurrent.name}`,"success");
                }
                const reward=Math.max(2,Math.round((pzCurrent.r||800)/200));
                addChessy(reward,"пазл решён");
                bumpDaily("puzzle");
                if(pzCurrent.theme==="Твоя ошибка"){addChessy(3,"🎯 ошибка исправлена")}
                if(dailyState&&!dailyState.solved&&PUZZLES[dailyState.idx]?.fen===pzCurrent.fen){
                  const next={...dailyState,solved:true};sDailyState(next);svDaily(next);
                  bumpDaily("daily-puzzle");
                  setTimeout(()=>addChessy(50,"☀ пазл дня"),800);
                }
              }
            }catch{}
          },280); // ждём пока закончится slide-animation хода юзера (160ms) + ~100ms на восприятие
        }else{
          // Single-move puzzle — solved
          sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");incPzStreak();
          if(pzCurrent.theme)addThemeResult(pzCurrent.theme,true);
          if(pzMode==="rush"){
            const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
            sPzTimeLeft(v=>Math.min(180,v+bonus));
            sRushScore(s=>s+1);
            sRushStreak(st=>{const n=st+1;sRushBestStreak(b=>Math.max(b,n));return n});
            showToast(`✓ +${bonus}с · ${pzCurrent.r}`,"success");
            setTimeout(()=>{if(fPz.length){const nx=(pzI+1)%fPz.length;ldPz(nx)}},650);
          }else if(pzMode==="timed3"||pzMode==="timed5"||pzMode==="custom"){
            const bonus=pzCurrent.r<900?1:pzCurrent.r<1500?2:3;
            sPzTimeLeft(v=>v+bonus);
            showToast(`✓ +${bonus}с`,"success");
            setTimeout(()=>{if(fPz.length){const nx=(pzI+1)%fPz.length;ldPz(nx)}},900);
          }else{
            showToast(`✓ Решено! ${pzCurrent.name}`,"success");
          }
          const reward=Math.max(2,Math.round((pzCurrent.r||800)/200));
          addChessy(reward,"пазл решён");
          bumpDaily("puzzle");
          if(pzCurrent.theme==="Твоя ошибка"){addChessy(3,"🎯 ошибка исправлена")}
          // Daily puzzle bonus — first solve today
          if(dailyState&&!dailyState.solved&&PUZZLES[dailyState.idx]?.fen===pzCurrent.fen){
            const next={...dailyState,solved:true};sDailyState(next);svDaily(next);
            bumpDaily("daily-puzzle");
            setTimeout(()=>addChessy(50,"☀ пазл дня"),800);
          }
        }
        return true;
      }else{
        sPzAttempt("wrong");sPzFailedCount(c=>c+1);snd("capture");resetPzStreak();
        if(pzCurrent?.theme)addThemeResult(pzCurrent.theme,false);
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
        }else if(pzMode==="timed3"||pzMode==="timed5"||pzMode==="custom"){
          // In timed modes: auto-advance after 1.5s so user sees the wrong indicator then moves on
          setTimeout(()=>{
            if(!fPz.length)return;
            const nextIdx=(pzI+1)%fPz.length;
            const pz=fPz[nextIdx];if(!pz)return;
            const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(nextIdx);sPzCurrent(pz);sPzAttempt("idle");
            sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);
            sCapW([]);sCapB([]);sOn(true);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");
          },1500);
        }else{
          showToast(`✗ Неверно. Попробуй ещё или посмотри ответ`,"error");
        }
        return false;
      }
    }
    // F2-phase: capture FEN BEFORE the move + prev eval for CPI metrics
    const cpiFenBefore=game.fen();
    const cpiPrevEvalCp=prevEvalCpForCpiRef.current;
    let mv;
    try{mv=game.move({from,to,promotion:pr||"q"});}catch{return false;}
    if(!mv)return false;
    // P2P: send move to peer
    if(p2pRef.current.mode&&p2pRef.current.send){p2pRef.current.send({t:"mv",uci:`${from}${to}${pr||""}`,san:mv.san,at:Date.now()})}
    if(mv.captured)snd("capture");else if(mv.san.includes("O-"))snd("castle");else if(game.isCheck())snd("check");else snd("move");
    if(mv.captured){
      const cc=pc(mv.captured,mv.color==="w"?"b":"w");
      if(mv.color===pCol)sCapB(x=>[...x,cc]);else sCapW(x=>[...x,cc]);
      const capColor=mv.color==="w"?"b":"w";
      let capSq:Square=mv.to;
      if(mv.flags?.includes("e")){
        const r=parseInt(mv.to[1]);
        const epR=mv.color==="w"?r-1:r+1;
        capSq=`${mv.to[0]}${epR}` as Square;
      }
      sCapAnim({sq:capSq,piece:{type:mv.captured,color:capColor},key:Date.now()});
      window.setTimeout(()=>sCapAnim(null),220);
    }
    if(mv.color===pCol)pT.addInc();else aT.addInc();
    // Record time spent on this ply for time-management analytics
    const now=Date.now();
    const cpiTimeMs=now-lastMoveStartRef.current;
    moveTimesRef.current=[...moveTimesRef.current,cpiTimeMs];
    sMoveTimes([...moveTimesRef.current]);
    lastMoveStartRef.current=now;
    sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sLm({from:mv.from,to:mv.to});sSel(null);sVm(new Set());sBk(k=>k+1);
    // F2-phase-2: record per-move metrics into the CPI collector.
    // We build a base MoveMetric from the heuristic (live evalCp scalar) and then,
    // if Stockfish has pre-computed multiPV=3 for fenBefore (via the background
    // useEffect below — non-blocking), upgrade rank / mate-detection / brilliancy
    // with the real engine data. If no top3 is cached (SF not ready, fast moves
    // outpaced the engine, etc.), the heuristic record is used as-is — recall is
    // never blocked on the engine.
    try{
      const playedPly=hist.length+1; // 1-based ply count after this move
      const cpiUci=`${mv.from}${mv.to}${mv.promotion||""}`;
      const cpiCpl=computeCPL(cpiPrevEvalCp,evalCp,mv.color);
      const cpiHadMate1=Math.abs(evalMate)===1;
      const cpiHadMate2=Math.abs(evalMate)<=2&&Math.abs(evalMate)>0;
      const cpiHadMate3=Math.abs(evalMate)<=3&&Math.abs(evalMate)>0;
      const matedForUser=evalMate>0&&mv.color===pCol;
      const baseM:MoveMetric={
        ply:playedPly,
        fenBefore:cpiFenBefore,
        san:mv.san,
        uci:cpiUci,
        engineTop3:[],
        cpl:cpiCpl,
        rank:cpiCpl<25?1:cpiCpl<60?2:cpiCpl<150?3:4,
        hadMate1:cpiHadMate1,
        hadMate2:cpiHadMate2,
        hadMate3:cpiHadMate3,
        foundMate1:cpiHadMate1&&matedForUser&&cpiCpl===0,
        foundMate2:cpiHadMate2&&matedForUser&&cpiCpl===0,
        foundMate3:cpiHadMate3&&matedForUser&&cpiCpl===0,
        isHang:cpiCpl>=300,
        isBrilliancy:false, // upgraded below if real top3 is available
        timeMs:cpiTimeMs,
      };
      const cachedTop3=metricsRef.current.consumePendingTop3(cpiFenBefore);
      if(cachedTop3&&cachedTop3.length>0)metricsRef.current.recordMoveWithMultiPV(baseM,cachedTop3);
      else metricsRef.current.recordMove(baseM);
      prevEvalCpForCpiRef.current=evalCp;
    }catch{/* CPI is optional — never break the move flow */}
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
          setTimeout(()=>{addChessy(3,"партия сыграна");bumpDaily("game")},400);
        }else{
          const w=game.turn()===aiC;r=w?"Checkmate! You win! 🏆":"Checkmate — AI wins";
          if(w){
            const nr=Math.min(3000,rat+Math.max(5,Math.round((lv.elo-rat)*0.1+15)));sRat(nr);svR(nr);
            const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);showToast(`+${nr-rat} rating`,"success");
            // Chessy reward: scale by AI difficulty × time category
            const aiMul=[0.2,0.5,1,1.5,2.5,4][aiI]||1;
            const timeMul=tc.ini<=0?1:Math.max(0.5,Math.min(3,tc.ini/300));
            const reward=Math.max(5,Math.round(10*aiMul*timeMul));
            setTimeout(()=>{addChessy(reward,`победа над ${lv.name}`);bumpDaily("game")},400);
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

  /* ── F2-phase: centralized CPI update on every game-end ──
     Watches `over` going from null → string. Fires applyGameToCPI exactly once
     per game (dedup via cpiAppliedRef + fingerprint). This covers ALL game-end
     transitions: normal mate/draw, timeout, resign, p2p, variant-specific
     (KingOfHill / ThreeCheck / Atomic / TwinKings), endgame trainer — they all
     funnel through `sOver(...)`. */
  useEffect(()=>{
    if(!over)return;
    const fingerprint=`${gameStartTimeRef.current}|${over}`;
    if(cpiAppliedRef.current===fingerprint)return;
    cpiAppliedRef.current=fingerprint;
    try{
      if(metricsRef.current.size()===0)return;
      // Derive result from the user's perspective. `over` is a localized human
      // string ("Checkmate! You win!", "Checkmate — AI wins", "You resigned",
      // "Time out", "Draw agreed", "Stalemate", "⚡ Три шаха — победа!", …).
      const overLow=over.toLowerCase();
      const winHints=["you win","победа!","трофей","цель достигнута","ai timed out","сдался — вы победили"];
      const lossHints=["ai wins","поражение","you resigned","time out","king взорван","ферзь пал"];
      const drawHints=["draw","stalemate","ничья","repetition","insufficient","50-move"];
      let cpiResult:"w"|"l"|"d"="d";
      if(drawHints.some(h=>overLow.includes(h)))cpiResult="d";
      else if(winHints.some(h=>overLow.includes(h)))cpiResult="w";
      else if(lossHints.some(h=>overLow.includes(h)))cpiResult="l";
      // Opening book hits: count user moves in first 20 plies with small CPL
      // (proxy until openingExplorer integration in F2-phase-2).
      const snap=metricsRef.current.snapshot();
      const userMovesEarly=snap.filter(m=>m.ply<=20&&(pCol==="w"?m.ply%2===1:m.ply%2===0)).slice(0,10);
      const openingBookHits=userMovesEarly.filter(m=>m.cpl<40).length;
      const totalTimeMs=tc.ini>0?tc.ini*1000:600000;
      const metrics=metricsRef.current.toGameMetrics(pCol,cpiResult,openingBookHits,totalTimeMs);
      const newState=applyGameToCPI(metrics,`game-${gameStartTimeRef.current}`);
      const last=newState.history[newState.history.length-1];
      const sign=last.delta>0?"+":"";
      showToast(`📊 CPI: ${Math.round(newState.cpi)} (${sign}${Math.round(last.delta)})`,"info");
    }catch{/* CPI is strictly optional — never break the game-end flow */}
  },[over,pCol,tc.ini,showToast]);

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
        if(promo){sPromo(null);return}
        if(pms.length>0||pmSel){sPms([]);sPmSel(null)}
      }
      // Promotion keyboard shortcut: Q/R/B/N
      if(promo){
        const k=e.key.toLowerCase();
        if(k==="q"||k==="r"||k==="b"||k==="n"){
          e.preventDefault();
          exec(promo.from,promo.to,k as any);sPromo(null);
          return;
        }
      }
      // Global shortcuts (but not while typing in input)
      const target=e.target as HTMLElement;
      if(target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT")return;
      if(e.key==="m"||e.key==="M"){e.preventDefault();sMuted(v=>{const nv=!v;showToast(nv?"Muted":"Sound on","info");return nv})}
      if(e.key==="f"||e.key==="F"){e.preventDefault();sFlip(v=>!v)}
      if(e.key==="?"||(e.key==="/"&&e.shiftKey)){e.preventDefault();sShowHelp(v=>!v)}
      // Hint (H): show the engine's top move as a 3s ghost arrow on the board.
      // Costs 5 Chessy in active play; free in Analysis tab. No-op if engine not ready
      // or if the user is not on play / coach / analysis (e.g. in puzzles, the puzzle
      // hint button on the right panel handles it differently).
      if(e.key==="h"||e.key==="H"){
        if(!(tab==="play"||tab==="coach"||tab==="analysis"))return;
        if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
        if(over){showToast("Партия закончена","info");return}
        e.preventDefault();
        // Charge only during active play; free elsewhere.
        const charged=tab==="play"&&on&&!over;
        if(charged&&!spendChessy(5,"подсказка хода"))return;
        showToast(charged?"💡 Считаю лучший ход (-5 Chessy)":"💡 Считаю лучший ход","info");
        try{
          sfR.current.go(game.fen(),12,(f,t)=>{
            if(!f||!t){showToast("Не нашёл хода","error");return}
            sArrows([{from:f as Square,to:t as Square,c:"#22c55e"}]);
            window.setTimeout(()=>sArrows(a=>a.filter(x=>!(x.from===f&&x.to===t))),3000);
          });
        }catch{showToast("Ошибка движка","error")}
      }
      // Save bookmark (B): persist current FEN to position bookmarks.
      if(e.key==="b"||e.key==="B"){
        e.preventDefault();
        try{
          const fen=game.fen();
          if(bookmarks.some(b=>b.fen===fen)){
            showToast("⭐ Эта позиция уже в закладках","info");
          }else{
            const next=addBookmark(bookmarks,fen);
            sBookmarks(next);
            showToast(`⭐ Закладка сохранена · всего ${next.length}`,"success");
          }
        }catch{showToast("Не удалось сохранить","error")}
      }
      // Quick-share (S): copy URL with current FEN (?fen=...) so anyone can open this position.
      if(e.key==="s"||e.key==="S"){
        e.preventDefault();
        try{
          const fen=game.fen();
          const url=typeof window!=="undefined"?`${window.location.origin}/cyberchess?fen=${encodeURIComponent(fen)}`:`/cyberchess?fen=${encodeURIComponent(fen)}`;
          if(navigator.clipboard?.writeText){
            navigator.clipboard.writeText(url).then(
              ()=>showToast("📋 Ссылка на позицию скопирована","success"),
              ()=>showToast(`FEN: ${fen}`,"info")
            );
          }else{
            showToast(`FEN: ${fen}`,"info");
          }
        }catch{showToast("Не удалось скопировать","error")}
      }
      if(e.key==="n"||e.key==="N"){const c=kbCtxRef.current;if(c.tab==="play"&&(c.setup||!c.on)){e.preventDefault();newGRef.current()}}
      if(e.key==="r"||e.key==="R"){e.preventDefault();sRepertoireOpen(v=>!v)}
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
      // Annotation shortcuts in analysis mode: 1=!! 2=! 3=!? 4=?! 5=? 6=??
      if(kbCtxRef.current.tab==="analysis"&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.altKey){
        const ANNOTS:Record<string,string>={"1":"!!","2":"!","3":"!?","4":"?!","5":"?","6":"??"};
        if(ANNOTS[e.key]){
          e.preventDefault();
          const ply=browseIdx<0?hist.length-1:browseIdx-1;
          if(ply>=0&&ply<hist.length){
            sMoveAnnotations(prev=>{const next={...prev};if(next[ply]===ANNOTS[e.key])delete next[ply];else next[ply]=ANNOTS[e.key];return next;});
            showToast(`Аннотация ${ANNOTS[e.key]} → ход ${hist[ply]||ply+1}`,"info");
          }
        }
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[pms.length,pmSel,hist.length,fenHist,browseIdx,promo,exec]);

  /* ── Keyboard SAN input — печатай ход прямо с клавиатуры (lichess-стиль)
     Поддержка: e4, Nf3, Bxf7+, O-O, O-O-O, e8=Q, Nbd7, Rae1, etc.
     Только когда твой ход в Play/Coach/Analysis. Backspace — стереть.
     Esc — очистить. ── */
  const[sanBuf,sSanBuf]=useState("");
  const[sanFlash,sSanFlash]=useState<"err"|null>(null);
  const sanBufClearTimer=useRef<number|null>(null);
  useEffect(()=>{
    const isMyTurn=()=>{
      if(tab==="analysis"||hotseat)return true;
      if(tab==="puzzles"&&pzCurrent)return true;
      return on&&!over&&game.turn()===pCol;
    };
    const h=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      if(target&&(target.tagName==="INPUT"||target.tagName==="TEXTAREA"||target.tagName==="SELECT"||target.isContentEditable))return;
      if(promo)return;
      if(!isMyTurn())return;
      // Backspace — стереть последний символ
      if(e.key==="Backspace"&&sanBuf){e.preventDefault();sSanBuf(b=>b.slice(0,-1));return}
      // Escape — очистить буфер (если есть, иначе fallthrough к premove clear)
      if(e.key==="Escape"&&sanBuf){e.preventDefault();sSanBuf("");return}
      // SAN-significant chars: a-h, 1-8, NBRQK, x, +, #, =, O/0, -
      if(e.key.length!==1)return;
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const ch=e.key;
      const allow=/^[a-hNBRQKxX+#=Oo01-8\-]$/.test(ch);
      if(!allow)return;
      e.preventDefault();
      // Normalize 0 → O for castling (0-0 vs O-O)
      const norm=ch==="0"?"O":ch;
      sSanBuf(prev=>{
        const candidate=(prev+norm).slice(0,8);
        // Try to execute SAN — chess.js понимает любую корректную нотацию
        const probe=new Chess(game.fen());
        try{
          const mv=probe.move(candidate);
          if(mv){
            // Execute via main path (handles puzzle/coach/analysis modes too)
            if(tab==="puzzles"&&pzCurrent){
              exec(mv.from as Square,mv.to as Square,mv.promotion as any);
            }else{
              exec(mv.from as Square,mv.to as Square,mv.promotion as any);
            }
            return "";
          }
        }catch{}
        // Не валидный полный ход. Это префикс легального?
        const sans=game.moves();
        const lc=candidate.toLowerCase();
        const isPrefix=sans.some(s=>s.toLowerCase().startsWith(lc));
        if(!isPrefix){
          // Возможно юзер начал новый ход — попробуем оставить только последний символ
          const tail=norm;
          const tailIsPrefix=sans.some(s=>s.toLowerCase().startsWith(tail.toLowerCase()));
          if(tailIsPrefix)return tail;
          // Совсем мимо — флэш ошибки и сбросим
          sSanFlash("err");
          if(sanBufClearTimer.current)window.clearTimeout(sanBufClearTimer.current);
          sanBufClearTimer.current=window.setTimeout(()=>{sSanBuf("");sSanFlash(null);sanBufClearTimer.current=null},900);
          return candidate;
        }
        // Префикс — ждём ещё символов
        return candidate;
      });
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[game,tab,on,over,pCol,hotseat,pzCurrent,promo,sanBuf,exec]);
  // Очистка буфера когда меняется ход / состояние
  useEffect(()=>{sSanBuf("");sSanFlash(null)},[bk,tab]);
  // Track coach tab open for daily goals
  useEffect(()=>{if(tab==="coach"&&!dailyGoals.coachOpened){sDailyGoals(g=>({...g,coachOpened:true}))}},[tab]); // eslint-disable-line react-hooks/exhaustive-deps
  // cc:coach-prefill: set coach input + auto-send when coach tab is shown
  const sendChatRef=useRef<((q:string)=>Promise<void>)|null>(null);
  useEffect(()=>{
    if(!coachPrefillQ||tab!=="coach")return;
    const q=coachPrefillQ;sCoachPrefillQ(null);
    // Auto-fill input and trigger send via ref
    sCoachChatInput(q);
    setTimeout(()=>{if(sendChatRef.current)sendChatRef.current(q);},150);
  },[coachPrefillQ,tab]); // eslint-disable-line react-hooks/exhaustive-deps
  // Daily goals completion bonus — fire once when all 3 goals first satisfied
  const dailyGoalsBonusFiredRef=useRef(false);
  useEffect(()=>{
    if(dailyGoalsBonusFiredRef.current)return;
    const g1done=totalGames>=dailyGoals.gamesGoal;
    const g2done=pzSolvedCount>=dailyGoals.puzzleGoal;
    const g3done=dailyGoals.coachOpened;
    if(g1done&&g2done&&g3done){
      dailyGoalsBonusFiredRef.current=true;
      setTimeout(()=>addChessy(30,"🏆 Все цели дня выполнены!"),400);
      setTimeout(()=>showToast("🏆 Цели дня выполнены — +30 Chessy!","success"),600);
    }
  },[totalGames,pzSolvedCount,dailyGoals,addChessy,showToast]);

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
  // Migration 2026-05-12: switched from twinKingsLossSide(fen) which counted Q in FEN
  // (broken — promoted pawn revives "second king"). Now checks capture history via
  // capW/capB which store unicode glyphs ♕ (white queen) and ♛ (black queen).
  useEffect(()=>{
    if(variant!=="twinkings"||over||!on)return;
    const whiteQueenCaptured = capW.includes("♕") || capB.includes("♕");
    const blackQueenCaptured = capW.includes("♛") || capB.includes("♛");
    const lossSide: "w" | "b" | null = whiteQueenCaptured ? "w" : blackQueenCaptured ? "b" : null;
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
    // Pick captured piece from actual capW/capB tracking:
    // capW = white pieces captured BY black (so available to reinforce white's side)
    // capB = black pieces captured BY white (so available to reinforce black's side)
    // Kings never spawn back. If no captured pieces for that side, use a random pawn.
    try{
      const sideToMove=game.turn();
      const pool=sideToMove==="w"
        ?capW.filter(p=>p.toUpperCase()!=="K")
        :capB.filter(p=>p.toLowerCase()!=="k");
      const captured=pool.length>0?pool:(sideToMove==="w"?["P"]:["p"]);
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

  /* ── Confetti on player win ── */
  useEffect(()=>{
    if(!over)return;
    const key=`${variant}-${fenHist.length}-${over}`;
    if(lastWinKeyRef.current===key)return;
    lastWinKeyRef.current=key;
    if(over.includes("You win")||over.includes("timed out")||over.includes("победа!")||over.includes("Победили")||over.includes("ВЗОШЁЛ")||over.includes("взошёл")||over.includes("ЧЕМПИОН")){
      sShowConfetti(true);
    }
  },[over,variant,fenHist.length]);

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

  /* ── Move list auto-scroll к browseIdx ── */
  useEffect(()=>{
    const cont=moveListScrollRef.current;if(!cont)return;
    if(hist.length===0)return;
    const idx=browseIdx<0?Math.floor((hist.length-1)/2):Math.floor(browseIdx/2);
    const target=cont.querySelector(`[data-pair-idx="${idx}"]`) as HTMLElement|null;
    if(!target)return;
    const cR=cont.getBoundingClientRect();
    const tR=target.getBoundingClientRect();
    if(tR.top<cR.top||tR.bottom>cR.bottom){
      target.scrollIntoView({block:"nearest",behavior:"smooth"});
    }
  },[browseIdx,hist.length]);

  /* ── Move slide animation: после каждого реального хода (lm change)
     запускаем floating piece от from к to. Хард-таймаут 180ms — потом
     убираем floating, фигура остаётся на dest cell. ── */
  const[moveAnim,sMoveAnim]=useState<{from:Square;to:Square;piece:{type:any;color:any};key:number}|null>(null);
  const moveAnimElRef=useRef<HTMLDivElement|null>(null);
  const lmKeyRef=useRef("");
  // Capture animation: захваченная фигура коротко fade+shrink на cell взятия (lichess-style).
  const[capAnim,sCapAnim]=useState<{sq:Square;piece:{type:any;color:any};key:number}|null>(null);
  // Premove cancel flash: красный pulse на FROM-клетке отменённого премува (~600ms).
  const[cancelFlash,sCancelFlash]=useState<{sq:Square;key:number}|null>(null);
  useEffect(()=>{if(!cancelFlash)return;const id=window.setTimeout(()=>sCancelFlash(null),650);return()=>clearTimeout(id);},[cancelFlash?.key]);
  // ── Move slide animation trigger ──
  // На каждое обновление last-move (lm): если skipNextAnimRef=true (пользователь сам
  // только что сделал ход через exec — анимация лишь добавит лаг), просто сбрасываем
  // флаг и пропускаем. Иначе — запускаем floating piece от FROM к TO, фигура читается
  // из game на позиции TO (после хода). Эффект очищается через 220ms.
  const prevLmRef=useRef<{from:string;to:string}|null>(null);
  useEffect(()=>{
    if(!lm){prevLmRef.current=null;return}
    const prev=prevLmRef.current;
    if(prev&&prev.from===lm.from&&prev.to===lm.to)return;
    prevLmRef.current={from:lm.from,to:lm.to};
    if(skipNextAnimRef.current){skipNextAnimRef.current=false;return}
    const pc=game.get(lm.to as Square);
    if(!pc)return;
    sMoveAnim({from:lm.from as Square,to:lm.to as Square,piece:{type:pc.type,color:pc.color},key:Date.now()});
    const id=window.setTimeout(()=>sMoveAnim(null),220);
    return()=>clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[lm?.from,lm?.to,bk]);
  // После mount floating piece — trigger transition через рефлоу, чтобы
  // initial transform (from→to negative offset) уехал в 0,0.
  useEffect(()=>{
    if(!moveAnim)return;
    const el=moveAnimElRef.current;if(!el)return;
    // force reflow
    void el.offsetWidth;
    // Pure ease-out без overshoot — фигура «приземляется» плавно, без bounce-эффекта.
    el.style.transition="transform 180ms cubic-bezier(0.25,0.46,0.45,0.94)";
    el.style.transform="translate(0,0)";
  },[moveAnim?.key]);

  /* ── Premove trigger — синхронно после render'а, без rAF. rAF добавлял
     лишний кадр (~16ms) задержки; премув должен срабатывать сразу как
     пришла очередь юзера. ── */
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(game.turn()!==pCol)return;
    if(pmsRef.current.length===0)return;
    doPremoveRef.current();
  },[bk,over,on,tab,pCol,pms.length]);

  /* ── P2P onMessage — wired here so exec is in scope ── */
  useEffect(()=>{
    p2pMsgRef.current=(msg:P2PMessage)=>{
      if(msg.t==="mv"){
        const f=msg.uci.slice(0,2) as Square,t=msg.uci.slice(2,4) as Square;
        const pr=msg.uci[4] as any||undefined;
        exec(f,t,pr);
      }else if(msg.t==="hello"){sP2pOpponentName((msg as any).name||"Оппонент")}
      else if(msg.t==="resign"){sOver(`${p2pOpponentName} сдался — Вы победили!`);sOn(false)}
      else if(msg.t==="draw-accept"){sOver("Ничья (договорились)");sOn(false)}
    };
    return()=>{p2pMsgRef.current=null};
  },[exec,p2pOpponentName]);

  /* ── P2P status → connect toast ── */
  useEffect(()=>{
    if(p2p.status==="connected")showToast(`🤝 ${p2pOpponentName} подключился — игра началась!`,"success");
    if(p2p.status==="closed"&&p2pMode)showToast("P2P соединение закрыто","error");
  },[p2p.status]);// eslint-disable-line react-hooks/exhaustive-deps

  /* ── AI turn trigger ── */
  // Snapshot fen at trigger time so a late-arriving Stockfish bestmove
  // can't try to apply itself on a position the user has already moved on.
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(hotseat)return; // two-player hotseat: no AI moves
    if(p2pMode)return; // P2P mode: opponent is human, no AI
    // Ghost Duel: replay past game moves as ghost's turns
    if(ghostDuelMode&&ghostDuelConfig){
      const ply=hist.length;
      const ghostSan=getGhostMoveAt(ghostDuelConfig,ply);
      if(ghostSan){
        const fenAtTrigger2=game.fen();
        const t2=setTimeout(()=>{
          try{
            if(game.fen()!==fenAtTrigger2){sThink(false);return}
            const mv=game.move(ghostSan);
            if(mv){
              sLm({from:mv.from,to:mv.to});sHist(h=>[...h,mv.san]);sFenHist(h=>[...h,game.fen()]);sBk(k=>k+1);
              snd(mv.captured?"capture":mv.san.includes("O-")?"castle":game.isCheck()?"check":"move");
              const div=checkDivergence(ghostDuelConfig,[...hist,mv.san]);
              if(div!==null&&ghostDuelDivergePly===null){sGhostDuelDivergePly(div);showToast(`👻 Отклонение от прошлой партии на ходу ${Math.floor(div/2)+1}!`,"info")}
            }
          }catch{}
          sThink(false);
        },600+Math.random()*400);
        return()=>clearTimeout(t2);
      }
      // past game ended → fall through to Stockfish
    }
    if(openingDrill)return; // Opening Trainer plays bot moves from script
    if(game.turn()===pCol)return;
    sThink(true);
    const tcMul=tc.ini<=0?1:tc.ini<=60?0.3:tc.ini<=180?0.5:tc.ini<=300?0.7:tc.ini<=600?1:tc.ini<=900?1.5:2;
    const rawDelay=lv.thinkMs*tcMul*(0.7+Math.random()*0.6);
    // ── Premove-friendly pacing: AI обязан дать юзеру время поставить
    // премувы. Floor зависит от time-control: Bullet короче, Rapid+ дольше.
    // Каждый уже стоящий premove уменьшает требуемое окно (slot занят).
    // Хочешь играть быстрее — ставь премувы заранее.
    const premovesNow=pmsRef.current.length;
    const isBullet=tc.ini>0&&tc.ini<=60;
    const isBlitz=tc.ini>60&&tc.ini<=300;
    const baseFloor=isBullet?250:isBlitz?320:400;
    const perPremoveSlot=isBullet?80:isBlitz?100:120;
    const targetSlots=5;
    const slotsLeft=Math.max(0,targetSlots-premovesNow);
    const premoveFloor=baseFloor+slotsLeft*perPremoveSlot;
    // Bullet 0pm: 250+5×80  =  650ms · 5pm: 250ms
    // Blitz  0pm: 320+5×100 =  820ms · 5pm: 320ms
    // Rapid  0pm: 400+5×120 = 1000ms · 5pm: 400ms
    // TEMP — TESTING: жёсткая задержка AI 20 секунд для отладки механик
    // хода/премува. Снять когда тестирование закончится (заменить на
    // Math.max(rawDelay, premoveFloor)). Без localStorage indirection чтобы
    // случайно застрявший ключ не отключил задержку.
    const delay=20000;
    void rawDelay; void premoveFloor; // suppress unused-var warnings
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
      }),delay);
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
  },[bk,over,on,tab,p2pMode,ghostDuelMode,ghostDuelConfig,ghostDuelDivergePly]);

  /* ── Click: normal move OR premove ── */
  const click=useCallback((sq:Square)=>{
    // SCRATCH режим — клик-логика как у analysis tab, но на scratchGame.
    if(scratchOn&&scratchGame){
      const p=scratchGame.get(sq);
      const side=scratchGame.turn();
      if(scratchSel){
        if(scratchVm.has(sq)){
          try{
            const moves=scratchGame.moves({square:scratchSel,verbose:true});
            const matched=moves.find(m=>m.to===sq);
            const promoNeeded=!!matched?.promotion;
            const mv=scratchGame.move({from:scratchSel,to:sq,promotion:promoNeeded?"q":undefined});
            if(mv){
              sScratchHist(h=>[...h,mv.san]);
              sScratchLm({from:mv.from,to:mv.to});
              sScratchSel(null);sScratchVm(new Set());
              sScratchBk(k=>k+1);
              snd(mv.captured?"capture":mv.san.includes("O-")?"castle":scratchGame.isCheck()?"check":"move");
            }
          }catch{}
          return;
        }
        if(p&&p.color===side){sScratchSel(sq);sScratchVm(new Set(scratchGame.moves({square:sq,verbose:true}).map(m=>m.to)));return}
        sScratchSel(null);sScratchVm(new Set());return;
      }
      if(p&&p.color===side){sScratchSel(sq);sScratchVm(new Set(scratchGame.moves({square:sq,verbose:true}).map(m=>m.to)))}
      return;
    }
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
        sPms(v=>[...v,pre]);
        sPmSel(null);
        snd("premove");
        return;
      }

      // Case CANCEL (chess.com-like): клик по любой клетке существующего премува
      // (FROM или TO) — отменяет этот премув. Цепочки премувов теперь только драгом
      // (drag отрабатывается в pointerup отдельно и не попадает сюда).
      const pmHit=curPms.findIndex(x=>x.from===sq||x.to===sq);
      if(pmHit>=0){
        const cancelled=curPms[pmHit];
        sPms(v=>v.filter((_,i)=>i!==pmHit));
        snd("cancel");
        sCancelFlash({sq:cancelled.from,key:Date.now()});
        showToast(`Премув отменён · ${cancelled.from}→${cancelled.to}`,"info");
        return;
      }

      // Case 2: no selection → click on own piece (real or virtual) starts new premove
      if(vp?.color===pCol){sPmSel(sq);return}

      // Legacy fallback (на случай несмежных edge cases)
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
      if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){
        // Knight Riders: pawns always promote to knight (thematic rule)
        if(variant==="knightriders"){exec(sel,sq,"n");return}
        if(autoQueen){exec(sel,sq,"q");return}sPromo({from:sel,to:sq});return}exec(sel,sq);return}
      if(sel===sq){sSel(null);sVm(new Set());return}
      if(p?.color===sideToMove){sSel(sq);sVm(new Set((variant==="diceblade"&&dicePieceType?filterMovesByDice(game.moves({square:sq,verbose:true}),dicePieceType):game.moves({square:sq,verbose:true})).map(m=>m.to)));return}
      sSel(null);sVm(new Set());return;
    }
    if(p?.color===sideToMove){sSel(sq);sVm(new Set((variant==="diceblade"&&dicePieceType?filterMovesByDice(game.moves({square:sq,verbose:true}),dicePieceType):game.moves({square:sq,verbose:true})).map(m=>m.to)))}
  },[game,sel,vm,over,think,pCol,exec,on,pmLim,tab,editorMode,editorPiece,editorTurn,showToast,scratchOn,scratchGame,scratchSel,scratchVm,autoQueen]);

  /* ── Pointer-events drag — fully isolated in useBoardInput hook.
     Hook is called below, after virtualGame is declared (it depends on it). */

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
    // Reset time-per-move tracker and annotations for new game
    moveTimesRef.current=[];sMoveTimes([]);lastMoveStartRef.current=Date.now();
    // F2-phase: reset CPI collector for the new game (one bucket per game)
    metricsRef.current.reset();
    prevEvalCpForCpiRef.current=0;
    gameStartTimeRef.current=Date.now();
    sMoveAnnotations({});sAnnotPicker(null);
    // Reset Ghost Duel and P2P if they were active (new game started)
    if(ghostDuelMode){sGhostDuelMode(false);sGhostDuelConfig(null);sGhostDuelDivergePly(null)}
    reinfLastMoveRef.current=0;
    sChecksByWhite(0);sChecksByBlack(0);lastCheckBkRef.current=-1;
    sDropPool(EMPTY_POOL);sDropPickerOpen(false);sSelectedDropPiece(null);lastCaptureBkRef.current=-1;
    // Roll initial die for diceblade
    if(variant==="diceblade"){const d=rollDice();sDiceFace(d.face);sDicePieceType(d.pieceType);sDiceLabel(d.label)}
    const variantLabel=variant==="standard"?"":` · ${VARIANTS.find(v=>v.id===variant)?.name||""}`;
    showToast(`Playing ${cl==="w"?"White":"Black"}${variantLabel}`,"info");
    // Tutorial overlay for non-standard variants — once per variant. After dismissed, the
    // smaller toast tip kicks in for the next 3 plays as a refresher.
    if(variant!=="standard"&&!seenVariantTutorials.has(variant)){
      sVariantTutorialFor(variant);
    }else{
      const tip=VARIANT_TUTORIAL[variant];
      if(tip){
        const stats=variantStats[variant]||{w:0,l:0,d:0};
        const totalPlays=stats.w+stats.l+stats.d;
        if(totalPlays<3)setTimeout(()=>showToast(tip,"info"),1500);
      }
    }
  };
  const resumeGame=(s:ResumeSnap)=>{
    try{
      sTab("play");
      sTcI(s.tcI);sUseCustom(s.useCustom);sCustomMin(s.customMin);sCustomInc(s.customInc);
      sPCol(s.pCol);sAiI((chessy.owned.master_ai||isPro)?s.aiI:Math.min(s.aiI,4));sFlip(s.pCol==="b");
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
    const lvl=(chessy.owned.master_ai||isPro)?Math.min(5,opp.aiLevel):Math.min(4,opp.aiLevel);
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
  },[(chessy.owned.master_ai||isPro),tournament,newG,showToast]);
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
    else if(pzMode==="custom")sPzTimeLeft(pzCustomSec);
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
        if(pzMode!=="rush"){sPzFailedCount(c=>c+1);sPzAttempt("wrong");resetPzStreak()}
        return 0;
      }
      return v-1;
    }),1000);
    return()=>clearInterval(t);
  },[tab,pzMode,pzCurrent,pzAttempt,pzTimeLeft]);

  // Sync timer to current mode (fires on mode switch, even mid-puzzle)
  useEffect(()=>{
    if(tab!=="puzzles")return;
    if(pzMode==="timed3"){sPzTimeLeft(180);sRushActive(false);sPzSolvedCount(0);sPzFailedCount(0);sTimedResult(null);showToast("⏱ 3 минуты — решай как можно больше пазлов, +3с за каждый правильный","info")}
    else if(pzMode==="timed5"){sPzTimeLeft(300);sRushActive(false);sPzSolvedCount(0);sPzFailedCount(0);sTimedResult(null);showToast("⏱ 5 минут — решай как можно больше пазлов, +3с за каждый правильный","info")}
    else if(pzMode==="custom"){sPzTimeLeft(pzCustomSec);sRushActive(false);sPzSolvedCount(0);sPzFailedCount(0);sTimedResult(null);showToast(`⏱ Custom ${Math.floor(pzCustomSec/60)}:${String(pzCustomSec%60).padStart(2,"0")} — таймер пошёл`,"info")}
    else if(pzMode==="rush"){sPzTimeLeft(rushDuration);sRushActive(true);sRushScore(0);sRushStreak(0);sRushBestStreak(0);sRushResult(null)}
    else {sPzTimeLeft(0);sRushActive(false)}
  },[pzMode,tab,rushDuration,pzCustomSec]);

  // Timed mode (3min/5min/custom) end-of-session — fires when timer hits 0
  useEffect(()=>{
    if(pzTimeLeft>0||pzMode==="learn"||pzMode==="rush")return;
    if(tab!=="puzzles")return;
    if(pzSolvedCount===0&&pzFailedCount===0)return; // session hasn't started
    const totalSec=pzMode==="timed3"?180:pzMode==="timed5"?300:pzCustomSec;
    const modeName=pzMode==="timed3"?"3 мин":pzMode==="timed5"?"5 мин":`${Math.floor(totalSec/60)}:${String(totalSec%60).padStart(2,"0")}`;
    sTimedResult({solved:pzSolvedCount,failed:pzFailedCount,mode:modeName,totalSec});
    const bonus=pzSolvedCount*2;
    if(bonus>0)addChessy(bonus,`Puzzle Timed · ${pzSolvedCount} решено`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pzTimeLeft]);

  // Rush end-of-session detection — fire only once per session
  useEffect(()=>{
    if(!rushActive||pzTimeLeft>0||pzMode!=="rush")return;
    // Timer hit 0 during rush — finalize
    const boostMult=chessy.owned.puzzle_boost?2:1;
    const earned=(rushScore*2+rushBestStreak)*boostMult; // 2 Chessy per solve + streak bonus; x2 with boost
    const isNewBest=rushScore>rushBest;
    if(isNewBest){sRushBest(rushScore);try{localStorage.setItem("aevion_puzzle_rush_best_v1",String(rushScore))}catch{}}
    sRushResult({score:rushScore,streak:rushBestStreak,best:isNewBest?rushScore:rushBest,chessy:earned,isNewBest});
    sRushActive(false);
    if(earned>0)addChessy(earned,`Puzzle Rush${boostMult>1?" ⚡2x":""} · ${rushScore} решено`);
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
    else if(pzMode==="custom")sPzTimeLeft(pzCustomSec);
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
        sfR.current!.eval(fen,16,(c,m)=>{const sign=turn==="w"?1:-1;lastCp=c*sign;lastMate=m*sign},()=>res({cp:lastCp,mate:lastMate}));
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
    // Auto-populate blunder book: find positions where player blundered
    const blunders:BlunderEntry[]=[];
    const playerIsWhite=pCol==="w";
    for(let i=0;i<results.length;i++){
      const isPlayerMove=playerIsWhite?(i%2===0):(i%2===1);
      if(isPlayerMove&&results[i].quality==="blunder"&&fenHist[i]){
        blunders.push({fen:fenHist[i],san:hist[i]||"",date:new Date().toISOString().slice(0,10),opening:currentOpening?.name,moveNum:Math.floor(i/2)+1});
      }
    }
    if(blunders.length>0){
      sBlunderBook(prev=>{
        const existingFens=new Set(prev.map(b=>b.fen));
        const newOnes=blunders.filter(b=>!existingFens.has(b.fen));
        return [...newOnes,...prev].slice(0,50);
      });
    }
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
        // First try the move as-is.
        let moved=false;
        try{const mv=g.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"});if(mv)moved=true;}catch{}
        if(moved)continue;
        // "Rescue" premove: TO is occupied by our own piece. Project as if opponent
        // captured that piece (remove it), then retry the move so chained premoves
        // see the right virtual state. If still illegal, skip this premove.
        const occ=g.get(pm.to);
        if(occ&&occ.color===pCol){
          try{g.remove(pm.to);}catch{}
          try{g.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"});}catch{}
        }
      }
      return g;
    }catch{return game;}
  },[game,bk,pms,pCol]);
  // ── Board input hook (drag/click/premove) ──────────────────────────────────
  const _bi = useBoardInput({
    game, virtualGame, pCol, on, over, flip, tab,
    sel, vm, pms, pmSel, pmLim,
    pmsRef, pmSelRef, selRef, vmRef,
    scratchOn, scratchGame, autoQueen, hotseat, variant,
    dicePieceType: dicePieceType || null,
    editorMode,
    exec, sSel, sVm, sPms, sPmSel, sPromo,
    sScratchSel, sScratchVm, sScratchBk, sScratchHist, sScratchLm,
    snd,
    click,  // tap (pointer-up without drag) delegates here
    filterMovesByDice,
  });
  const boardRef = _bi.boardRef;
  const ghostRef = _bi.ghostRef;
  const ghostPosRef = _bi.ghostPosRef;
  const ghostSizeRef = _bi.ghostSizeRef;
  const ghostFrom = _bi.ghostFrom;
  const dragHover = _bi.dragHover;
  const recentDragRef = _bi.recentDragRef;
  const bDownHandledRef = _bi.bDownHandledRef;
  const onBoardDown = _bi.onBoardDown;
  const onBoardMove = _bi.onBoardMove;
  const onBoardUp = _bi.onBoardUp;
  const onBoardCancel = _bi.onBoardCancel;
  const sqFromPoint = _bi.sqFromBoard;

  // Scratch — отдельный inst отображается вместо virtualGame.
  const renderGame=scratchOn&&scratchGame?scratchGame:virtualGame;
  const bd=renderGame.board(),rws=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cls=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  // Эффективные sel/vm/lm: в scratch — свои; иначе — обычные.
  const effSel=scratchOn?scratchSel:sel;
  const effVm=scratchOn?scratchVm:vm;
  const effLm=scratchOn?scratchLm:lm;

  const btn=(label:string,onClick:()=>void,bg:string,fg:string,border?:string)=>(<button onClick={onClick} style={{padding:"10px 18px",borderRadius:9,border:border||`1px solid ${T.border}`,background:bg,color:fg,fontSize:14,fontWeight:800,cursor:"pointer",minHeight:38}}>{label}</button>);

  // SSR: render an empty shell. Client-only mount populates the real UI
  // after useEffect runs — this guarantees server HTML === client first paint
  // (no localStorage-driven values in SSR), so React doesn't have to
  // regenerate the tree on hydration, and event handlers attach immediately.
  if(!mounted){
    return(<main style={{background:T.bg,minHeight:"100vh"}}>
      <ProductPageShell fullWidth><Wave1Nav/>
        <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",color:T.dim,fontSize:14,fontWeight:700,letterSpacing:"0.05em"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${T.dim}`,borderTopColor:T.accent,animation:"cc-spin 0.8s linear infinite"}}/>
            <span>Подгружаю шахматы…</span>
          </div>
        </div>
      </ProductPageShell>
    </main>);
  }

  return(<main style={{background:CC.bg,minHeight:"100vh",color:CC.text,display:"flex",flexDirection:"column"}}>
    <ProductPageShell fullWidth><Wave1Nav/>
      {streamerMode&&<style>{`body{background:#0a0a0a !important}`}</style>}
      <StreamerOverlay active={streamerMode} onToolbar={t=>{streamerToolbarRef.current=t}}/>
      {streamerMode&&<div style={{position:"fixed",top:10,right:10,zIndex:300,display:"flex",gap:6,alignItems:"center"}}>
        <div style={{padding:"6px 12px",background:"rgba(124,58,237,0.2)",border:"1px solid rgba(124,58,237,0.4)",borderRadius:8,color:"#a78bfa",fontSize:12,fontWeight:800,letterSpacing:"0.05em"}}>📺 STREAMER MODE</div>
        <button onClick={()=>streamerToolbarRef.current?.showYT()} title="Show YouTube panel" style={{padding:"6px 10px",background:"rgba(255,0,51,0.18)",border:"1px solid rgba(255,0,51,0.5)",borderRadius:8,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"}}>+ YT</button>
        <button onClick={()=>streamerToolbarRef.current?.showTW()} title="Show Twitch panel" style={{padding:"6px 10px",background:"rgba(145,70,255,0.18)",border:"1px solid rgba(145,70,255,0.5)",borderRadius:8,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"}}>+ Twitch</button>
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
            <div style={{fontSize:15,fontWeight:900,color:CC.text,letterSpacing:0.2,display:"inline-flex",alignItems:"center",gap:6}}>
              <span>CyberChess</span>
              {isPro&&<span title={isUltimate?"Ultimate активен":"Pro активен"} style={{
                display:"inline-flex",alignItems:"center",gap:3,
                fontSize:9,fontWeight:900,letterSpacing:1,textTransform:"uppercase" as const,
                padding:"2px 7px",borderRadius:RADIUS.full,
                background:isUltimate?"linear-gradient(135deg,#d97706,#fcd34d)":"linear-gradient(135deg,#7c3aed,#a78bfa)",
                color:"#fff",boxShadow:isUltimate?"0 1px 4px rgba(217,119,6,0.4)":"0 1px 4px rgba(124,58,237,0.4)"
              }}>
                {isUltimate?"✨ Ultimate":"✨ Pro"}
              </span>}
            </div>
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

        {/* Command palette opener — discovery for Ctrl+K. */}
        <button onClick={()=>sPalOpen(true)} title="Поиск любого действия (Ctrl+K)" className="cc-focus-ring"
          style={{
            display:"inline-flex",alignItems:"center",gap:6,
            padding:"5px 10px 5px 8px",borderRadius:RADIUS.full,
            border:`1px solid ${CC.border}`,background:CC.surface1,color:CC.textDim,
            fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",
          }}>
          <span style={{fontSize:13}}>⌕</span>
          <span>Команды</span>
          <kbd style={{
            fontFamily:"ui-monospace, SFMono-Regular, monospace",fontSize:9.5,fontWeight:800,
            padding:"1px 5px",borderRadius:3,
            background:"#fff",color:"#475569",border:`1px solid #cbd5e1`,
          }}>⌃K</kbd>
        </button>
        {/* Bookmark counter — visible chip when any saved positions exist. Click opens the
            command palette pre-filtered to "открыть" so the bookmark list is the top result. */}
        {bookmarks.length>0&&<button onClick={()=>sPalOpen(true)} title={`${bookmarks.length} закладок · клик откроет палитру (Ctrl+K)`} className="cc-focus-ring"
          style={{
            display:"inline-flex",alignItems:"center",gap:5,
            padding:"5px 10px",borderRadius:RADIUS.full,
            border:`1px solid #fcd34d`,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",color:"#92400e",
            fontSize:11,fontWeight:900,cursor:"pointer",whiteSpace:"nowrap",
          }}>
          <span style={{fontSize:13,lineHeight:1}}>⭐</span>
          <span>{bookmarks.length}</span>
        </button>}
        {/* Workspace switcher — always visible in the header. Hint shown via tooltip on each chip. */}
        <WorkspaceToolbar preset={wsPreset} onChange={(p)=>{sWsPreset(p);showToast(`Workspace: ${p}`,"info")}}/>

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
            title={`Chessy · баланс ${chessy.balance} · всего заработано ${chessy.lifetime} · клик → магазин`}
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
            {chessy.owned.puzzle_boost&&<span title="Пазл-буст активен!" style={{fontSize:9,marginLeft:2,color:"#ea580c",fontWeight:900}}>⚡</span>}
            {chessy.owned.streak_shield&&<span title="Щит стрика активен!" style={{fontSize:9,marginLeft:1,color:"#3b82f6",fontWeight:900}}>🛡</span>}
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

        {/* Утилиты в шапке — только настройки/help/mute. Стрим, голос, варианты —
            переехали в большие дашборд-тайлы на лендинге. */}
        <Btn
          variant="secondary"
          size="sm"
          icon={<Icon.Settings/>}
          onClick={()=>sShowSettings(true)}
          title="Настройки"
          ariaLabel="Настройки"
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
        <button
          onClick={()=>sShowMusicPlayer(true)}
          title="Музыкальный плеер"
          aria-label="Music player"
          style={{padding:"6px 10px",minHeight:36,minWidth:36,border:`1px solid ${CC.border}`,borderRadius:RADIUS.md,background:CC.surface1,cursor:"pointer",fontSize:16,fontWeight:700,display:"inline-flex",alignItems:"center",justifyContent:"center"}}
        >🎵</button>
      </div>}

      {/* AEVION ecosystem strip удалён 2026-05-13 — отвлекал от игры, занимал зону.
          Кросс-продуктовая навигация остаётся в Wave1Nav (футер/нав) и через прямые ссылки. */}

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

      {/* Identity tab nav — pill-bar с цветовыми маркерами раздела.
          Скрыт на главном экране (setup+play) и во время активной игры/решения пазла —
          юзер: «лишние кнопки сверху». Навигация на главном экране — через hero-карточки
          PLY/PZL/MST. Эта полоска появляется когда юзер уже внутри Puzzles/Coach/Analysis
          и ему нужен путь обратно. */}
      {!streamerMode&&!on&&!pzCurrent&&!scratchOn&&!(setup&&tab==="play")&&(()=>{
        const switchTab=(t:"play"|"puzzles"|"analysis"|"coach")=>{
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
        };
        const sep=()=><div style={{width:1,height:22,background:CC.border,margin:"0 4px",alignSelf:"center"}}/>;
        return <div style={{marginBottom:14,display:"flex",alignItems:"center",gap:SPACE[3],flexWrap:"wrap"}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <SymTab sym={SYM.play}     active={tab==="play"}     onClick={()=>switchTab("play")}/>
            {sep()}
            <SymTab sym={SYM.puzzle}   active={tab==="puzzles"}  onClick={()=>switchTab("puzzles")} count={PUZZLES.length}/>
            <SymTab sym={SYM.coach}    active={tab==="coach"}    onClick={()=>switchTab("coach")}/>
            {sep()}
            <SymTab sym={SYM.analysis} active={tab==="analysis"} onClick={()=>switchTab("analysis")}/>
          </div>
          <div style={{flex:1}}/>
          <button onClick={()=>sShowMultiPanel(true)} title="Multi-panel: chess + YouTube/Twitch streams" className="cc-focus-ring" style={{
            display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",
            borderRadius:RADIUS.full,border:"1px solid #c4b5fd",
            background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",color:CC.accent,
            fontSize:13,fontWeight:800,cursor:"pointer",
            boxShadow:"0 2px 6px rgba(124,58,237,0.18)"
          }}>
            <span>📺</span><span>Multi-panel</span>
          </button>
          {/* Floating PiP — выпустить стрим во всплывающее перетаскиваемое окно поверх доски.
              Если уже открыт — скрываем; если нет — спрашиваем URL и открываем. */}
          <button onClick={()=>{
            if(pip.open){pip.hide();return}
            const url=window.prompt("YouTube или Twitch URL для floating PiP:","https://www.twitch.tv/gmhikaru");
            if(!url)return;
            const src=detectMediaSource(url.trim());
            if(!src){showToast("Не распознал ссылку — нужен YouTube или Twitch URL","error");return}
            pip.show(src);
          }} title="Picture-in-Picture: floating stream window over the board" className="cc-focus-ring" style={{
            display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",marginLeft:6,
            borderRadius:RADIUS.full,
            border:`1px solid ${pip.open?"#fb923c":"#c4b5fd"}`,
            background:pip.open?"linear-gradient(135deg,#fff7ed,#ffedd5)":"linear-gradient(135deg,#f5f3ff,#ede9fe)",
            color:pip.open?"#9a3412":CC.accent,
            fontSize:13,fontWeight:800,cursor:"pointer",
            boxShadow:pip.open?"0 2px 6px rgba(251,146,60,0.25)":"0 2px 6px rgba(124,58,237,0.18)"
          }}>
            <span>{pip.open?"⏏":"📺"}</span><span>{pip.open?"Скрыть PiP":"PiP стрим"}</span>
          </button>
        </div>;
      })()}

      {/* LAUNCHPAD DASHBOARD */}
      {setup&&tab==="play"&&!streamerMode&&(()=>{
        const activeCat:"Bullet"|"Blitz"|"Rapid"|"Custom"=useCustom?"Custom":(TCS[tcI]?.cat as any)||"Blitz";
        const catTcs=TCS.map((t,i)=>({t,i})).filter(x=>x.t.cat===activeCat);
        const catColor={Bullet:"#dc2626",Blitz:"#f59e0b",Rapid:"#10b981",Classical:"#3b82f6",Custom:CC.accent}[activeCat];
        // totalGames is defined at component scope
        const winPct=totalGames?Math.round(sts.w/totalGames*100):0;
        const achTotal=Object.keys(ACH_LABELS).length;
        const achGot=Object.keys(chessy.ach).length;
        const achPct=Math.round(achGot/achTotal*100);
        // Compute current streak from savedGames
        let streak=0;let streakType:"W"|"L"|"D"|null=null;
        for(let i=savedGames.length-1;i>=0;i--){
          const g=savedGames[i];
          const r=g.result.includes("You win")||g.result.includes("win!")?"W":g.result.includes("Draw")||g.result.includes("draw")||g.result.includes("Stalemate")?"D":"L";
          if(streak===0){streakType=r;streak=1}
          else if(r===streakType)streak++;
          else break;
        }
        return<div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:SPACE[3]}}>

          {/* ─── Session stats pill strip ─── */}
          {totalGames>0&&<div style={{
            display:"flex",gap:6,alignItems:"center",
            padding:"8px 12px",borderRadius:RADIUS.lg,
            background:CC.surface1,border:`1px solid ${CC.border}`,
            flexWrap:"wrap"
          }}>
            <span style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const}}>Сессия</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:RADIUS.full,background:"rgba(5,150,105,0.10)",border:"1px solid rgba(5,150,105,0.25)"}}>
              <span style={{fontSize:12,fontWeight:900,color:CC.brand}}>{sts.w}</span>
              <span style={{fontSize:9,fontWeight:800,color:CC.textDim}}>W</span>
            </span>
            <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:RADIUS.full,background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.2)"}}>
              <span style={{fontSize:12,fontWeight:900,color:CC.danger}}>{sts.l}</span>
              <span style={{fontSize:9,fontWeight:800,color:CC.textDim}}>L</span>
            </span>
            {sts.d>0&&<span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 9px",borderRadius:RADIUS.full,background:CC.surface2,border:`1px solid ${CC.border}`}}>
              <span style={{fontSize:12,fontWeight:900,color:CC.textDim}}>{sts.d}</span>
              <span style={{fontSize:9,fontWeight:800,color:CC.textMute}}>D</span>
            </span>}
            <span style={{fontSize:11,fontWeight:800,color:winPct>=60?CC.brand:winPct>=40?CC.textDim:CC.danger}}>{winPct}% WR</span>
            {streak>=2&&streakType&&<span style={{marginLeft:4,fontSize:11,fontWeight:900,color:streakType==="W"?CC.brand:streakType==="L"?CC.danger:CC.textDim,padding:"2px 8px",borderRadius:RADIUS.full,background:streakType==="W"?"rgba(5,150,105,0.08)":streakType==="L"?"rgba(220,38,38,0.08)":CC.surface2}}>
              {streakType==="W"?"🔥":"💔"} {streak}× {streakType==="W"?"серия побед":"серия поражений"}
            </span>}
            <span style={{flex:1}}/>
            {/* Rating sparkline from last 15 saved games */}
            {savedGames.length>=3&&(()=>{
              const pts=savedGames.slice(0,15).map(g=>g.rating).reverse();
              const mn=Math.min(...pts),mx=Math.max(...pts);const rng=Math.max(mx-mn,50);
              const W=48,H=16,pad=2;
              const x=(i:number)=>pad+(i/(pts.length-1))*(W-pad*2);
              const y=(v:number)=>H-pad-(v-mn)/(rng)*(H-pad*2);
              const d=pts.map((v,i)=>`${i===0?"M":"L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
              const up=pts[pts.length-1]>=pts[0];
              const col=up?"#10b981":"#ef4444";
              return <svg width={W} height={H} style={{flexShrink:0,opacity:0.85}} aria-hidden>
                <polyline points={pts.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} fill="none" stroke={col} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx={x(pts.length-1).toFixed(1)} cy={y(pts[pts.length-1]).toFixed(1)} r={2.5} fill={col}/>
              </svg>;
            })()}
            <span style={{fontSize:10,color:CC.textMute,fontWeight:700}}>ELO <b style={{color:CC.gold}}>{rat}</b></span>
            {/* F2-phase: CPI dashboard quick-link */}
            <Link href="/cyberchess/cpi/dashboard" style={{
              display:"inline-flex",alignItems:"center",gap:4,
              padding:"3px 9px",borderRadius:RADIUS.full,
              background:"linear-gradient(135deg,#ede9fe,#ddd6fe)",
              border:"1px solid #c4b5fd",
              fontSize:10,fontWeight:900,color:"#5b21b6",letterSpacing:0.4,
              textDecoration:"none",cursor:"pointer"
            }} title="AEVION Chess Performance Index — детальная аналитика всех партий">
              <span>📊</span><span>CPI</span>
            </Link>
          </div>}

          {/* ─── Daily Goals mini-card ─── */}
          {(()=>{
            const gamesToday=totalGames;const puzzlesToday=pzSolvedCount;
            const g1=Math.min(gamesToday,dailyGoals.gamesGoal);const g2=Math.min(puzzlesToday,dailyGoals.puzzleGoal);
            const g1done=gamesToday>=dailyGoals.gamesGoal;const g2done=puzzlesToday>=dailyGoals.puzzleGoal;
            const g3done=dailyGoals.coachOpened;
            const allDone=g1done&&g2done&&g3done;
            const doneCount=(g1done?1:0)+(g2done?1:0)+(g3done?1:0);
            const overallPct=Math.round(doneCount/3*100);
            return <div style={{
              padding:"10px 14px",borderRadius:RADIUS.lg,
              background:allDone?"linear-gradient(135deg,#f0fdf4,#dcfce7)":"linear-gradient(135deg,#fff,#f9fafb)",
              border:`1px solid ${allDone?"#86efac":CC.border}`,
              display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"
            }}>
              {/* Label */}
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:100}}>
                <span style={{fontSize:14}}>{allDone?"🏆":"🎯"}</span>
                <div>
                  <div style={{fontSize:11,fontWeight:900,color:allDone?"#15803d":CC.text,lineHeight:1.2}}>Цели на сегодня</div>
                  <div style={{fontSize:9,color:CC.textDim,fontWeight:700}}>{doneCount}/3 выполнено</div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{flex:"0 0 60px",height:4,borderRadius:2,background:CC.surface2,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${overallPct}%`,background:allDone?"#10b981":CC.brand,transition:"width 0.5s ease",borderRadius:2}}/>
              </div>
              {/* Goal chips */}
              {([
                {icon:"♟",label:`Сыграй ${dailyGoals.gamesGoal}`,cur:g1,max:dailyGoals.gamesGoal,done:g1done,onClick:()=>{}},
                {icon:"◆",label:`Реши ${dailyGoals.puzzleGoal} пазлов`,cur:g2,max:dailyGoals.puzzleGoal,done:g2done,onClick:()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
                {icon:"🎓",label:"Открой Coach",cur:g3done?1:0,max:1,done:g3done,onClick:()=>{sTab("coach");sSetup(false)}},
              ]).map(g=><button key={g.label} onClick={g.onClick} style={{
                display:"inline-flex",alignItems:"center",gap:5,
                padding:"4px 10px",borderRadius:RADIUS.full,
                border:`1px solid ${g.done?"#86efac":CC.border}`,
                background:g.done?"rgba(16,185,129,0.08)":CC.surface1,
                cursor:g.done?"default":"pointer",
                fontSize:11,fontWeight:700,color:g.done?"#15803d":CC.text,
              }}>
                <span>{g.icon}</span>
                {g.done?<span style={{fontWeight:900}}>✓</span>:<span style={{color:CC.textDim}}>{g.cur}/{g.max}</span>}
                <span style={{textDecoration:g.done?"line-through":"none",opacity:g.done?0.6:1}}>{g.label}</span>
              </button>)}
              {allDone&&<span style={{marginLeft:"auto",fontSize:11,fontWeight:900,color:"#15803d"}}>+30 Chessy завтра!</span>}
            </div>;
          })()}

          {/* ─── HERO: format + color + AI + premoves — компактно вместе ─── */}
          <Card padding={SPACE[3]} elevation="md">
            {/* Формат + Time chips — компактная одна строка с pill-переключателем категории */}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],flexWrap:"wrap"}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1.4,textTransform:"uppercase" as const}}>Формат</span>
                {/* Pill row of 4 small format chips */}
                <div style={{display:"inline-flex",gap:2,padding:2,borderRadius:RADIUS.full,background:CC.surface2,border:`1px solid ${CC.border}`}}>
                  {(["Bullet","Blitz","Rapid","Custom"] as const).map(c=>{
                    const sel=activeCat===c;
                    const tone={Bullet:"#dc2626",Blitz:"#f59e0b",Rapid:"#10b981",Custom:CC.accent}[c];
                    const emoji={Bullet:"💨",Blitz:"⚡",Rapid:"🕐",Custom:"⚙"}[c];
                    return <button key={c} onClick={()=>{
                      if(c==="Custom"){sUseCustom(true);sShowCustom(true);return}
                      sUseCustom(false);
                      const first=TCS.findIndex(t=>t.cat===c);
                      if(first>=0)sTcI(first);
                    }} className="cc-focus-ring" style={{
                      display:"inline-flex",alignItems:"center",gap:5,
                      padding:"5px 12px",borderRadius:RADIUS.full,
                      border:"none",
                      background:sel?"#fff":"transparent",
                      color:sel?tone:CC.textDim,
                      cursor:"pointer",
                      fontSize:12,fontWeight:sel?900:700,
                      boxShadow:sel?`0 1px 3px ${tone}33`:"none",
                      transition:`all ${MOTION.fast} ${MOTION.ease}`,
                    }}>
                      <span style={{fontSize:13}}>{emoji}</span>
                      <span>{c}</span>
                    </button>;
                  })}
                </div>
                {/* Time chips — для активной категории, в той же строке */}
                {activeCat!=="Custom"?(
                  <div style={{display:"inline-flex",gap:4,flexWrap:"wrap"}}>
                    {catTcs.map(({t,i})=>{
                      const selected=!useCustom&&tcI===i;
                      return <button key={i} onClick={()=>{sTcI(i);sUseCustom(false)}} className="cc-focus-ring"
                        style={{padding:"5px 10px",borderRadius:RADIUS.sm,
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
                  <div style={{display:"inline-flex",gap:SPACE[2],alignItems:"center"}}>
                    <label style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:CC.textDim,fontWeight:700}}>
                      Min <input type="number" min={1} max={60} value={customMin}
                        onChange={e=>sCustomMin(Math.max(1,Math.min(60,+e.target.value||1)))}
                        style={{width:48,padding:"4px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontSize:12}}/>
                    </label>
                    <label style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:CC.textDim,fontWeight:700}}>
                      +Inc <input type="number" min={0} max={60} value={customInc}
                        onChange={e=>sCustomInc(Math.max(0,Math.min(60,+e.target.value||0)))}
                        style={{width:48,padding:"4px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontSize:12}}/>
                    </label>
                    <Badge tone="accent" size="sm">{customMin}+{customInc}</Badge>
                  </div>
                )}
                <span style={{flex:1}}/>
                <span style={{fontSize:11,color:CC.textMute,fontWeight:700,whiteSpace:"nowrap"}}>≈ {Math.round(tc.ini/60*2+tc.inc*0.5)} мин</span>
              </div>
            </div>

            {/* Разделитель */}
            <div style={{height:1,background:CC.border,margin:`${SPACE[2]}px 0`}}/>

            {/* Цвет + AI + Премувы — на одной строке (responsive grid) */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))",gap:SPACE[3]}}>
              {/* Color — tight pill row */}
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1.4,textTransform:"uppercase" as const}}>Цвет</span>
                <div style={{display:"inline-flex",gap:2,padding:2,borderRadius:RADIUS.full,background:CC.surface2,border:`1px solid ${CC.border}`}}>
                  {([["w","♔","Белые"],["b","♚","Чёрные"]] as const).map(([v,ic,name])=>{
                    const selected=pCol===v;
                    return <button key={v} onClick={()=>sPCol(v as ChessColor)} className="cc-focus-ring"
                      style={{display:"inline-flex",alignItems:"center",gap:5,
                        padding:"4px 12px",borderRadius:RADIUS.full,border:"none",
                        background:selected?"#fff":"transparent",
                        color:selected?CC.brand:CC.textDim,
                        cursor:"pointer",fontSize:12,fontWeight:selected?900:700,
                        boxShadow:selected?`0 1px 3px ${CC.brand}33`:"none",
                        transition:`all ${MOTION.fast} ${MOTION.ease}`}}
                      title={name}>
                      <span style={{fontSize:14,lineHeight:1}}>{ic}</span>
                      <span>{name}</span>
                    </button>;
                  })}
                  <button onClick={()=>sPCol(Math.random()<0.5?"w":"b")} title="Random цвет"
                    className="cc-focus-ring"
                    style={{display:"inline-flex",alignItems:"center",
                      padding:"4px 10px",borderRadius:RADIUS.full,border:"none",
                      background:"transparent",color:CC.textMute,cursor:"pointer",fontSize:12,fontWeight:700}}>
                    🎲
                  </button>
                </div>
              </div>

              {/* AI opponent */}
              <div>
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                  <span style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1.4,textTransform:"uppercase" as const}}>AI</span>
                  <input type="range" min={0} max={(chessy.owned.master_ai||isPro)?5:4}
                    value={Math.min(aiI,(chessy.owned.master_ai||isPro)?5:4)}
                    onChange={e=>{const v=+e.target.value;if(v===5&&!(chessy.owned.master_ai||isPro)){showToast("Master AI — premium. Купи в Chessy-магазине","info");sShowShop(true);return}sAiI(v)}}
                    style={{flex:1,accentColor:lv.color}}/>
                  <span style={{fontSize:11,fontWeight:800,color:lv.color,whiteSpace:"nowrap"}}>{lv.name} · {lv.elo}{aiI===5&&!(chessy.owned.master_ai||isPro)?" 🔒":""}</span>
                </div>
                {!(chessy.owned.master_ai||isPro)&&<button onClick={()=>sShowShop(true)}
                  className="cc-focus-ring"
                  style={{marginTop:6,padding:"3px 8px",borderRadius:RADIUS.sm,
                    border:"1px solid #fcd34d",background:"#fef3c7",color:"#92400e",
                    fontSize:10,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:3}}>
                  🔒 Master AI · 30 Chessy
                </button>}
              </div>

              {/* Premove queue limit — compact pill row, без range-слайдера */}
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:1.4,textTransform:"uppercase" as const,whiteSpace:"nowrap"}}>⚡ Премувы</span>
                <div style={{display:"inline-flex",gap:2,padding:2,borderRadius:RADIUS.full,background:CC.surface2,border:`1px solid ${CC.border}`}}>
                  {[10,20,30,50].map(n=><button key={n} onClick={()=>sPmLim(n)}
                    style={{padding:"4px 12px",borderRadius:RADIUS.full,fontSize:12,fontWeight:pmLim===n?900:700,
                      border:"none",
                      background:pmLim===n?"#fff":"transparent",
                      color:pmLim===n?CC.info:CC.textDim,cursor:"pointer",
                      boxShadow:pmLim===n?`0 1px 3px ${CC.info}33`:"none",
                      transition:`all ${MOTION.fast} ${MOTION.ease}`}}>{n}</button>)}
                </div>
                <span style={{fontSize:11,fontWeight:900,color:CC.info,fontFamily:"ui-monospace,monospace",marginLeft:"auto"}}>{pmLim}</span>
              </div>
            </div>

            {/* ─── Section 1: QUICK PLAY ─── */}
            <div style={{marginTop:SPACE[3]}}>
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
                  onMouseUp={e=>{(e.currentTarget as HTMLButtonElement).style.transform="translateY(-2px)"}}
                  aria-label="Начать новую партию">
                  <Icon.Play width={18} height={18}/> QUICK START
                </button>
                <Btn size="lg" variant="secondary" onClick={()=>{
                  const targetIdx=rat<600?0:rat<900?1:rat<1300?2:rat<1700?3:rat<2100?4:5;
                  const capped=(chessy.owned.master_ai||isPro)?targetIdx:Math.min(targetIdx,4);
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

              {/* Tertiary: задача / классика / база партий — small inline pills, не доминируют */}
              <div style={{marginTop:SPACE[2],display:"flex",gap:SPACE[2],flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:10,fontWeight:900,color:CC.textMute,letterSpacing:1.4,textTransform:"uppercase" as const}}>А ещё</span>
                <button onClick={()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}}
                  className="cc-focus-ring"
                  style={{padding:"6px 12px",borderRadius:RADIUS.full,
                    border:`1px solid ${CC.border}`,background:CC.surface1,color:CC.text,
                    fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                  ◆ Решить задачу <span style={{color:CC.textMute,fontWeight:600,fontSize:11}}>{PUZZLES.length.toLocaleString()}</span>
                </button>
                <button onClick={()=>{sTab("puzzles");sPzMode("rush" as any);if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}}
                  className="cc-focus-ring"
                  aria-label="Запустить Puzzle Rush"
                  style={{padding:"6px 12px",borderRadius:RADIUS.full,
                    border:`1px solid #fcd34d`,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",color:"#92400e",
                    fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                  ⚡ Puzzle Rush
                </button>
                {/* Lichess Daily Puzzle — fetched live from public CC0 API. */}
                <button disabled={lichessLoading} onClick={async()=>{
                  if(lichessLoading)return;
                  sLichessLoading(true);
                  showToast("⏳ Загружаю Lichess Daily…","info");
                  try{
                    const r=await fetch("https://lichess.org/api/puzzle/daily",{headers:{Accept:"application/json"}});
                    if(!r.ok)throw new Error(`HTTP ${r.status}`);
                    const j=await r.json();
                    // Replay the game's PGN up to puzzle.initialPly to land on the puzzle's start position.
                    const ch=new Chess();
                    const pgnTokens=String(j?.game?.pgn||"").trim().split(/\s+/).filter(Boolean);
                    const ply=Number(j?.puzzle?.initialPly||0);
                    for(let i=0;i<ply&&i<pgnTokens.length;i++){try{ch.move(pgnTokens[i])}catch{break}}
                    // Lichess solution is UCI; the side to move plays first. Convert first move to SAN for our schema.
                    const sols:string[]=Array.isArray(j?.puzzle?.solution)?j.puzzle.solution:[];
                    if(!sols.length)throw new Error("no solution");
                    const first=sols[0];
                    const probe=new Chess(ch.fen());
                    const mv=probe.move({from:first.slice(0,2),to:first.slice(2,4),promotion:first.slice(4)||undefined});
                    if(!mv)throw new Error("solution invalid");
                    const fakePz:Puzzle={
                      name:`Lichess Daily · ${j?.puzzle?.id||"?"}`,
                      r:Number(j?.puzzle?.rating)||1500,
                      theme:(j?.puzzle?.themes?.[0]||"tactics") as any,
                      phase:"Middlegame",
                      side:ch.turn() as "w"|"b",
                      goal:"Best move",
                      mateIn:0,
                      fen:ch.fen(),
                      sol:[mv.san],
                    };
                    sTab("puzzles");
                    setGame(new Chess(fakePz.fen));sBk(k=>k+1);
                    sPzCurrent(fakePz);sPzAttempt("idle");sLm(null);sSel(null);sVm(new Set());
                    sHist([]);sFenHist([fakePz.fen]);sPCol(fakePz.side as any);sFlip(fakePz.side==="b");
                    sOn(true);
                    showToast(`🌐 Lichess Daily · rating ${fakePz.r} · ${j?.puzzle?.themes?.slice(0,2).join(" · ")||""}`,"success");
                  }catch(e:any){
                    showToast(`Lichess недоступен: ${e?.message||"network"}`,"error");
                  }finally{
                    sLichessLoading(false);
                  }
                }}
                  className="cc-focus-ring"
                  style={{padding:"6px 12px",borderRadius:RADIUS.full,
                    border:`1px solid #c4b5fd`,background:lichessLoading?"#f5f3ff":"linear-gradient(135deg,#f5f3ff,#ede9fe)",color:CC.accent,
                    fontSize:12,fontWeight:800,cursor:lichessLoading?"wait":"pointer",
                    display:"inline-flex",alignItems:"center",gap:5,opacity:lichessLoading?0.6:1}}>
                  🌐 Lichess Daily{lichessLoading?" …":""}
                </button>
                <button onClick={()=>{sShowMasters(true);sMasterCurrent(null);sMasterMode("replay")}}
                  className="cc-focus-ring"
                  style={{padding:"6px 12px",borderRadius:RADIUS.full,
                    border:`1px solid ${CC.border}`,background:CC.surface1,color:CC.text,
                    fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                  ★ Классика
                </button>
                <button onClick={()=>{sTab("analysis");sShowAnal(true)}}
                  className="cc-focus-ring"
                  style={{padding:"6px 12px",borderRadius:RADIUS.full,
                    border:`1px solid ${CC.border}`,background:CC.surface1,color:CC.text,
                    fontSize:12,fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}>
                  ▲ Анализ
                </button>
              </div>

            </div>

          </Card>

          {/* ─── Совет дня из Coach Knowledge ─── */}
          {(()=>{
            // Pick a deterministic daily tip from COACH_KNOWLEDGE using date seed
            const now=new Date();const seed=now.getFullYear()*10000+now.getMonth()*100+now.getDate();
            const allEntries=COACH_KNOWLEDGE.flatMap(c=>c.entries.map(e=>({...e,catTitle:c.title})));
            if(allEntries.length===0)return null;
            const tip=allEntries[seed%allEntries.length];
            const shortBody=typeof tip.description==="string"?tip.description.slice(0,120)+(tip.description.length>120?"…":""):String(tip.description).slice(0,120);
            return <div style={{
              padding:"10px 14px",borderRadius:RADIUS.lg,
              background:"linear-gradient(135deg,#fefce8,#fef9c3)",
              border:"1px solid #fde68a",
              display:"flex",gap:10,alignItems:"flex-start"
            }}>
              <span style={{fontSize:20,flexShrink:0}}>💡</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:900,color:"#92400e",letterSpacing:1,textTransform:"uppercase" as const,marginBottom:3}}>
                  Совет дня · {tip.catTitle}
                </div>
                <div style={{fontSize:12,fontWeight:800,color:"#78350f",marginBottom:2}}>{tip.title}</div>
                <div style={{fontSize:11,color:"#92400e",lineHeight:1.5}}>{shortBody}</div>
              </div>
              <button onClick={()=>{sShowKnowledge(true);sTab("coach");sSetup(false)}} style={{
                flexShrink:0,padding:"4px 8px",borderRadius:6,border:"1px solid #fcd34d",
                background:"#fffbeb",color:"#92400e",fontSize:10,fontWeight:800,cursor:"pointer"
              }}>
                Читать →
              </button>
            </div>;
          })()}

          {/* ─── DAILY hub: Daily Variant Challenge + Daily Puzzle side-by-side ─── */}
          {(dailyVariantInfo||(dailyState&&PUZZLES[dailyState.idx]))&&(()=>{
            const hours=24-new Date().getHours();
            return <Card padding={0} elevation="sm" style={{overflow:"hidden",animation:"fadeInUp 0.4s ease-out"}}>
              {/* Slim header — emoji + label + countdown all on one ~24px row */}
              <div style={{padding:"4px 12px",
                background:"linear-gradient(90deg,#fef3c7,#fde68a,#fef3c7)",
                borderBottom:`1px solid ${CC.border}`,
                display:"flex",alignItems:"center",gap:SPACE[2]}}>
                <span style={{fontSize:14}}>☀</span>
                <span style={{fontSize:10,fontWeight:900,color:"#78350f",letterSpacing:1,textTransform:"uppercase" as const}}>Daily</span>
                <span style={{fontSize:10,color:"#92400e",fontWeight:700,opacity:0.75}}>{new Date().toLocaleDateString("ru-RU",{day:"numeric",month:"short"})}</span>
                <div style={{flex:1}}/>
                <span style={{fontSize:10,color:"#92400e",fontWeight:700,opacity:0.75}}>осталось {hours}ч</span>
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

          {/* ─── DASHBOARDS: 3 крупные плитки сгруппированные по смыслу.
                 1. ИГРА: что и как играть (варианты, hotseat, турниры)
                 2. ТРЕНИРОВКА: упражнения для роста (координаты, эндшпиль, личность, editor)
                 3. АНАЛИЗ & СТРИМ: разбор партий + создание контента
              ─── */}
          {(()=>{
            type DashId="play"|"learn"|"meta";
            const dashes:{id:DashId;icon:string;title:string;hint:string;tint:string;ring:string;active:number}[]=[
              {id:"play", icon:"🎮",title:"Игра",         hint:"12 вариантов · Hotseat · P2P · Ghost Duel", tint:"linear-gradient(135deg,#dbeafe,#bfdbfe)",ring:"#3b82f6",active:(variant!=="standard"?1:0)+(hotseat?1:0)+(p2pMode?1:0)+(ghostDuelMode?1:0)},
              {id:"learn",icon:"🎓",title:"Тренировка",   hint:"Координаты · Эндшпиль · Личность · Editor",tint:"linear-gradient(135deg,#fef3c7,#fde68a)",ring:"#d97706",active:0},
              {id:"meta", icon:"📊",title:"Анализ & Стрим",hint:"Game DNA · Insights · OBS · Live-озвучка", tint:"linear-gradient(135deg,#ede9fe,#ddd6fe)",ring:"#7c3aed",active:(streamerMode?1:0)+(liveCommentary?1:0)},
            ];
            const isOpen=(id:DashId)=>activeDash===(id as any);
            const toggle=(id:DashId)=>sActiveDash(v=>v===id?null:(id as any));
            return <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:SPACE[2]}}>
                {dashes.map(d=>{
                  const open=isOpen(d.id);
                  return <button key={d.id} onClick={()=>toggle(d.id)} className="cc-focus-ring" style={{
                    position:"relative",overflow:"hidden",
                    padding:"16px 18px",
                    border:`1px solid ${open?d.ring:"transparent"}`,
                    borderRadius:RADIUS.lg,
                    background:d.tint,
                    boxShadow:open?`0 8px 24px ${d.ring}45, 0 0 0 3px ${d.ring}22`:SHADOW.sm,
                    cursor:"pointer",textAlign:"left",
                    transform:open?"translateY(-3px)":"none",
                    transition:`transform ${MOTION.fast} ${MOTION.ease}, box-shadow ${MOTION.base} ${MOTION.ease}, border-color ${MOTION.fast} ${MOTION.ease}`,
                  }}>
                    {d.active>0&&<span style={{position:"absolute",top:10,right:12,minWidth:20,height:20,padding:"0 7px",borderRadius:10,background:d.ring,color:"#fff",fontSize:11,fontWeight:900,display:"inline-flex",alignItems:"center",justifyContent:"center",letterSpacing:0.3,boxShadow:`0 2px 6px ${d.ring}66`}}>{d.active}</span>}
                    <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                      <span style={{fontSize:34,lineHeight:1}}>{d.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:900,color:CC.text,lineHeight:1.2,letterSpacing:0.2}}>{d.title}</div>
                        <div style={{fontSize:11,color:CC.textDim,marginTop:3,lineHeight:1.3}}>{d.hint}</div>
                      </div>
                      <span style={{fontSize:14,color:d.ring,fontWeight:900,transform:open?"rotate(180deg)":"none",transition:`transform ${MOTION.base} ${MOTION.ease}`}}>▾</span>
                    </div>
                  </button>;
                })}
              </div>
              {/* ───── Раскрытые панели ───── */}
              {activeDash==="play"&&<Card padding={SPACE[3]} elevation="sm">
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[3],paddingBottom:SPACE[2],borderBottom:`1px solid ${CC.border}`}}>
                  <span style={{fontSize:18}}>🎮</span>
                  <span style={{fontSize:13,fontWeight:900,letterSpacing:0.4,color:CC.text,textTransform:"uppercase" as const}}>Игра — конфигурация партии</span>
                </div>
                {/* ── Quick Variant Strip ── 7 quick-launch tiles for the most popular variants.
                    Standard always first; Daily always last (with reward badge). Click sets variant
                    and shows a confirmation toast — user still presses ▶ Сыграть to launch. */}
                {(()=>{
                  const QUICK:VariantId[]=["standard","fischer960","atomic","kingofthehill","threecheck","crazyhouse"];
                  const dailyV=dailyVariantInfo?.variant;
                  const tiles:VariantId[]=[...QUICK];
                  if(dailyV&&!QUICK.includes(dailyV))tiles.push(dailyV);
                  return <div style={{marginBottom:SPACE[3]}}>
                    <div style={{fontSize:10,fontWeight:900,letterSpacing:1,textTransform:"uppercase" as const,color:CC.textDim,marginBottom:SPACE[1]}}>⚡ Быстрый выбор варианта</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(96px,1fr))",gap:6}}>
                      {tiles.map(vid=>{
                        const v=VARIANTS.find(x=>x.id===vid);if(!v)return null;
                        const active=variant===vid;
                        const isDaily=dailyVariantInfo?.variant===vid&&!dailyVariantInfo.played;
                        const stats=variantStats[vid]||{w:0,l:0,d:0};
                        const total=stats.w+stats.l+stats.d;
                        return <button key={vid} onClick={()=>{
                          sVariant(vid);
                          showToast(vid==="standard"?"Стандартный режим":`🎲 ${v.name} — нажми ▶ Сыграть`,"info");
                        }} className="cc-focus-ring" title={v.shortDesc}
                          style={{
                            padding:"10px 6px",borderRadius:RADIUS.md,
                            border:active?`2px solid ${CC.gold}`:`1px solid ${CC.border}`,
                            background:active?"linear-gradient(135deg,#fef3c7,#fde68a)":isDaily?"linear-gradient(135deg,#f5f3ff,#ede9fe)":CC.surface1,
                            cursor:"pointer",position:"relative",
                            display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                            transition:`all ${MOTION.fast} ${MOTION.ease}`
                          }}>
                          {isDaily&&<span style={{position:"absolute",top:-7,right:-3,fontSize:8,fontWeight:900,padding:"1px 5px",borderRadius:RADIUS.full,background:"linear-gradient(90deg,#7c3aed,#a78bfa)",color:"#fff",letterSpacing:0.5}}>+50</span>}
                          <span style={{fontSize:18,lineHeight:1}}>{v.emoji}</span>
                          <span style={{fontSize:11,fontWeight:800,color:active?"#92400e":CC.text,lineHeight:1.15,textAlign:"center"}}>{v.name}</span>
                          {total>0&&<span style={{fontSize:9,color:CC.textMute,fontWeight:700}}>{stats.w}/{total}</span>}
                        </button>;
                      })}
                      <button onClick={()=>sShowVariants(true)} title="Все 12 режимов"
                        style={{padding:"10px 6px",borderRadius:RADIUS.md,border:`1px dashed ${CC.border}`,background:CC.surface1,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:CC.textDim}}>
                        <span style={{fontSize:18,lineHeight:1}}>···</span>
                        <span style={{fontSize:11,fontWeight:800,lineHeight:1.15}}>Ещё {VARIANTS.length-tiles.length}</span>
                      </button>
                    </div>
                  </div>;
                })()}
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:SPACE[2]}}>
                  <button onClick={()=>sShowVariants(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${variant!=="standard"?"#3b82f6":CC.border}`,background:variant!=="standard"?"linear-gradient(135deg,#dbeafe,#bfdbfe)":CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>{variant!=="standard"?VARIANTS.find(v=>v.id===variant)?.emoji||"🎲":"🎲"}</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>12 Вариантов</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Fischer 960 · Atomic · KotH · Crazyhouse · Three-Check +6. Сейчас: <strong>{variant==="standard"?"Стандарт":VARIANTS.find(v=>v.id===variant)?.name}</strong></div>
                  </button>
                  <button onClick={()=>{sHotseat(v=>!v);showToast(hotseat?"Hotseat выкл":"Hotseat вкл — играй вдвоём за одной доской","info")}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${hotseat?"#3b82f6":CC.border}`,background:hotseat?"linear-gradient(135deg,#dbeafe,#bfdbfe)":CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>👥</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Hotseat 1v1</span><span style={{marginLeft:"auto",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:10,background:hotseat?"#3b82f6":"#e5e7eb",color:hotseat?"#fff":CC.textDim}}>{hotseat?"ON":"OFF"}</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Без AI — оба игрока ходят на одном устройстве.</div>
                  </button>
                  {/* P2P — play with friend online via WebRTC */}
                  <button onClick={()=>{
                    const room=genRoomId();const myColor:ChessColor="w";
                    sP2pMode(true);sP2pRoomId(room);sHotseat(false);sRivalMode(false);
                    p2p.host(room);
                    sPCol(myColor);sFlip(false);
                    const url=typeof window!=="undefined"?`${window.location.origin}/cyberchess?room=${room}&color=${myColor}`:`/cyberchess?room=${room}&color=${myColor}`;
                    try{navigator.clipboard.writeText(url).then(()=>showToast(`🤝 Комната ${room} — ссылка скопирована! Жди друга…`,"success"))}catch{showToast(`🤝 Комната: ${room}. Отправь другу эту ссылку`,"info")}
                  }} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${p2pMode?"#059669":CC.border}`,background:p2pMode?"linear-gradient(135deg,#d1fae5,#a7f3d0)":CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🤝</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Друг онлайн</span>{p2p.status!=="idle"&&<span style={{marginLeft:"auto",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:10,background:p2p.status==="connected"?"#059669":"#f59e0b",color:"#fff"}}>{p2p.status==="connected"?"ONLINE":p2p.status==="open"?"Жду…":p2p.status}</span>}</div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>{p2pMode&&p2pRoomId?`Комната: ${p2pRoomId} · ${p2p.latencyMs?`${p2p.latencyMs}ms`:""}`:p2p.errorMsg||"P2P через WebRTC — без сервера. Отправь другу ссылку."}</div>
                  </button>
                  <button onClick={()=>sShowTournament(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🏆</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Турниры</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Свисс / Round-Robin против AI разных рейтингов.</div>
                  </button>
                  <button onClick={()=>sShowVariantStats(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>📈</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Статы по режимам</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Винрейт, средняя точность, любимый вариант.</div>
                  </button>
                </div>
              </Card>}
              {activeDash==="learn"&&<Card padding={SPACE[3]} elevation="sm">
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[3],paddingBottom:SPACE[2],borderBottom:`1px solid ${CC.border}`}}>
                  <span style={{fontSize:18}}>🎓</span>
                  <span style={{fontSize:13,fontWeight:900,letterSpacing:0.4,color:CC.text,textTransform:"uppercase" as const}}>Тренировка — упражнения для роста</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:SPACE[2]}}>
                  <button onClick={()=>{sShowCoord(true);sCoordSession(null);sCoordResult(null);sCoordLB(coordLoadLB())}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🎯</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Координаты</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>30 сек — find the square. Скорость чтения доски.</div>
                  </button>
                  <button onClick={()=>{sTab("coach");setTimeout(()=>sShowKnowledge(true),50)}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🏰</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Эндшпиль</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>6 базовых техник: К+Ф, К+Л, опозиция, треугольник.</div>
                  </button>
                  <button onClick={()=>{sShowQuiz(true);sQuizAnswers([]);sQuizResult(null)}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🧠</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Личность</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>{savedQuizResult?`Твой архетип — ${QUIZ_PLAYERS[savedQuizResult.result.topId].name}`:"10 вопросов · твой шахматный архетип"}</div>
                  </button>
                  <button onClick={()=>{sShowEditor(true);sEditorBoard(edStart());sEditorErrors([])}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>♟</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Editor</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>FEN · ручная расстановка для тренировки конкретных позиций.</div>
                  </button>
                </div>
              </Card>}
              {activeDash==="meta"&&<Card padding={SPACE[3]} elevation="sm">
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[3],paddingBottom:SPACE[2],borderBottom:`1px solid ${CC.border}`}}>
                  <span style={{fontSize:18}}>📊</span>
                  <span style={{fontSize:13,fontWeight:900,letterSpacing:0.4,color:CC.text,textTransform:"uppercase" as const}}>Анализ & Стрим</span>
                </div>
                <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,marginBottom:SPACE[2],textTransform:"uppercase" as const}}>Аналитика игры</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:SPACE[2],marginBottom:SPACE[3]}}>
                  <button onClick={()=>sShowGameDna(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>📈</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Game DNA</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>{savedGames.length>0&&gameDna.insights.length>0?`${gameDna.insights.length} инсайтов по твоему стилю`:"Сыграй 5+ партий — увидишь свой стиль"}</div>
                  </button>
                  <button onClick={()=>sShowInsights(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🔬</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Insights</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>{savedGames.length>0?`Анализ ${savedGames.length} партий — слабости и сильные стороны`:"Сыграй партии — соберём инсайты"}</div>
                  </button>
                  <button onClick={()=>sRepertoireOpen(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>📚</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Репертуар</span><span style={{marginLeft:"auto",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:10,background:"#e5e7eb",color:CC.textDim}}>R</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>{repertoire.entries.length>0?`${repertoire.entries.length} линий сохранено · ${repertoire.entries.reduce((a,e)=>a+e.uses,0)} применений`:"Сохрани свои дебютные линии"}</div>
                  </button>
                  <button onClick={()=>sShowOpeningTrainer(true)} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🎓</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Opening Trainer</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Дрилл дебютов до автоматизма — спарринг с моделями.</div>
                  </button>
                </div>
                <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,marginBottom:SPACE[2],textTransform:"uppercase" as const}}>Контент &amp; Стрим</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:SPACE[2]}}>
                  <button onClick={()=>{sStreamerMode(v=>!v);showToast(streamerMode?"Обычный режим":"Streamer mode — OBS-ready","info")}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${streamerMode?"#7c3aed":CC.border}`,background:streamerMode?"linear-gradient(135deg,#ede9fe,#ddd6fe)":CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>📺</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Streamer Mode</span><span style={{marginLeft:"auto",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:10,background:streamerMode?"#7c3aed":"#e5e7eb",color:streamerMode?"#fff":CC.textDim}}>{streamerMode?"ON":"OFF"}</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>OBS-ready: тёмный фон, чистый интерфейс.</div>
                  </button>
                  <button onClick={()=>{sLiveCommentary(v=>!v);showToast(liveCommentary?"Live-комментарии выкл":"Live-комментарии вкл — Coach говорит вслух","info")}} style={{padding:"14px 16px",borderRadius:RADIUS.md,border:`1px solid ${liveCommentary?"#7c3aed":CC.border}`,background:liveCommentary?"linear-gradient(135deg,#ede9fe,#ddd6fe)":CC.surface1,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",gap:4}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:20}}>🎙</span><span style={{fontSize:13,fontWeight:900,color:CC.text}}>Live Commentary</span><span style={{marginLeft:"auto",fontSize:10,fontWeight:900,padding:"2px 7px",borderRadius:10,background:liveCommentary?"#7c3aed":"#e5e7eb",color:liveCommentary?"#fff":CC.textDim}}>{liveCommentary?"ON":"OFF"}</span></div>
                    <div style={{fontSize:11,color:CC.textDim,lineHeight:1.4}}>Coach читает каждый ход вслух — для зрителей.</div>
                  </button>
                </div>
              </Card>}
            </div>;
          })()}

          {/* PLY/PZL/MST hero — удалён 2026-05-05: дублировал QUICK START + tertiary chips
              в секции «Быстрая игра». Навигация на пазлы / классику теперь через
              маленькие pill-кнопки прямо под главной кнопкой партии. */}
          {false&&(()=>{
            const hero=[
              {sym:SYM.play,title:"Сыграть прямо сейчас",sub:"AI любого уровня · 5 секунд до старта",cta:"Начать партию",onClick:()=>{sSetup(true);sTab("play")}},
              {sym:SYM.puzzle,title:"Решить задачу",sub:`Случайная из ${PUZZLES.length.toLocaleString()} тактических`,cta:"Попробовать",onClick:()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
              {sym:SYM.masters,title:"Изучить классику",sub:"Партии чемпионов · режим «угадай ход»",cta:"Открыть",onClick:()=>{sShowMasters(true);sMasterCurrent(null);sMasterMode("replay")}},
            ];
            return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:SPACE[2]}}>
              {hero.map((h,i)=><button key={i} onClick={h.onClick} className="cc-hero-card" style={{
                position:"relative",overflow:"hidden",
                padding:"18px 18px 16px",
                border:`1px solid ${h.sym.color}33`,
                borderRadius:RADIUS.lg,
                background:`linear-gradient(135deg, #fff 0%, ${h.sym.bg} 120%)`,
                cursor:"pointer",textAlign:"left",
                boxShadow:SHADOW.sm,
                transition:`transform ${MOTION.fast} ${MOTION.ease}, box-shadow ${MOTION.base} ${MOTION.ease}, border-color ${MOTION.base} ${MOTION.ease}`,
              }}
              onMouseEnter={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.transform="translateY(-2px)";el.style.boxShadow=SHADOW.md;el.style.borderColor=`${h.sym.color}66`}}
              onMouseLeave={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.transform="";el.style.boxShadow=SHADOW.sm;el.style.borderColor=`${h.sym.color}33`}}>
                {/* Декоративный знак справа сверху */}
                <div style={{position:"absolute",top:-16,right:-16,width:96,height:96,borderRadius:"50%",background:h.sym.gradient,opacity:0.13,filter:"blur(2px)"}}/>
                <div style={{position:"relative",display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <span style={{
                    width:42,height:42,borderRadius:"50%",
                    background:h.sym.gradient,color:"#fff",
                    display:"inline-flex",alignItems:"center",justifyContent:"center",
                    boxShadow:`0 8px 20px ${h.sym.ring}`,
                  }}>
                    <h.sym.icon size={22} color="#fff"/>
                  </span>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:1.5,color:h.sym.color,textTransform:"uppercase" as const}}>{h.sym.short}</div>
                </div>
                <div style={{position:"relative",fontSize:16,fontWeight:900,color:CC.text,lineHeight:1.2}}>{h.title}</div>
                <div style={{position:"relative",fontSize:12,color:CC.textDim,marginTop:4,lineHeight:1.45}}>{h.sub}</div>
                <div style={{position:"relative",marginTop:14,display:"inline-flex",alignItems:"center",gap:6,fontSize:12,fontWeight:800,color:h.sym.color}}>
                  {h.cta} <span style={{fontSize:14}}>›</span>
                </div>
              </button>)}
            </div>;
          })()}

          {/* ─── Stats strip — горизонтальная компактная полоса ─── */}
          <Card padding={0} tone="surface1" elevation="sm">
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",alignItems:"stretch"}}>
              {/* Rating */}
              <div style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,borderRight:`1px solid ${CC.border}`}}>
                <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Rating</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:2}}>
                  <span style={{fontSize:24,fontWeight:900,color:CC.gold,lineHeight:1.1}}>{rat}</span>
                  <span style={{fontSize:10,color:CC.textDim}}>{rk.t}</span>
                </div>
                {savedGames.length>1&&(()=>{
                  const pts=[...savedGames].reverse().slice(-30).map(g=>g.rating);
                  if(pts.length<2)return null;
                  const mn=Math.min(...pts),mx=Math.max(...pts);const rng=Math.max(30,mx-mn);
                  const dx=100/(pts.length-1);
                  const path=pts.map((v,i)=>`${i===0?"M":"L"}${(i*dx).toFixed(1)} ${(24-((v-mn)/rng)*22).toFixed(1)}`).join(" ");
                  const areaPath=path+` L 100 26 L 0 26 Z`;
                  const trend=pts[pts.length-1]-pts[0];const col=trend>=0?CC.brand:CC.danger;
                  const sparkId=`sg-${trend>=0?"up":"dn"}`;
                  return <div style={{marginTop:4,display:"flex",alignItems:"center",gap:6}}>
                    <svg viewBox="0 0 100 26" preserveAspectRatio="none" style={{flex:1,height:22,display:"block"}}>
                      <defs><linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.3"/><stop offset="100%" stopColor={col} stopOpacity="0"/></linearGradient></defs>
                      <path d={areaPath} fill={`url(#${sparkId})`}/>
                      <path d={path} fill="none" stroke={col} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span style={{fontSize:10,fontWeight:800,color:col}}>{trend>=0?"▲":"▼"}{trend>=0?"+":""}{trend}</span>
                  </div>;
                })()}
              </div>
              {/* Win rate */}
              <div style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,borderRight:`1px solid ${CC.border}`}}>
                <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Win Rate</div>
                {totalGames>0?<>
                  <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:2}}>
                    <span style={{fontSize:24,fontWeight:900,color:winPct>=50?CC.brand:CC.danger,lineHeight:1.1}}>{winPct}%</span>
                    <span style={{fontSize:10,color:CC.textDim}}>· {totalGames} игр</span>
                  </div>
                  <div style={{display:"flex",height:5,borderRadius:RADIUS.full,overflow:"hidden",marginTop:6,background:CC.surface3}}>
                    <div style={{width:`${sts.w/totalGames*100}%`,background:CC.brand}}/>
                    <div style={{width:`${sts.d/totalGames*100}%`,background:"#9ca3af"}}/>
                    <div style={{width:`${sts.l/totalGames*100}%`,background:CC.danger}}/>
                  </div>
                  <div style={{fontSize:10,color:CC.textDim,marginTop:4,fontFamily:"ui-monospace,monospace"}}>{sts.w}W · {sts.l}L · {sts.d}D</div>
                </>:<div style={{fontSize:12,color:CC.textDim,marginTop:6}}>Пока нет игр</div>}
              </div>
              {/* Chessy */}
              <button onClick={()=>sShowShop(true)} style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,borderRight:`1px solid ${CC.border}`,border:"none",borderTop:"none",borderBottom:"none",background:"transparent",textAlign:"left",cursor:"pointer"}}>
                <div style={{fontSize:10,color:"#92400e",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Chessy</div>
                <div style={{display:"flex",alignItems:"baseline",gap:4,marginTop:2}}>
                  <Icon.Coin width={18} height={18}/>
                  <span style={{fontSize:24,fontWeight:900,color:"#78350f",lineHeight:1.1}}>{chessy.balance}</span>
                </div>
                <div style={{fontSize:10,color:CC.textDim,marginTop:2}}>Всего {chessy.lifetime}{chessy.streak>=2?` · 🔥${chessy.streak}д`:""}</div>
              </button>
              {/* Achievements */}
              <button onClick={()=>sShowShop(true)} style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,border:"none",background:"transparent",textAlign:"left",cursor:"pointer"}}>
                <div style={{fontSize:10,color:CC.accent,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Достижения</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginTop:2}}>
                  <span style={{fontSize:24,fontWeight:900,color:CC.accent,lineHeight:1.1}}>{achGot}</span>
                  <span style={{fontSize:12,color:CC.textDim}}>/{achTotal}</span>
                </div>
                <div style={{height:5,borderRadius:RADIUS.full,background:"#ede9fe",marginTop:6,overflow:"hidden"}}>
                  <div style={{width:`${achPct}%`,height:"100%",background:`linear-gradient(90deg,${CC.accent},#a78bfa)`,transition:`width ${MOTION.slow} ${MOTION.ease}`}}/>
                </div>
              </button>
            </div>
          </Card>

          {/* ─── Лидерборды по категориям ─── */}
          {(()=>{
            const categories:LbCategory[]=["blitz","rapid","bullet","puzzles","rush"];
            const myName="Ты";
            // Подбираем рейтинг под категорию: blitz/rapid/bullet — общий rat,
            // puzzles — pzSolvedCount как «индекс силы» (×10 для масштаба),
            // rush — rushBest напрямую.
            const myRatingFor=(c:LbCategory)=>{
              if(c==="puzzles")return 800+pzSolvedCount*8;
              if(c==="rush")return rushBest;
              return rat;
            };
            return <Card padding={0} elevation="sm">
              <div style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,borderBottom:`1px solid ${CC.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                  <span style={{fontSize:22,lineHeight:1}}>🏆</span>
                  <span style={{fontSize:16,fontWeight:900,color:CC.text,letterSpacing:0.4}}>Лидеры площадки</span>
                </div>
                <span style={{fontSize:11,color:CC.textMute,fontWeight:700}}>топ-3 + твоя позиция</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))"}}>
                {categories.map((cat,catIdx)=>{
                  const myRating=myRatingFor(cat);
                  const myRank=findMyRank(cat,myRating);
                  const top=getTopWithMe(cat,myRating,myName,3);
                  const lastBorder=catIdx<categories.length-1;
                  return <div key={cat} style={{padding:`${SPACE[3]}px ${SPACE[3]}px`,borderRight:lastBorder?`1px solid ${CC.border}`:"none",display:"flex",flexDirection:"column",gap:SPACE[1]}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:SPACE[2]}}>
                      <span style={{fontSize:16,fontWeight:900,color:CC.text,letterSpacing:0.4,lineHeight:1.1}}>{CATEGORY_LABEL[cat]}</span>
                      <span style={{fontSize:11,color:CC.textMute,fontWeight:800,padding:"2px 7px",borderRadius:RADIUS.full,background:CC.surface2,border:`1px solid ${CC.border}`}}>#{myRank.toLocaleString()}</span>
                    </div>
                    {top.map(e=><div key={`${cat}-${e.rank}`} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 5px",borderRadius:5,background:e.isMe?"rgba(5,150,105,0.08)":"transparent",border:e.isMe?"1px solid rgba(5,150,105,0.3)":"1px solid transparent"}}>
                      <span style={{width:18,fontSize:9.5,fontWeight:900,color:e.rank<=3?CC.gold:CC.textDim,textAlign:"center"}}>{e.rank}</span>
                      <span style={{fontSize:11,lineHeight:1}}>{e.country}</span>
                      <span style={{flex:1,fontSize:11,fontWeight:e.isMe?900:600,color:e.isMe?CC.brand:CC.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.name}</span>
                      <span style={{fontSize:11,fontWeight:800,color:CC.textDim,fontFamily:"ui-monospace, SFMono-Regular, monospace"}}>{e.rating}</span>
                    </div>)}
                    <button onClick={()=>sLbExpanded(cat)} style={{marginTop:4,padding:"5px 8px",border:"none",background:"transparent",color:CC.brand,fontSize:10.5,fontWeight:800,cursor:"pointer",letterSpacing:0.3,textAlign:"right"}}>Весь топ →</button>
                  </div>;
                })}
              </div>
            </Card>;
          })()}


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
              {savedGames.filter(g=>gamesFilter==="all"||g.category===gamesFilter).slice(0,30).map((g,gIdx)=>{
                const isWin=g.result.includes("You win")||g.result.includes("timed out");
                const isDraw=g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
                const resCol=isWin?CC.brand:isDraw?CC.textDim:CC.danger;
                const catBadge:"danger"|"gold"|"brand"=g.category==="Bullet"?"danger":g.category==="Blitz"?"gold":"brand";
                return(<div key={g.id} className="cc-focus-ring" role="button" tabIndex={0}
                  onClick={()=>{
                    sTab("analysis");
                    const ch=new Chess();
                    for(const san of g.moves)try{ch.move(san)}catch{}
                    setGame(ch);sBk(k=>k+1);sHist(g.moves);
                    const fens=[new Chess().fen()];const tmp=new Chess();
                    for(const san of g.moves){try{tmp.move(san);fens.push(tmp.fen())}catch{}}
                    sFenHist(fens);sOver(g.result);sOn(false);sSetup(false);sSel(null);sVm(new Set());sLm(null);
                  }}
                  onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){(e.currentTarget as HTMLDivElement).click()}}}
                  style={{width:"100%",padding:"8px 12px",borderBottom:`1px solid ${CC.border}`,background:CC.surface1,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",
                    animation:`fadeInUp 0.3s ease-out ${Math.min(gIdx*30,400)}ms both`,
                    borderLeft:`3px solid ${resCol}`,
                    transition:`background ${MOTION.fast} ${MOTION.ease}, padding ${MOTION.fast} ${MOTION.ease}`}}
                  onMouseEnter={e=>{const el=e.currentTarget as HTMLDivElement;el.style.background=CC.surface2;el.style.paddingLeft="16px"}}
                  onMouseLeave={e=>{const el=e.currentTarget as HTMLDivElement;el.style.background=CC.surface1;el.style.paddingLeft="12px"}}>
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
                    {g.moves.length>4&&<button title="⚔ Дуэль с прошлым собой" onClick={evt=>{
                      evt.stopPropagation();
                      const src:GhostSourceGame={id:g.id,date:g.date,moves:g.moves,playerColor:g.playerColor as "w"|"b",result:g.result,rating:g.rating,aiLevel:g.aiLevel,opening:g.opening};
                      const cfg=makeDuelConfig(src,"rematch");
                      sGhostDuelMode(true);sGhostDuelConfig(cfg);sGhostDuelDivergePly(null);
                      sTab("play");sSetup(false);sHotseat(false);sRivalMode(false);sCloneMode(false);sGhostMode(false);sP2pMode(false);
                      const myCol=cfg.userPlaysAs;sPCol(myCol);sFlip(myCol==="b");
                      const ng=new Chess();setGame(ng);sBk(k=>k+1);
                      sHist([]);sFenHist([ng.fen()]);sCapW([]);sCapB([]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPms([]);sPmSel(null);sOn(true);sEvalCp(0);sEvalMate(0);pT.reset();aT.reset();
                      showToast(`👻 Дуэль: ${formatPastDate(g.date)} — ${g.aiLevel}. Попробуй сыграть лучше!`,"success");
                    }} style={{padding:"2px 7px",borderRadius:6,border:`1px solid ${CC.brand}`,background:CC.brandSoft,color:CC.brand,fontSize:10,fontWeight:900,cursor:"pointer"}}>⚔</button>}
                  </div>
                </div>);
              })}
            </div>
          </Card>}
        </div>;
      })()}

      {/* In-game dashboard chips — quick access во время игры, не уходя в модалки.
          Скрыт в setup (там есть hero-карточки) и в streamer mode. */}
      {!streamerMode&&!setup&&on&&tab==="play"&&<div style={{
        display:"flex",flexWrap:"wrap",alignItems:"center",gap:6,
        padding:"6px 10px",marginBottom:10,
        background:"linear-gradient(135deg,rgba(5,150,105,0.04),rgba(124,58,237,0.05))",
        border:`1px solid ${CC.border}`,borderRadius:RADIUS.lg,
      }}>
        <span style={{fontWeight:900,color:CC.textDim,letterSpacing:0.5,textTransform:"uppercase" as const,fontSize:10,marginRight:6}}>⚡ Быстрый доступ</span>
        {[
          {label:"📊 Анализ",hint:"Открыть анализ позиции",onClick:()=>{sTab("analysis");showToast("Анализ","info")}},
          {label:"🧠 Коуч",hint:"Спросить коуча",onClick:()=>{sTab("coach");showToast("Коуч","info")}},
          {label:"🧩 Пазлы",hint:"Решить тактику",onClick:()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
          {label:"⚡ Puzzle Rush",hint:"Скоростной режим",onClick:()=>{sTab("puzzles");sPzMode("rush");if(PUZZLES.length)ldPz(0)}},
          {label:"🎲 Варианты",hint:"12 вариантов шахмат",onClick:()=>sShowVariants(true)},
          {label:"📅 Daily",hint:"Дневной пазл",onClick:()=>{sTab("puzzles");if(dailyState&&PUZZLES[dailyState.idx])ldPz(dailyState.idx)}},
          {label:"📚 Репертуар",hint:"Свои дебюты",onClick:()=>sRepertoireOpen(true)},
          {label:"🏆 Турниры",hint:"Bracket + leaderboard",onClick:()=>sShowTournament(true)},
          {label:hotseat?"🤝 Hotseat вкл":"🤝 Hotseat",hint:"Игра вдвоём за одной доской",onClick:()=>{sHotseat(v=>!v);showToast(hotseat?"Hotseat выкл":"Hotseat вкл","info")}},
          {label:"🎵 Музыка",hint:"Открыть плеер",onClick:()=>sShowMusicPlayer(true)},
          {label:"⚙ Настройки",hint:"Звуки фигур, темы, опции",onClick:()=>sShowSettings(true)},
        ].map((c,i)=><button key={i} onClick={c.onClick} title={c.hint}
          style={{
            padding:"4px 10px",borderRadius:RADIUS.full,
            background:CC.surface1,border:`1px solid ${CC.border}`,color:CC.text,
            fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap" as const,
            transition:`all ${MOTION.fast} ${MOTION.ease}`,
          }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor=CC.borderStrong;(e.currentTarget as HTMLElement).style.background="#fff"}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor=CC.border;(e.currentTarget as HTMLElement).style.background=CC.surface1}}>
          {c.label}
        </button>)}
      </div>}

      {/* Board + Panel + (optional) Media Pane — stretch all panels to fill height */}
      {(!setup||tab==="puzzles"||tab==="analysis"||tab==="coach")&&<div className="cc-main-row" style={{display:"flex",gap:12,flexWrap:"nowrap",alignItems:"flex-start",width:"100%"}} onContextMenu={e=>{e.preventDefault();if(pms.length>0)sPms(p=>p.slice(0,-1));else if(pmSel)sPmSel(null)}}>
        {/* Inline media pane on the LEFT — visible only in Stream workspace */}
        {wsShowMedia&&<WorkspaceMediaPane/>}
        <div style={{flexShrink:0}}>
          {/* ─── Active Lesson banner — shown when user loaded a position from a Coach Lesson ─── */}
          {activeLesson&&<div style={{
            marginBottom:6,padding:"6px 12px",borderRadius:RADIUS.md,
            background:"linear-gradient(135deg,#eff6ff,#dbeafe)",
            border:"1px solid #93c5fd",
            width:"min(calc(100vh - 160px),calc(100vw * 0.6),900px)",
            display:"flex",alignItems:"center",gap:SPACE[2],
          }}>
            <span style={{fontSize:16}}>{activeLesson.emoji}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:900,color:"#1e3a8a",letterSpacing:0.3,textTransform:"uppercase" as const}}>Урок · {activeLesson.title}</div>
              <div style={{fontSize:10,color:"#3b82f6",fontWeight:700}}>Шаг {activeLesson.step+1} · реши позицию на доске → вернись к уроку</div>
            </div>
            <button onClick={()=>{sShowLessons(true)}} style={{padding:"5px 10px",borderRadius:RADIUS.sm,border:`1px solid #93c5fd`,background:"#fff",color:"#1e3a8a",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>
              📖 К уроку
            </button>
            <button onClick={()=>sActiveLesson(null)} style={{padding:"4px 8px",borderRadius:RADIUS.sm,border:"none",background:"transparent",color:"#94a3b8",fontSize:13,cursor:"pointer"}}>✕</button>
          </div>}
          {/* ── Chess.com-style player rows ─────────────────────
              Показываются всегда в game mode, даже без таймера. */}
          {(on||over)&&tab!=="analysis"&&!setup&&(()=>{
            // Material count: unicode → point value
            const PIECE_VAL:Record<string,number>={"♕":9,"♛":9,"♖":5,"♜":5,"♗":3,"♝":3,"♘":3,"♞":3,"♙":1,"♟":1};
            const pieceVal=(s:string)=>PIECE_VAL[s]||0;
            const wMat=capB.reduce((s,c)=>s+pieceVal(c),0);
            const bMat=capW.reduce((s,c)=>s+pieceVal(c),0);
            const al=ALS[aiI];
            const bw="min(calc(100vh - 160px),calc(100vw * 0.6),900px)";
            const PRow=({isAI,time,isActive,lowTime,captures,advantage}:{isAI:boolean;time:number;isActive:boolean;lowTime:boolean;captures:string[];advantage:number})=>{
              const name=isAI?al.name+" AI":"Вы";
              const elo=isAI?al.elo:rat;
              return <div style={{
                display:"flex",alignItems:"center",justifyContent:"space-between",
                width:bw,padding:"5px 0",gap:8,
                borderLeft:isActive?`3px solid ${CC.brand}`:"3px solid transparent",
                paddingLeft:isActive?6:6,
                transition:"border-color 200ms",
              }}>
                {/* Avatar + name + rank */}
                <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                  <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                    background:isAI?al.color+"22":"rgba(255,255,255,0.08)",
                    border:`1px solid ${isAI?al.color+"44":CC.border}`,
                    fontSize:16,flexShrink:0}}>
                    {isAI?"🤖":"👤"}
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <span style={{fontSize:13,fontWeight:800,color:CC.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                      <span style={{fontSize:10,fontWeight:700,color:isAI?al.color:CC.accent,background:isAI?al.color+"18":CC.accentSoft,padding:"1px 5px",borderRadius:4}}>{elo}</span>
                    </div>
                    {/* Захваченные фигуры + advantage */}
                    <div style={{display:"flex",alignItems:"center",gap:2,marginTop:1,flexWrap:"wrap"}}>
                      {captures.map((c,i)=><span key={i} style={{fontSize:12,lineHeight:1,color:CC.textDim,opacity:0.9}}>{c}</span>)}
                      {advantage>0&&<span style={{fontSize:10,fontWeight:800,color:CC.brand,marginLeft:2}}>+{advantage}</span>}
                    </div>
                  </div>
                </div>
                {/* Clock */}
                {tc.ini>0&&<div style={{
                  fontSize:20,fontWeight:900,fontFamily:"ui-monospace,monospace",letterSpacing:-0.5,
                  color:lowTime?"#e04040":isActive?CC.brand:CC.textMute,
                  background:isActive?"rgba(255,255,255,0.04)":"transparent",
                  padding:"4px 10px",borderRadius:6,
                  animation:lowTime&&isActive?"cc-clock-pulse 1s ease-in-out infinite":undefined,
                  transition:"color 300ms",
                }}>{fmt(time)}</div>}
              </div>;
            };
            // Верхняя строка (противник) + нижняя (игрок)
            const topIsAI=pCol==="w"; // белые играют снизу
            const aiLow=aT.time<30000&&on&&!over;
            const myLow=pT.time<30000&&on&&!over;
            return <div style={{display:"flex",flexDirection:"column",gap:1,marginBottom:4}}>
              {topIsAI
                ?<PRow isAI={true} time={aT.time} isActive={game.turn()===aiC&&on&&!over} lowTime={aiLow} captures={capW} advantage={bMat-wMat>0?bMat-wMat:0}/>
                :<PRow isAI={false} time={pT.time} isActive={myT&&on&&!over} lowTime={myLow} captures={capB} advantage={wMat-bMat>0?wMat-bMat:0}/>}
            </div>;
          })()}

          {/* Recent-moves chip-row removed — list lives in the right panel.
              The premove queue moved to the TOP of that move list (right panel). */}

          <div translate="no" style={{display:"flex",width:"min(calc(100vh - 160px),calc(100vw * 0.6),900px)",gap:4}}>
            {/* Eval bar — with W/B labels + centered numeric badge.
                Hidden in P2P mode (no analysis surface during human matches). */}
            {sfOk&&!p2pMode&&(tab==="analysis"||tab==="play"||tab==="coach")&&(()=>{
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
              const absCp=Math.abs(evalMate!==0?9999:evalCp);
              const strengthLabel=evalMate!==0?`M${Math.abs(evalMate)}`:absCp<20?"=":absCp<60?"±":absCp<150?"+":absCp<350?"±±":"±±±";
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
                <div style={{fontSize:8,fontWeight:900,color:absCp<20?CC.textMute:isWhiteBetter?CC.accent:CC.danger,letterSpacing:0.5,textAlign:"center",marginTop:2}}>{strengthLabel}</div>
              </div>);
            })()}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:6,paddingLeft:2,width:16}}>{rws.map(r=><div key={r} style={{fontSize:11,color:CC.textMute,fontWeight:800,textAlign:"center",fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:0.5}}>{8-r}</div>)}</div>
            <div ref={boardRef}
              onPointerDown={onBoardDown}
              draggable={false}
              onDragStart={e=>e.preventDefault()}
              onMouseMove={e=>{
                // Hover-dots: вычисляем возможные ходы фигуры под курсором синхронно.
                // Показываем только если нет активного sel (иначе sel-vm приоритетнее).
                if(sel)return;
                const sq=sqFromPoint(e.clientX,e.clientY);
                if(sq===hoverSq)return;
                sHoverSq(sq);
                if(!sq||over||!on&&tab==="play"){sHoverVm(new Set());return;}
                const pc=game.get(sq);
                // Показываем ходы только для своих фигур (или в анализе — для любых)
                if(!pc||(tab==="play"&&pc.color!==pCol)){sHoverVm(new Set());return;}
                const moves=game.moves({verbose:true,square:sq});
                sHoverVm(new Set(moves.map(m=>m.to)));
              }}
              onMouseLeave={()=>{sHoverSq(null);sHoverVm(new Set());}}
              onClick={e=>{
                // Pointerdown arms the gesture; window-pointerup decides drop vs tap
                // and delegates taps to click(). onClick here only clears annotations
                // (e.g., right-click arrows) when the user clicks empty space.
                if(Date.now()-recentDragRef.current<300)return;
                const sq=sqFromPoint(e.clientX,e.clientY);if(!sq)return;
                if(arrows.length>0||sqHL.length>0)clearAnnotations();
              }}
              onMouseDown={e=>{
                if(e.button!==2)return;
                const sq=sqFromPoint(e.clientX,e.clientY);if(!sq)return;
                rcStartRef.current=sq;e.preventDefault();
              }}
              onMouseUp={e=>{
                if(e.button!==2)return;
                const sq=sqFromPoint(e.clientX,e.clientY);if(!sq)return;
                const start=rcStartRef.current;rcStartRef.current=null;
                if(!start)return;
                const col=annotColor(e);
                // Right-click DRAG (start≠sq) → стрелка-размышление. Работает ВО ВСЕХ режимах
                // включая ход соперника, как у lichess/chess.com.
                if(start!==sq){
                  sArrows(a=>{const i=a.findIndex(x=>x.from===start&&x.to===sq&&x.c===col);if(i>=0)return a.filter((_,j)=>j!==i);return [...a,{from:start,to:sq,c:col}]});
                  return;
                }
                // Right-click на тот же квадрат: если на нём премув — удалить премув
                // (старая полезная фича). Иначе — toggle highlight.
                const pmIdx=pms.findIndex(p=>p.from===sq||p.to===sq);
                if(pmIdx>=0){
                  const cancelled=pms[pmIdx];
                  sPms(p=>p.filter((_,i)=>i!==pmIdx));
                  snd("cancel"); // distinct sound for premove cancel
                  sCancelFlash({sq:cancelled.from,key:Date.now()});
                  showToast(`Премув отменён · ${cancelled.from}→${cancelled.to}`,"info");
                  return;
                }
                sSqHL(hl=>{const i=hl.findIndex(x=>x.sq===sq&&x.c===col);if(i>=0)return hl.filter((_,j)=>j!==i);const other=hl.filter(x=>x.sq!==sq);return [...other,{sq,c:col}]});
              }}
              onContextMenu={e=>{e.preventDefault();e.stopPropagation();}}
              className={`${bk<=2&&on?"cc-board-enter":""}${chk?" cc-check-flash":""}${over&&over.includes("win")?" cc-win-glow":""}${over&&over.includes("сдался")&&!over.includes("Вы")?" cc-loss-dim":""}`}
              style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`2px solid ${bT.border}`,boxShadow:"0 10px 40px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.12)",position:"relative",touchAction:"none",userSelect:"none",WebkitUserSelect:"none",...({WebkitUserDrag:"none",WebkitTouchCallout:"none"} as React.CSSProperties)}}>
              {/* Board Art decorative overlay — behind pieces, subtle at opacity 0.10 */}
              {boardArt!=="off"&&<BoardArtOverlay art={boardArt} opacity={0.10}/>}
              {/* Threat Heatmap overlay (killer #12) */}
              {showThreatMap&&(()=>{
                const tm:ThreatMap=computeThreatMap(bd as any);
                return <div style={{position:"absolute",inset:0,display:"grid",gridTemplateColumns:"repeat(8,1fr)",pointerEvents:"none",zIndex:4}}>
                  {rws.flatMap(r=>cls.map(c=>{
                    const cell=tm[r][c];
                    const col=threatCellColor(cell);
                    const total=cell.w+cell.b;
                    const numCol=cell.w>cell.b?"#065f46":cell.b>cell.w?"#7f1d1d":"#92400e";
                    return <div key={`tm-${r}-${c}`} style={{aspectRatio:"1",background:col,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",padding:2}}>
                      {total>0&&<span style={{fontSize:9,fontFamily:"ui-monospace, SFMono-Regular, monospace",fontWeight:900,color:numCol,background:"rgba(255,255,255,0.78)",borderRadius:3,padding:"0 3px",lineHeight:1.3,boxShadow:"0 1px 2px rgba(0,0,0,0.12)"}}>{cell.w>0&&cell.b>0?`${cell.w}·${cell.b}`:total}</span>}
                    </div>;
                  }))}
                </div>;
              })()}
              {/* Premove arrows — синие стрелки очереди премувов поверх доски (lichess-style) */}
              {pms.length>0&&(()=>{
                const sqXY=(sq:Square):[number,number]=>{
                  const f=FILES.indexOf(sq[0]);const r=8-parseInt(sq[1]);
                  const c=flip?7-f:f;const rr=flip?7-r:r;
                  return [c*12.5+6.25,rr*12.5+6.25];
                };
                return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:5}}>
                  <defs>
                    <marker id="cc-pm-head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="3.4" markerHeight="3.4" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#2563eb"/></marker>
                  </defs>
                  {pms.map((pm,i)=>{
                    const[x1,y1]=sqXY(pm.from);const[x2,y2]=sqXY(pm.to);
                    const dx=x2-x1,dy=y2-y1,len=Math.max(0.01,Math.hypot(dx,dy));
                    const tx=x2-(dx/len)*3.7,ty=y2-(dy/len)*3.7;
                    // Slight offset для каждой следующей стрелки чтобы видеть очередь
                    const off=i*0.4;
                    return <g key={`pm-${i}`} opacity={0.78-i*0.08}>
                      <line x1={x1+off} y1={y1+off} x2={tx+off} y2={ty+off}
                        stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"
                        markerEnd="url(#cc-pm-head)"/>
                      <circle cx={x1} cy={y1} r="2.4" fill="#2563eb" opacity={0.5}/>
                    </g>;
                  })}
                </svg>;
              })()}
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
                const isShadow=!scratchOn&&!!(pms.length>0&&p&&(!realP||realP.type!==p.type||realP.color!==p.color));
                const turnRef=scratchOn&&scratchGame?scratchGame.turn():game.turn();
                const iS=effSel===sq,iV=effVm.has(sq),iCp=iV&&!!p,iL=!!(effLm&&(effLm.from===sq||effLm.to===sq)),iCk=!!(chk&&p?.type==="k"&&p.color===turnRef),iPM=!scratchOn&&pmSet.has(sq),iPS=!scratchOn&&pmSel===sq;
                // Hover preview — показываем когда нет active sel
                const iHover=!sel&&hoverVm.has(sq);
                const iHoverCap=iHover&&!!p;
                let bg=lt?bT.light:bT.dark;
                if(iCk)bg=T.chk;else if(iPS)bg=T.pmS;else if(iPM)bg=T.pm;else if(iS)bg=T.sel;else if(iCp)bg=T.cap;else if(iV)bg=T.valid;else if(iL)bg=T.last;
                const isDragOrigin=ghostFrom===sq;
                const isAnimDest=moveAnim?.to===sq;
                // Lichess-style board coordinates: rank on left col, file on bottom row
                const isLeftCol=c===(flip?7:0);
                const isBottomRow=r===(flip?0:7);
                return <Cell key={sq} sq={sq}
                  pieceType={(p?.type as any)||null}
                  pieceColor={(p?.color as any)||null}
                  bg={bg} cursor={!over&&p?.color===pCol?"grab":"default"}
                  iS={iS} iV={iV} iCk={iCk} iPM={iPM} iPS={iPS} iL={iL}
                  iHover={iHover} iHoverCap={iHoverCap}
                  isShadow={isShadow} isAnimDest={isAnimDest} isDragOrigin={isDragOrigin}
                  pmIdx={pmToIdx.get(sq)}
                  coordRank={isLeftCol?parseInt(sq[1]):undefined}
                  coordFile={isBottomRow?sq[0]:undefined}/>;
              }))}
              {/* Premove cancel flash — красный pulse на FROM-клетке отменённого премува */}
              {cancelFlash&&(()=>{
                const cf=FILES.indexOf(cancelFlash.sq[0]);
                const cr=8-parseInt(cancelFlash.sq[1]);
                const cc=flip?7-cf:cf;const crr=flip?7-cr:cr;
                return <div key={`cancel-${cancelFlash.key}`} className="cc-cancel-flash"
                  style={{position:"absolute",left:`${cc*12.5}%`,top:`${crr*12.5}%`,width:"12.5%",height:"12.5%",pointerEvents:"none",zIndex:7,boxSizing:"border-box"}}/>;
              })()}
              {/* Capture animation — захваченная фигура pop+fade на cell взятия */}
              {capAnim&&(()=>{
                const cf=FILES.indexOf(capAnim.sq[0]);
                const cr=8-parseInt(capAnim.sq[1]);
                const cc=flip?7-cf:cf;const crr=flip?7-cr:cr;
                return <div key={capAnim.key} style={{position:"absolute",left:`${cc*12.5}%`,top:`${crr*12.5}%`,width:"12.5%",height:"12.5%",pointerEvents:"none",zIndex:7,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{width:"88%",height:"88%",animation:"cc-capture-pop 220ms cubic-bezier(0.4,0,0.2,1) forwards"}}>
                    <Piece type={capAnim.piece.type} color={capAnim.piece.color}/>
                  </div>
                </div>;
              })()}
              {/* "Your turn" flash — brief inner-glow overlay when AI just moved.
                  Keyed on turnFlashKey so each transition mounts a fresh overlay
                  whose CSS animation runs once and self-removes via opacity 0. */}
              {turnFlashKey>0&&<div key={`tflash-${turnFlashKey}`}
                className="cc-turn-flash"
                style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:6,borderRadius:6}}/>}
              {/* Hover halo — теперь imperative DOM-нода в useBoardInput,
                  чтобы не триггерить ре-рендер 8000-строчного дерева на каждом
                  пересечении клетки во время drag. */}
              {/* Ghost moved to sibling of main so overflow:hidden of board cannot clip it */}

              {/* Move slide animation — летящая фигура поверх board */}
              {moveAnim&&(()=>{
                const fromF=FILES.indexOf(moveAnim.from[0]);
                const fromR=8-parseInt(moveAnim.from[1]);
                const toF=FILES.indexOf(moveAnim.to[0]);
                const toR=8-parseInt(moveAnim.to[1]);
                const fc=flip?7-fromF:fromF;
                const fr=flip?7-fromR:fromR;
                const tc=flip?7-toF:toF;
                const tr=flip?7-toR:toR;
                const dx=(fc-tc)*100,dy=(fr-tr)*100;
                return <div ref={moveAnimElRef} key={moveAnim.key} style={{
                  position:"absolute",
                  left:`${tc*12.5}%`,top:`${tr*12.5}%`,
                  width:"12.5%",height:"12.5%",
                  transform:`translate(${dx}%,${dy}%)`,
                  transition:"transform 0ms",
                  pointerEvents:"none",zIndex:6,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }}>
                  <div style={{width:"88%",height:"88%",filter:"drop-shadow(0 6px 12px rgba(0,0,0,0.32))"}}>
                    <Piece type={moveAnim.piece.type} color={moveAnim.piece.color}/>
                  </div>
                </div>;
              })()}

              {/* Keyboard SAN input — плавающая плашка с буфером */}
              {sanBuf&&<div style={{
                position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",
                padding:"6px 14px",borderRadius:999,
                background:sanFlash==="err"?"rgba(220,38,38,0.92)":"rgba(15,23,42,0.92)",
                color:"#fff",fontSize:13,fontWeight:900,fontFamily:"ui-monospace, SFMono-Regular, monospace",
                letterSpacing:1,zIndex:6,pointerEvents:"none",
                boxShadow:"0 8px 22px rgba(0,0,0,0.35)",
                border:`1px solid ${sanFlash==="err"?"#fca5a5":"rgba(255,255,255,0.18)"}`,
                whiteSpace:"nowrap",
              }}>
                <span style={{opacity:0.7,fontSize:10,fontWeight:700,marginRight:6,letterSpacing:0.5}}>⌨ ХОД</span>
                {sanBuf}<span style={{opacity:0.6,animation:"cc-fade-in 0.6s ease-out infinite alternate"}}>_</span>
              </div>}
            </div>
          </div>
          <div style={{display:"flex",paddingLeft:23,width:"min(calc(100vh - 160px),calc(100vw * 0.6),900px)"}}><div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,marginTop:4}}>{cls.map(c=><div key={c} style={{textAlign:"center",fontSize:11,color:CC.textMute,fontWeight:800,fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:0.5,textTransform:"uppercase" as const}}>{FILES[c]}</div>)}</div></div>

          {/* Нижняя player row (свой игрок) — chess.com style */}
          {(on||over)&&tab!=="analysis"&&!setup&&(()=>{
            const PV2:Record<string,number>={"♕":9,"♛":9,"♖":5,"♜":5,"♗":3,"♝":3,"♘":3,"♞":3,"♙":1,"♟":1};
            const pieceVal2=(s:string)=>PV2[s]||0;
            const wMat2=capB.reduce((s,c)=>s+pieceVal2(c),0);const bMat2=capW.reduce((s,c)=>s+pieceVal2(c),0);
            const bottomIsMe=pCol==="w";
            const myCaptures=bottomIsMe?capB:capW;
            const myAdvantage=bottomIsMe?Math.max(0,wMat2-bMat2):Math.max(0,bMat2-wMat2);
            const myLow=pT.time<30000&&on&&!over;
            return <div style={{
              display:"flex",alignItems:"center",justifyContent:"space-between",
              width:"min(calc(100vh - 160px),calc(100vw * 0.6),900px)",
              padding:"5px 0",marginTop:2,gap:8,
              borderLeft:myT&&on&&!over?`3px solid ${CC.brand}`:"3px solid transparent",
              paddingLeft:6,transition:"border-color 200ms",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:0}}>
                <div style={{width:32,height:32,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",
                  background:"rgba(255,255,255,0.08)",border:`1px solid ${CC.border}`,fontSize:16,flexShrink:0}}>
                  👤
                </div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{fontSize:13,fontWeight:800,color:CC.text}}>Вы</span>
                    <span style={{fontSize:10,fontWeight:700,color:CC.accent,background:CC.accentSoft,padding:"1px 5px",borderRadius:4}}>{rat}</span>
                    <span style={{fontSize:10,color:CC.textDim}}>{gRank(rat).t}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:2,marginTop:1}}>
                    {myCaptures.map((c,i)=><span key={i} style={{fontSize:12,lineHeight:1,color:CC.textDim}}>{c}</span>)}
                    {myAdvantage>0&&<span style={{fontSize:10,fontWeight:800,color:CC.brand,marginLeft:2}}>+{myAdvantage}</span>}
                  </div>
                </div>
              </div>
              {tc.ini>0&&<div style={{
                fontSize:20,fontWeight:900,fontFamily:"ui-monospace,monospace",letterSpacing:-0.5,
                color:myLow?"#e04040":myT&&on&&!over?CC.brand:CC.textMute,
                padding:"4px 10px",borderRadius:6,
                background:myT&&on&&!over?"rgba(255,255,255,0.04)":"transparent",
                animation:myLow&&myT&&on&&!over?"cc-clock-pulse 1s ease-in-out infinite":undefined,
              }}>{fmt(pT.time)}</div>}
            </div>;
          })()}

          {/* Controls — under-board strip. Game-essentials only. Heatmap/Whisper/Share/History live in the
              right-sidebar Tools card to reduce visual clutter under the board. */}
          <div style={{display:"flex",gap:8,marginTop:SPACE[2],flexWrap:"wrap"}}>
            <Btn size="md" variant="secondary" icon={<Icon.Flip width={16} height={16}/>} onClick={()=>sFlip(!flip)}>Flip</Btn>
            <Btn size="md" variant="primary" onClick={()=>{sSetup(true);sOn(false);sOver(null);sPms([])}}>New Game</Btn>
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
                  // Determine if this is premove time (AI's turn, game on)
                  const isPM=tab!=="analysis"&&game.turn()!==pCol&&on&&!over;
                  if(isPM){
                    // PREMOVE PATH — validate against virtualGame (with queued premoves applied)
                    // and add to pms queue. Uses same premoveLegalMoves as drag/click.
                    if(pmsRef.current.length>=pmLim){showToast(`⚡ Очередь премувов полна (${pmLim})`,"info");matched=true;break}
                    // Build virtualGame with pCol forced + queued premoves applied
                    let vG:Chess;
                    try{
                      vG=new Chess(game.fen());
                      const fp=vG.fen().split(" ");fp[1]=pCol;
                      try{vG.load(fp.join(" "))}catch{}
                      for(const pm of pmsRef.current){
                        const fp2=vG.fen().split(" ");fp2[1]=pCol;
                        try{vG.load(fp2.join(" "))}catch{}
                        try{vG.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"})}catch{}
                      }
                    }catch{vG=new Chess(game.fen())}
                    if(v.from&&v.to){
                      const legal=premoveLegalMoves(vG,pCol,v.from as Square);
                      if(legal.find((m:any)=>m.to===v.to)){
                        const piece=vG.get(v.from as Square);
                        const pre:Pre={from:v.from as Square,to:v.to as Square};
                        const promoRank=pCol==="w"?"8":"1";
                        if(piece?.type==="p"&&v.to[1]===promoRank)pre.pr="q";
                        sPms(p=>[...p,pre]);snd("premove");
                        showToast(`⚡ Премув: ${v.from}→${v.to}`,"success");
                        matched=true;break;
                      }
                    }else if(v.san){
                      // Try to resolve SAN against virtualGame
                      try{
                        const fp3=vG.fen().split(" ");fp3[1]=pCol;
                        try{vG.load(fp3.join(" "))}catch{}
                        const mv=vG.move(v.san);
                        if(mv){
                          const pre:Pre={from:mv.from as Square,to:mv.to as Square};
                          if(mv.promotion)pre.pr=mv.promotion as any;
                          sPms(p=>[...p,pre]);snd("premove");
                          showToast(`⚡ Премув: ${v.san}`,"success");
                          matched=true;break;
                        }
                      }catch{}
                    }
                  }else if(v.from&&v.to){
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
            {(tab==="play"||tab==="coach"||tab==="analysis")&&<Btn size="md" variant="secondary" onClick={()=>{
              const input=prompt("Введи ход в алгебраической нотации (например: e4, Nf3, O-O, exd5):");
              if(!input)return;
              const san=input.trim();
              try{
                const mv=game.move(san);
                if(mv){game.undo();const legal=game.moves({verbose:true}).find(x=>x.san===mv.san);if(legal){exec(legal.from,legal.to);showToast(`✓ ${san}`,"success")}}
                else showToast(`Невозможный ход: ${san}`,"error");
              }catch{showToast(`Невозможный ход: ${san}`,"error")}
            }}>⌨️ Ход текстом</Btn>}
            {over&&<Btn size="md" variant="gold" onClick={()=>newG()}>🔁 Rematch</Btn>}
            {over&&<Btn size="md" variant="secondary" title="Скопировать итог партии" onClick={()=>{
              const summary=`AEVION CyberChess · ${over} · ${hist.length} ходов · ${currentOpening?.name||"Стандарт"} · ELO ${rat}\nhttps://aevion.app/cyberchess`;
              try{navigator.clipboard.writeText(summary).then(()=>showToast("📤 Итог скопирован в буфер","success")).catch(()=>showToast("Не удалось скопировать","error"))}catch{showToast("Clipboard недоступен","error")}
            }}>📤 Поделиться</Btn>}
            {over&&!hotseat&&<Btn size="md" variant="secondary" title="Новая партия с теми же настройками против другого AI-уровня" onClick={()=>{sSetup(true);sOn(false);sOver(null);sPms([])}}>⚙ Настройки</Btn>}
            {/* Premove Undo / Clear — moved to the top strip above the board (premoves row).
                Removed from this bottom controls row to avoid duplication. */}
          </div>
          {on&&!over&&!setup&&<div style={{display:"flex",gap:8,marginTop:SPACE[2],flexWrap:"wrap"}}>
            <Btn size="md" variant="danger" onClick={()=>{if(!confirm("Resign?"))return;if(p2pMode&&p2p.status==="connected"){p2p.send({t:"resign"})}else{const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);}sPms([]);sOn(false);sOver("You resigned");snd("x")}}>🏳 Resign</Btn>
            <Btn size="md" variant="gold" onClick={()=>{if(!confirm("Offer draw?"))return;if(Math.abs(ev(game))<200){const ns={...sts,d:sts.d+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("Draw agreed");snd("x")}else showToast("AI declined","error")}}>½ Draw</Btn>
            <Btn size="md" variant="secondary" icon={<Icon.Undo width={14} height={14}/>} onClick={()=>{
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
          </div>}
        </div>

        {/* Right panel — hidden in Focus workspace (board only). Narrowed (was 440/380/720) so the board
            and media pane get more breathing room. */}
        {wsShowRight&&<div className="cc-right-panel" style={{flex:"1 1 0",minWidth:280,display:"flex",flexDirection:"column",gap:10}}>
          {/* ─── Tools card ─── relocated from under-board strip to declutter the playing area.
              Heatmap + Whisper always available; Share/Reel/SVG appear when game is over;
              History appears when user has saved games. */}
          {/* Tools toolbar — compact icon row, без заголовка */}
          <div style={{
            display:"flex",gap:4,flexWrap:"wrap",
            padding:"6px 8px",borderRadius:RADIUS.md,
            background:CC.surface1,border:`1px solid ${CC.border}`,
          }}>
            <button onClick={()=>sShowThreatMap(v=>!v)} title="Heatmap контроля доски"
              style={{padding:"4px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                background:showThreatMap?CC.brandSoft:CC.surface2,
                color:showThreatMap?CC.brand:CC.textDim}}>
              🌡 Heatmap
            </button>
            <button onClick={async()=>{try{const t=await whisperAndSpeak(game.fen(),evalCp,evalMate);showToast(`🔊 ${t}`,"info")}catch{showToast("Голос недоступен","error")}}}
              title="Голосовой анализ позиции"
              style={{padding:"4px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                background:CC.surface2,color:CC.textDim}}>
              🔊 Whisper
            </button>
            {savedGames.length>0&&<button onClick={()=>sGamesModalOpen(true)}
              style={{padding:"4px 8px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:700,
                background:CC.surface2,color:CC.textDim}}>
              📜 {savedGames.length}
            </button>}
              {over&&fenHist.length>2&&<>
                <Btn size="sm" variant="secondary" icon={<Icon.Share width={12} height={12}/>} onClick={()=>{
                  const white=hotseat?"Player 1":(pCol==="w"?"You":lv.name);
                  const black=hotseat?"Player 2":(pCol==="b"?"You":lv.name);
                  const result=over?.includes("You win")?"1-0":over?.includes("AI wins")?"0-1":over?.includes("win")&&hotseat?"*":"1/2-1/2";
                  const pgn=buildPGN(hist,{white,black,result},moveAnnotations);
                  const url=`${typeof window!=="undefined"?window.location.origin+window.location.pathname:""}?pgn=${encodeURIComponent(pgn)}`;
                  const share=`${pgn}\n\n🔗 Смотреть: ${url}`;
                  try{navigator.clipboard.writeText(share).then(()=>showToast("PGN + ссылка скопированы","success")).catch(()=>showToast("Не получилось — скопируй вручную","error"))}catch{showToast("Clipboard API недоступно","error")}
                }} style={{background:"#eff6ff",color:CC.info,borderColor:"#bfdbfe"}}>Share PGN</Btn>
                <Btn size="sm" variant="secondary" onClick={()=>{
                  const white=hotseat?"Player 1":(pCol==="w"?"You":lv.name);
                  const black=hotseat?"Player 2":(pCol==="b"?"You":lv.name);
                  const result=over?.includes("You win")?"1-0":over?.includes("AI wins")?"0-1":"1/2-1/2";
                  sReelMeta({white,black,result});sShowReel(true);
                }} style={{background:"linear-gradient(135deg,#fdf2f8,#fce7f3)",color:"#9d174d",borderColor:"#f9a8d4"}}>🎬 Auto-Reel</Btn>
                <Btn size="sm" variant="secondary" onClick={()=>{
                  const white=hotseat?"Player 1":(pCol==="w"?"You":lv.name);
                  const black=hotseat?"Player 2":(pCol==="b"?"You":lv.name);
                  const isWin=!!(over?.includes("You win"));const isDraw=!!(over?.includes("Draw")||over?.includes("draw"));
                  const svg=generateShareSVG({fen:game.fen(),result:over||"",isWin,isDraw,white:{name:white,rating:rat},black:{name:black,rating:lv.elo},opening:currentOpening?.name,moves:hist.length,flip,accuracy:undefined,ratingDelta:isWin?Math.max(1,Math.min(50,Math.round((lv.elo-rat)*0.1+10))):undefined});
                  const blob=new Blob([svg],{type:"image/svg+xml"});
                  downloadFile(blob,`aevion-chess-${new Date().toISOString().slice(0,10)}.svg`);
                  showToast("SVG скачан — открой в браузере чтобы поделиться","success");
                }} style={{background:"linear-gradient(135deg,#fef3c7,#fde68a)",color:"#78350f",borderColor:"#fcd34d"}}>📤 Share SVG</Btn>
              </>}
            </div>
          </div>
          {/* Daily Mission widget — hidden during an active vs-computer game and during P2P
              (it reads as "noise" when user is focused on the board). Shown in puzzles tab
              and when no game is in progress (between matches). */}
          {((tab==="puzzles"&&!on)||(tab==="play"&&!on&&!p2pMode))&&<DailyMission onReward={addChessy} onNavigate={sTab}/>}
          {/* Coach Predictions: shows opponent's likely next moves while AI thinks.
              Now also visible in Coach tab so the AI explains predictions during learning sessions.
              Hidden in P2P (no analytics during human-vs-human matches per design). */}
          {(tab==="play"||tab==="coach")&&on&&!over&&!hotseat&&!p2pMode&&sfOk&&<CoachPredictions
            fen={game.fen()}
            opponentColor={pCol==="w"?"b":"w"}
            isOpponentTurn={game.turn()!==pCol}
            lastMoveUci={lm?`${lm.from}${lm.to}`:null}
            enabled={coachAIEnabled}
            onToggle={()=>sCoachAIEnabled(v=>!v)}
            runEngine={runEnginePromise}
          />}
          {/* ─── Coach Quick Actions ─── in-game heuristic-driven coach buttons. Each runs a
              deterministic position evaluation + Stockfish suggestion and shows a coach-style
              explanation card. Available in Coach tab + Play tab when game is on. */}
          {(tab==="play"||tab==="coach")&&on&&!over&&!setup&&sfOk&&<div style={{
            padding:"10px 12px",borderRadius:RADIUS.lg,
            background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)",border:"1px solid #a7f3d0",
            display:"flex",flexDirection:"column",gap:8
          }}>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:900,color:CC.brand,letterSpacing:0.5,textTransform:"uppercase" as const}}>
              <span style={{fontSize:14}}>🎓</span>AI Coach · быстрые подсказки
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Btn size="sm" variant="primary" onClick={()=>{
                // Объясни позицию — оценка + материал + кому лучше + почему
                const fen=game.fen();
                const turn=game.turn();
                const pieces=fen.split(" ")[0];
                const w={p:0,n:0,b:0,r:0,q:0,k:0};const b={...w};
                for(const c of pieces){
                  if(c==="P")w.p++;else if(c==="N")w.n++;else if(c==="B")w.b++;else if(c==="R")w.r++;else if(c==="Q")w.q++;else if(c==="K")w.k++;
                  else if(c==="p")b.p++;else if(c==="n")b.n++;else if(c==="b")b.b++;else if(c==="r")b.r++;else if(c==="q")b.q++;else if(c==="k")b.k++;
                }
                const wMat=w.p+w.n*3+w.b*3+w.r*5+w.q*9;
                const bMat=b.p+b.n*3+b.b*3+b.r*5+b.q*9;
                const matDiff=wMat-bMat;
                const phase=hist.length<14?"дебюте":hist.length<40?"миттельшпиле":"эндшпиле";
                const evalCpAbs=Math.abs(evalCp);
                const evalSide=evalCp>50?"белые":evalCp<-50?"чёрные":"равная";
                const evalStrength=evalCpAbs<50?"равенство":evalCpAbs<150?"небольшой перевес":evalCpAbs<300?"явный перевес":evalCpAbs<700?"решающий перевес":"подавляющий";
                const myEval=pCol==="w"?evalCp:-evalCp;
                const verdict=myEval>=300?"Ты ВЫИГРЫВАЕШЬ — упрощай и реализуй":myEval>=80?"У тебя инициатива — продолжай давить":myEval>=-80?"Позиция РОВНАЯ — ищи план":myEval>=-300?"Соперник давит — ищи контр-игру":"Тяжело — ищи практический шанс";
                const body=`Сейчас ${phase}, ход ${hist.length+1}.\n\n📊 Оценка: ${evalSide==="равная"?"равно":`перевес у ${evalSide}`} (${evalStrength}).\n💎 Материал: ${matDiff===0?"равный":matDiff>0?`+${matDiff} у белых`:`+${-matDiff} у чёрных`}.\n👑 Ход: ${turn==="w"?"белые":"чёрные"}.\n\n🎯 ${verdict}.`;
                sCoachRemark({kind:"position",title:"Объяснение позиции",body});
              }}>🔍 Объясни</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>{
                // Найди план — top-3 моих лучших ходов + комментарий
                if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
                sCoachRemark({kind:"plan",title:"⏳ Coach думает над планом…",body:"Считаю топ-3 хода…"});
                sfR.current.multiPV(game.fen(),12,3,(lines)=>{
                  if(!lines||lines.length===0){sCoachRemark({kind:"plan",title:"Не нашёл плана",body:"Попробуй ещё раз через секунду"});return}
                  const ms=lines.slice(0,3).map((l,i)=>{
                    const uci=l.moves&&l.moves[0]?l.moves[0]:"";
                    try{
                      if(!uci)return `${i+1}. ?`;
                      const test=new Chess(game.fen());
                      const f=uci.slice(0,2),t=uci.slice(2,4),pr=uci.length>4?uci[4]:undefined;
                      const mv=test.move({from:f,to:t,promotion:(pr||"q") as any});
                      const cp=l.cp*(pCol==="w"?1:-1);
                      const evalStr=l.mate!==0?`#${Math.abs(l.mate)}`:`${cp>=0?"+":""}${(cp/100).toFixed(2)}`;
                      return `${i+1}. ${mv?.san||uci}  ${evalStr}`;
                    }catch{return `${i+1}. ${uci}`}
                  }).join("\n");
                  const top=lines[0];
                  const isMine=game.turn()===pCol;
                  sCoachRemark({kind:"plan",title:`📋 Топ-3 ${isMine?"ТВОИХ":"ходов соперника"} (depth ${top.depth})`,body:ms,hint:isMine?"Сделай ход 1 для лучшего результата":"Готовься к этим ответам соперника"});
                });
              }}>📋 Найди план</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>{
                // Подскажи тактику — быстрый поиск тактических мотивов через engine
                if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
                sCoachRemark({kind:"tactic",title:"⏳ Ищу тактику…",body:"Стockfish считает…"});
                sfR.current.go(game.fen(),14,(f,t,p)=>{
                  if(!f||!t){sCoachRemark({kind:"tactic",title:"Тактика не найдена",body:"Позиция тихая — играй стратегически"});return}
                  try{
                    const test=new Chess(game.fen());
                    const mv=test.move({from:f,to:t,promotion:(p||"q") as any});
                    const isCapture=!!mv?.captured;
                    const isCheck=test.isCheck();
                    const isMate=test.isCheckmate();
                    const motif=isMate?"⚔ МАТ!":isCapture&&isCheck?"⚡ Вилка с шахом":isCheck?"♔ Шах":isCapture?"💎 Размен/выигрыш материала":"✨ Тихий улучшающий ход";
                    const body=`Лучший ход: ${mv?.san||`${f}-${t}`}\n\n${motif}\n\nПопробуй найти продолжение.`;
                    sArrows([{from:f as Square,to:t as Square,c:"#10b981"}]);
                    setTimeout(()=>sArrows(a=>a.filter(x=>!(x.from===f&&x.to===t))),5000);
                    sCoachRemark({kind:"tactic",title:"🎯 Тактический совет",body,hint:"Стрелка на доске показывает ход на 5 секунд"});
                  }catch{sCoachRemark({kind:"tactic",title:"Тактика",body:`Ход: ${f}-${t}`})}
                });
              }}>🎯 Тактика</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>{
                // Где слабости — анализ позиции на слабости (короля, пешек, фигур)
                const fen=game.fen();
                const myK=pCol==="w"?"K":"k";
                const oppK=pCol==="w"?"k":"K";
                const findKing=(c:string)=>{
                  const ranks=fen.split(" ")[0].split("/");
                  for(let r=0;r<8;r++){let f=0;for(const ch of ranks[r]){if(/\d/.test(ch))f+=parseInt(ch);else{if(ch===c)return `${"abcdefgh"[f]}${8-r}`;f++}}}
                  return null;
                };
                const myKsq=findKing(myK);
                const oppKsq=findKing(oppK);
                let myAtk=0,oppAtk=0;
                try{
                  const tmp=new Chess(fen);
                  if(myKsq)myAtk=tmp.attackers(myKsq as Square,pCol==="w"?"b":"w").length;
                  if(oppKsq)oppAtk=tmp.attackers(oppKsq as Square,pCol).length;
                }catch{}
                const safety=myAtk===0?"Король в безопасности":myAtk===1?"Король под атакой 1 фигуры":`Король под атакой ${myAtk} фигур!`;
                const attack=oppAtk===0?"Король соперника безопасен":oppAtk>=2?`Король соперника под атакой ${oppAtk} фигур!`:"Король соперника под лёгким давлением";
                const evalAbs=Math.abs(evalCp);
                const positional=evalAbs>200&&hist.length>20?"Позиция требует нового плана — текущая стратегия не работает":evalAbs<50?"Равная позиция — ищи мелкие улучшения фигур":"Позиция в порядке — продолжай план";
                sCoachRemark({kind:"weakness",title:"🛡 Слабости в позиции",body:`Твой король: ${safety} (${myKsq})\nКороль соперника: ${attack} (${oppKsq})\n\n${positional}`,hint:myAtk>=2?"Защити короля немедленно!":oppAtk>=2?"Усиль атаку!":undefined});
              }}>🛡 Слабости</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>{
                // Разбор последнего хода — качество + альтернативы + объяснение
                if(hist.length===0){sCoachRemark({kind:"explain",title:"Нет ходов",body:"Партия ещё не началась"});return}
                const lastSan=hist[hist.length-1];
                const lastIdx=hist.length-1;
                const myAnnot=moveAnnotations[lastIdx];
                const evalBefore=analysis[lastIdx-1]?.cp??0;
                const evalAfter=analysis[lastIdx]?.cp??0;
                const quality=analysis[lastIdx]?.quality;
                const movedBy=lastIdx%2===0?"Белые":"Чёрные";
                const evalDiff=Math.abs(evalAfter-evalBefore);
                const sign=lastIdx%2===0?1:-1;
                const fromPerspective=(evalAfter-evalBefore)*sign;
                const qualityLabel=quality==="great"?"🌟 Отличный":quality==="good"?"✅ Хороший":quality==="inacc"?"⚠ Неточность":quality==="mistake"?"❌ Ошибка":quality==="blunder"?"💀 Блундер":"";
                const evalStr=`${evalAfter>0?"+":""}${(evalAfter/100).toFixed(2)}`;
                const hint=fromPerspective<-100?"Потеря материала или позиции — рассмотри альтернативы":fromPerspective>100?"Этот ход улучшил позицию — хорошее решение!":quality==="blunder"?"Критическая ошибка — противник может использовать":"Нейтральный ход";
                const annot=myAnnot?` (ты отметил: ${myAnnot})`:"";
                sCoachRemark({
                  kind:"explain",
                  title:`📝 Разбор: ${lastSan}${annot}`,
                  body:`${movedBy} сыграли ${lastSan}.\n${qualityLabel?qualityLabel+" ход\n":""}Eval: ${evalStr} (Δ ${evalDiff>0?"+":""}${(evalDiff/100).toFixed(2)} cp)\n${hint}`,
                  hint:quality==="blunder"?"Используй 🔍 Объясни или 📋 Найди план чтобы понять позицию":undefined
                });
              }}>📝 Разбор</Btn>
              {coachRemark&&<Btn size="sm" variant="ghost" onClick={()=>sCoachRemark(null)}>✕ Скрыть</Btn>}
            </div>
            {coachRemark&&<div style={{
              padding:"10px 12px",borderRadius:RADIUS.md,
              background:"#fff",border:"1px solid #a7f3d0",
              fontSize:12,lineHeight:1.55,color:CC.text,whiteSpace:"pre-wrap"
            }}>
              <div style={{fontWeight:900,color:CC.brand,marginBottom:4,fontSize:12}}>{coachRemark.title}</div>
              <div>{coachRemark.body}</div>
              {coachRemark.hint&&<div style={{marginTop:6,padding:"4px 8px",borderRadius:6,background:"#fffbeb",border:"1px solid #fde68a",fontSize:11,color:"#92400e",fontWeight:700}}>💡 {coachRemark.hint}</div>}
            </div>}
          </div>}
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
            <div style={{fontSize:11,color:CC.textDim,display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
              <span>Ход {openingDrill.ply+1} / {openingDrill.moves.length}</span>
              {openingDrill.mistakes>0&&<span style={{color:CC.danger,fontWeight:900,padding:"1px 7px",borderRadius:999,background:"rgba(220,38,38,0.10)"}}>✗ {openingDrill.mistakes} {openingDrill.mistakes===1?"ошибка":"ошибки"}</span>}
              <button onClick={()=>{
                const next=openingDrill.moves[openingDrill.ply];
                if(next)showToast(`Следующий ход: ${next}`,"info");
              }} style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:4,border:`1px solid #c4b5fd`,background:"rgba(124,58,237,0.08)",color:CC.accent,cursor:"pointer"}}>💡 подсказка</button>
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
                {(()=>{
                  // Material balance: capW = white pieces black has taken; show them under AI portrait.
                  // Also compute material advantage for the side that captured more.
                  const VAL:Record<string,number>={p:1,n:3,b:3,r:5,q:9,P:1,N:3,B:3,R:5,Q:9};
                  const wVal=capW.reduce((a,p)=>a+(VAL[p]||0),0);
                  const bVal=capB.reduce((a,p)=>a+(VAL[p]||0),0);
                  const diff=wVal-bVal; // >0 = black (AI) captured more = AI has material advantage
                  return capW.length>0?<div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                    <span style={{fontSize:15,letterSpacing:0.5,lineHeight:1,color:"#94a3b8"}} translate="no">{capW.join("")}</span>
                    {diff>0&&<span style={{fontSize:10,fontWeight:900,color:CC.danger,padding:"1px 5px",borderRadius:999,background:"rgba(220,38,38,0.08)"}}>+{diff}</span>}
                  </div>:null;
                })()}
              </div>
            </div>;
          })()}

          {/* P2P connection HUD during play */}
          {p2pMode&&(tab==="play")&&<div style={{padding:"8px 14px",borderRadius:RADIUS.md,background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",border:`1px solid ${p2p.status==="connected"?"#10b981":"#6ee7b7"}`,display:"flex",alignItems:"center",gap:SPACE[2]}}>
            <span style={{fontSize:16}}>🤝</span>
            <span style={{fontWeight:900,color:"#065f46",fontSize:13}}>{p2pOpponentName}</span>
            <span style={{fontSize:11,padding:"2px 8px",borderRadius:RADIUS.full,background:p2p.status==="connected"?"#059669":"#f59e0b",color:"#fff",fontWeight:800}}>{p2p.status==="connected"?"CONNECTED":p2p.status==="open"?"Waiting for friend…":p2p.status}</span>
            {p2p.latencyMs>0&&<span style={{fontSize:11,color:"#065f46"}}>ping {p2p.latencyMs}ms</span>}
            {p2pRoomId&&<span style={{fontSize:10,color:"#047857",fontFamily:"ui-monospace,monospace",marginLeft:"auto"}}>#{p2pRoomId}</span>}
            <button onClick={()=>{p2p.disconnect();sP2pMode(false);sP2pRoomId("")}} style={{padding:"2px 8px",borderRadius:6,border:"1px solid #6ee7b7",background:"white",color:"#065f46",fontSize:10,fontWeight:800,cursor:"pointer"}}>✕ Disconnect</button>
          </div>}
          {/* Ghost Duel HUD */}
          {ghostDuelMode&&ghostDuelConfig&&on&&!over&&(tab==="play")&&<div style={{padding:"8px 14px",borderRadius:RADIUS.md,background:"linear-gradient(135deg,#f5f3ff,#ede9fe)",border:"1px solid #a78bfa",display:"flex",alignItems:"center",gap:SPACE[2],flexWrap:"wrap"}}>
            <span style={{fontSize:18}}>👻</span>
            <span style={{fontWeight:900,color:"#6d28d9",fontSize:13}}>Дуэль с прошлым</span>
            <span style={{fontSize:11,color:"#5b21b6"}}>{formatPastDate(ghostDuelConfig.pastDate)} · {ghostDuelConfig.pastAiLevel} · ход {hist.length}/{ghostDuelConfig.pastMoves.length}</span>
            {ghostDuelDivergePly!==null&&<span style={{fontSize:11,color:"#dc2626",fontWeight:800}}>⚡ Отклонение на ходу {Math.floor(ghostDuelDivergePly/2)+1}</span>}
            <div style={{flex:1}}/>
            <button onClick={()=>{sGhostDuelMode(false);sGhostDuelConfig(null);showToast("Дуэль завершена","info")}} style={{padding:"3px 10px",borderRadius:6,border:"1px solid #a78bfa",background:"white",color:"#6d28d9",fontSize:11,fontWeight:800,cursor:"pointer"}}>Выйти</button>
          </div>}
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
              {variant==="diceblade"&&(()=>{
                // Detect if player has NO legal moves with the rolled piece type (must pass)
                const myTurnDice=game.turn()===pCol;
                const noDiceOptions=myTurnDice&&dicePieceType!==""&&
                  filterMovesByDice(game.moves({verbose:true}),dicePieceType).filter(m=>m.piece!=="k").length===0;
                return <>
                  <div style={{flex:1}}/>
                  <span style={{
                    fontSize:28,lineHeight:1,display:"inline-block",
                    padding:"2px 8px",borderRadius:6,background:"#fff",
                    boxShadow:"0 2px 6px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(0,0,0,0.08)",
                    animation:"diceRoll 0.4s ease-out"
                  }}>{["⚀","⚁","⚂","⚃","⚄","⚅"][diceFace-1]}</span>
                  <span style={{fontWeight:800,color:noDiceOptions?CC.danger:CC.text}}>
                    Только: <b style={{color:CC.danger,padding:"2px 8px",borderRadius:RADIUS.sm,background:"rgba(220,38,38,0.08)"}}>{diceLabel}</b>
                  </span>
                  {noDiceOptions&&<button title="Нет ходов выбранной фигурой — пропустить ход"
                    onClick={()=>{
                      try{
                        const parts=game.fen().split(" ");parts[1]=parts[1]==="w"?"b":"w";
                        const ng=new Chess(parts.join(" "));setGame(ng);sBk(k=>k+1);
                        showToast(`🎲 Пропускаю ход (нет ${diceLabel})`,"info");
                      }catch{}
                    }}
                    style={{padding:"4px 10px",borderRadius:RADIUS.sm,border:`1px solid ${CC.danger}`,background:"rgba(220,38,38,0.10)",color:CC.danger,fontSize:11,fontWeight:800,cursor:"pointer",animation:"cc-pulse-glow 1.2s infinite"}}>
                    ⏭ Пас
                  </button>}
                </>;
              })()}
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
                <span style={{fontSize:11}}>🐎 кони + пешки · цель — мат</span>
              </>}
              {variant==="pawnapocalypse"&&<>
                <div style={{flex:1}}/>
                <span style={{fontSize:11,color:"#b91c1c",fontWeight:800}}>💀 двойные пешки · продвигай до превращения</span>
              </>}
              {variant==="powerdrop"&&<>
                <div style={{flex:1}}/>
                {(()=>{const rem=hist.length%5;const next=rem===0?0:5-rem;return<span style={{fontSize:11,fontWeight:800,color:next===0?"#c2410c":undefined}}>{next===0?"🔥 DROP ДОСТУПЕН!":`след. дроп через ${next} ход${next===1?"":"ов"}`}</span>;})()}
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
                        if(game.turn()!==pCol)showToast("Дождись своего хода","info");
                        else if(variant==="crazyhouse")showToast("Нужно сначала захватить фигуру соперника","info");
                        else{const rem=hist.length%dropEvery;const next=rem===0?0:dropEvery-rem;showToast(next===0?"Drop доступен — но пул пуст. Захвати фигуру!":`Drop доступен через ${next} ход${next===1?"":"ов"}`,"info");}
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

          {/* ── Game Insights — auto summary after analysis completes ── */}
          {over&&(tab==="play"||tab==="coach")&&analysis.length>=Math.max(1,hist.length-1)&&analysis.length>3&&(()=>{
            const isWin=over.includes("win")||over.includes("win!");
            const isDraw=over.includes("draw")||over.includes("Draw")||over.includes("Stalemate");
            const isLoss=!isWin&&!isDraw;
            // User's move quality summary
            const myPlies=analysis.filter((_,i)=>(pCol==="w")===(i%2===0));
            const blunders=myPlies.filter(a=>a.quality==="blunder").length;
            const mistakes=myPlies.filter(a=>a.quality==="mistake").length;
            const great=myPlies.filter(a=>a.quality==="great").length;
            const opening=currentOpening?.name;
            const moveCount=hist.length;
            // Generate a short coach-style insight
            const insights:string[]=[];
            if(isWin&&blunders===0)insights.push("Чистая победа без блундеров — отличное исполнение!");
            else if(isWin&&blunders>0)insights.push(`Победа, но ${blunders} блундер${blunders>1?"а":""} — стоит разобрать.`);
            else if(isLoss&&blunders>=2)insights.push(`${blunders} блундера привели к поражению — разбери в Analysis.`);
            else if(isLoss&&mistakes>=3)insights.push(`${mistakes} ошибки сыграли роль — работай над точностью расчёта.`);
            else if(isDraw)insights.push("Ничья — хорошая борьба. Попробуй найти упущенный шанс в Analysis.");
            else insights.push("Неплохая партия — проверь ключевые моменты в Analysis.");
            if(great>=2)insights.push(`${great} отличных хода 🌟 — ты видел хорошие возможности!`);
            if(opening)insights.push(`Дебют: ${opening}.`);
            if(moveCount<20)insights.push("Короткая партия — анализ поможет понять где пошло не так.");
            else if(moveCount>50)insights.push("Долгая партия — значит хорошая борьба в эндшпиле.");
            return <div style={{
              marginTop:8,padding:"10px 14px",borderRadius:10,
              background:isWin?"linear-gradient(135deg,#f0fdf4,#dcfce7)":isLoss?"linear-gradient(135deg,#fef2f2,#fee2e2)":"linear-gradient(135deg,#f0f9ff,#dbeafe)",
              border:`1px solid ${isWin?"#86efac":isLoss?"#fca5a5":"#93c5fd"}`
            }}>
              <div style={{fontSize:11,fontWeight:900,color:isWin?"#15803d":isLoss?"#b91c1c":"#1e40af",letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:6}}>
                💬 Coach · итог партии
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {insights.slice(0,3).map((ins,i)=><div key={i} style={{fontSize:12,color:isWin?"#166534":isLoss?"#991b1b":"#1e3a8a",lineHeight:1.5}}>{ins}</div>)}
              </div>
              <button onClick={()=>{
                const q=`Партия завершена: ${over}. Было ${blunders} блундеров и ${mistakes} ошибок. Дебют: ${opening||"нет данных"}. Дай мне 3 конкретных совета что улучшить.`;
                sCoachPrefillQ(q);sTab("coach");
              }} style={{marginTop:8,padding:"5px 10px",borderRadius:6,border:"none",background:"rgba(0,0,0,0.08)",color:"inherit",fontSize:11,fontWeight:800,cursor:"pointer"}}>
                🎓 Подробный разбор с Coach →
              </button>
            </div>;
          })()}

          {/* ── Time-per-move analytics ── per-ply time chart with red flags for time-management coach.
              Visible after game ends with ≥4 moves recorded. Coach-style insights below the chart. */}
          {over&&(tab==="play"||tab==="coach")&&moveTimes.length>=4&&(()=>{
            // Filter to user's plies only (every other ply starting from pCol==="w" ? 0 : 1).
            const userIsWhite=pCol==="w";
            const myPlyTimes=moveTimes.map((t,i)=>({t,i,isUser:userIsWhite?i%2===0:i%2===1})).filter(x=>x.isUser).map(x=>({t:x.t,ply:x.i}));
            if(myPlyTimes.length===0)return null;
            const avgMs=myPlyTimes.reduce((a,p)=>a+p.t,0)/myPlyTimes.length;
            const maxMs=Math.max(...myPlyTimes.map(p=>p.t));
            const W=560,H=64;
            const xs=(i:number)=>myPlyTimes.length<=1?W/2:(i/(myPlyTimes.length-1))*W;
            const ys=(t:number)=>H-(t/Math.max(maxMs,1))*(H-4)-2;
            // Red flags: rushed (<2s on user move in middlegame ply 10-30) AND blunder/mistake at same ply.
            const flags:string[]=[];
            if(analysis.length>0){
              for(let k=0;k<myPlyTimes.length;k++){
                const{t,ply}=myPlyTimes[k];
                const a=analysis[ply];
                if(!a)continue;
                if(t<2000&&(a.quality==="blunder"||a.quality==="mistake")){
                  flags.push(`Ход ${Math.floor(ply/2)+1}: ${(t/1000).toFixed(1)}с — спешка → ${a.quality==="blunder"?"блундер":"ошибка"}`);
                }
                if(t>30000&&Math.abs(a.cp)>500){
                  flags.push(`Ход ${Math.floor(ply/2)+1}: ${(t/1000).toFixed(0)}с в ${a.cp>0?"выигранной":"проигранной"} → потеря времени`);
                }
              }
            }
            const fmt=(ms:number)=>ms<1000?`${ms}мс`:ms<10000?`${(ms/1000).toFixed(1)}с`:`${Math.round(ms/1000)}с`;
            return <div style={{marginTop:8,padding:"10px 14px",borderRadius:RADIUS.lg,background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:"1px solid #facc15"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:900,color:"#854d0e",letterSpacing:0.5,textTransform:"uppercase" as const}}>⏱ Управление временем · {myPlyTimes.length} твоих ходов</div>
                <div style={{fontSize:10,color:"#a16207",fontWeight:700}}>средний {fmt(avgMs)} · максимум {fmt(maxMs)}</div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{width:"100%",height:60,background:"linear-gradient(180deg,#fff 0%,#fef9c3 100%)",borderRadius:6}}>
                <line x1="0" y1={ys(avgMs)} x2={W} y2={ys(avgMs)} stroke="#a16207" strokeWidth="0.4" strokeDasharray="3,2"/>
                {myPlyTimes.map((p,i)=>{
                  const flagged=analysis[p.ply]&&(p.t<2000&&(analysis[p.ply].quality==="blunder"||analysis[p.ply].quality==="mistake"))||p.t>30000;
                  return <rect key={i} x={xs(i)-2} y={ys(p.t)} width={4} height={H-ys(p.t)-2}
                    fill={flagged?"#dc2626":p.t<3000?"#f59e0b":p.t<10000?"#84cc16":"#0891b2"}
                    rx={1}>
                    <title>Ход {Math.floor(p.ply/2)+1}: {fmt(p.t)}{analysis[p.ply]?` · ${analysis[p.ply].quality}`:""}</title>
                  </rect>;
                })}
              </svg>
              {flags.length>0?<div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:"rgba(220,38,38,0.08)",border:"1px solid rgba(220,38,38,0.25)",fontSize:11,color:"#991b1b",lineHeight:1.6}}>
                <div style={{fontWeight:900,marginBottom:2}}>🚩 Замечания тренера ({flags.length}):</div>
                {flags.slice(0,3).map((f,i)=><div key={i}>· {f}</div>)}
                {flags.length>3&&<div style={{fontStyle:"italic",marginTop:2}}>+ ещё {flags.length-3}</div>}
              </div>:<div style={{marginTop:8,padding:"6px 10px",borderRadius:6,background:"rgba(132,204,22,0.10)",border:"1px solid rgba(132,204,22,0.3)",fontSize:11,color:"#3f6212",fontWeight:700}}>
                ✓ Время распределено хорошо — никаких спешащих блундеров или потерь времени в выигранных позициях
              </div>}
              <div style={{marginTop:6,fontSize:10,color:"#854d0e",lineHeight:1.5}}>
                Зелёный — нормально (10-30с) · Жёлтый — быстро (3-10с) · Оранжевый — спешка (&lt;3с) · Красный — флаг тренера
              </div>
            </div>;
          })()}

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
              {(()=>{
                const VAL:Record<string,number>={p:1,n:3,b:3,r:5,q:9,P:1,N:3,B:3,R:5,Q:9};
                const wVal=capW.reduce((a,p)=>a+(VAL[p]||0),0);
                const bVal=capB.reduce((a,p)=>a+(VAL[p]||0),0);
                const diff=bVal-wVal; // >0 = player captured more = player has material advantage
                return capB.length>0?<div style={{display:"flex",alignItems:"center",gap:4,marginTop:3}}>
                  <span style={{fontSize:15,letterSpacing:0.5,lineHeight:1,color:"#94a3b8"}} translate="no">{capB.join("")}</span>
                  {diff>0&&<span style={{fontSize:10,fontWeight:900,color:CC.brand,padding:"1px 5px",borderRadius:999,background:"rgba(5,150,105,0.10)"}}>+{diff}</span>}
                </div>:null;
              })()}
            </div>
          </div>}

          {/* Single eval / opening strip — replaces the old duplicate "● Клубный (1200)" line
              for play/coach AND the separate big opening card. Compact one-liner: ECO chip +
              opening name + eval (Analysis only). The opponent name+elo is already shown in
              the avatar block above, so no need to repeat it here. */}
          {on&&!setup&&(tab==="play"||tab==="coach"||tab==="analysis")&&(currentOpening||tab==="analysis")&&<div style={{
            padding:"6px 10px",borderRadius:7,
            background:currentOpening?"linear-gradient(90deg,#ecfdf5,#f0fdf4)":T.surface,
            border:`1px solid ${currentOpening?"#a7f3d0":T.border}`,
            display:"flex",alignItems:"center",gap:SPACE[2],fontSize:12,flexWrap:"wrap",
          }}>
            {currentOpening&&hist.length>0&&<>
              <span style={{
                fontSize:10,fontWeight:900,padding:"2px 6px",borderRadius:4,
                background:CC.brand,color:"#fff",
                fontFamily:"ui-monospace, SFMono-Regular, monospace",letterSpacing:0.8,
              }}>{currentOpening.eco}</span>
              <span style={{fontSize:12,fontWeight:800,color:"#065f46"}} title={currentOpening.desc}>{currentOpening.name}</span>
            </>}
            {tab==="analysis"&&<>
              <span style={{flex:1}}/>
              <span style={{fontSize:11,color:T.dim}}>
                <span style={{color:useSF?T.purple:T.blue}}>●</span> {useSF?`SF d${SFD[aiI]||10}`:`d${lv.depth}`}
              </span>
              {sfOk&&!over&&<span style={{fontSize:11,fontWeight:800,fontFamily:"ui-monospace,monospace",color:evalMate!==0?(evalMate>0?T.accent:T.danger):Math.abs(evalCp)<30?T.dim:evalCp>0?T.accent:T.danger}}>
                {evalMate!==0?`M${Math.abs(evalMate)}`:(evalCp>0?"+":"")+(evalCp/100).toFixed(2)}
              </span>}
              {/* F2-phase-2: progressive-deepening indicator. The SF info-parser pushes
                  depth through ecb on every "info" line, so this badge fades & pulses
                  as the engine deepens its search (typical range 1→25+ in fast eval). */}
              {sfOk&&!over&&evalDepth>0&&<span
                key={evalDepth}
                title={`Stockfish search depth: ${evalDepth} ply`}
                style={{
                  fontSize:9,fontWeight:800,fontFamily:"ui-monospace,monospace",
                  color:T.dim,opacity:0.85,letterSpacing:0.3,
                  padding:"1px 4px",borderRadius:3,border:`1px solid ${CC.border}`,
                  background:"rgba(255,255,255,0.5)",
                  animation:"sf-depth-pulse 0.4s ease-out",
                }}
              >d{evalDepth}/35</span>}
            </>}
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

          {/* "Анализ варианта" — moved DOWN below the move list per UX feedback. */}

          {/* Дубль премув-панели удалён — есть единая строка выше move list (line ~4900). */}

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
                const bestSan=sanMoves[0]||uciMoves[0]||"";
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
                  {bestSan&&<WhatIfButton fen={baseFen} san={bestSan} evalStr={evalStr} rank={i+1} isBest={i===0}/>}
                </div>);
              })}
            </div>
          </div>}

          {/* ── Opening Explorer (Lichess masters) — Analysis tab ── */}
          {tab==="analysis"&&showOpeningExp&&<div style={{borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,background:"linear-gradient(135deg,#fef9c3,#fde68a)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase" as const,color:"#854d0e"}}>📚 Opening Explorer · Masters</span>
              <button onClick={()=>sShowOpeningExp(false)} style={{padding:"2px 6px",borderRadius:4,border:"none",background:"transparent",color:"#854d0e",fontSize:11,fontWeight:800,cursor:"pointer"}}>скрыть</button>
            </div>
            {openingLoading?<div style={{padding:"10px 12px",fontSize:12,color:T.dim,textAlign:"center"}}>Загрузка из Lichess masters…</div>:!openingData?<div style={{padding:"10px 12px",fontSize:12,color:T.dim,textAlign:"center"}}>Сервис недоступен (Lichess masters API). Попробуй позже.</div>:openingData.total===0?<div style={{padding:"10px 12px",fontSize:12,color:T.dim,textAlign:"center"}}>Позиция оригинальная — в мастерской базе нет партий.</div>:<>
              {openingData.opening?.name&&<div style={{padding:"6px 12px",fontSize:11,color:"#854d0e",fontWeight:700,background:"#fffbeb",borderBottom:`1px solid ${T.border}`}}>
                {openingData.opening.eco?<span style={{fontFamily:"monospace",marginRight:6}}>{openingData.opening.eco}</span>:null}{openingData.opening.name}
              </div>}
              <div style={{padding:"4px 12px",fontSize:10,color:T.dim,fontFamily:"monospace",borderBottom:`1px solid ${T.border}`,background:"#fffbeb",display:"flex",justifyContent:"space-between"}}>
                <span>{oeShortNum(openingData.total)} партий мастеров</span>
                <span>{oeWhitePct(openingData)}% W · {oeDrawPct(openingData)}% D · {oeBlackPct(openingData)}% B</span>
              </div>
              <div style={{maxHeight:180,overflowY:"auto"}}>
                {openingData.moves.slice(0,8).map((m,i)=>{
                  const total=m.white+m.draws+m.black;
                  const wp=oeWhitePct(m),dp=oeDrawPct(m),bp=oeBlackPct(m);
                  return <div key={i} onClick={()=>{
                    try{
                      const ch=new Chess(game.fen());
                      const mv=ch.move({from:m.uci.slice(0,2) as Square,to:m.uci.slice(2,4) as Square,promotion:(m.uci[4]||"q") as any});
                      if(!mv)return;
                      setGame(ch);sBk(k=>k+1);
                      sHist(h=>[...h,mv.san]);
                      sFenHist(fh=>[...fh,ch.fen()]);
                      sLm({from:mv.from as Square,to:mv.to as Square});
                      sSel(null);sVm(new Set());
                    }catch{}
                  }} style={{padding:"5px 12px",borderBottom:i<openingData.moves.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"background 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#fef9c3"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                    <span style={{minWidth:50,fontSize:13,fontWeight:800,fontFamily:"monospace",color:T.text}}>{m.san}</span>
                    <span style={{minWidth:60,fontSize:10,color:T.dim,fontFamily:"monospace"}}>{oeShortNum(total)}</span>
                    <div style={{flex:1,display:"flex",height:6,borderRadius:3,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <div style={{width:`${wp}%`,background:"#f8fafc"}}/>
                      <div style={{width:`${dp}%`,background:"#94a3b8"}}/>
                      <div style={{width:`${bp}%`,background:"#1e293b"}}/>
                    </div>
                    {m.averageRating&&<span style={{minWidth:40,fontSize:10,color:T.dim,fontFamily:"monospace",textAlign:"right"}}>{m.averageRating}</span>}
                  </div>;
                })}
              </div>
            </>}
          </div>}
          {tab==="analysis"&&!showOpeningExp&&<button onClick={()=>sShowOpeningExp(true)} style={{padding:"6px 10px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fffbeb",color:"#854d0e",fontSize:11,fontWeight:800,cursor:"pointer"}}>📚 Показать Opening Explorer</button>}

          {/* ── Endgame Tablebase — Analysis tab, ≤7 фигур ── */}
          {tab==="analysis"&&isTablebaseEligible(game.fen())&&<div style={{borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,background:"linear-gradient(135deg,#dbeafe,#bfdbfe)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:800,letterSpacing:"0.06em",textTransform:"uppercase" as const,color:"#1e40af"}}>♔ Tablebase · 7-piece Syzygy</span>
              <span style={{fontSize:10,color:"#1e40af",fontWeight:700}}>perfect play</span>
            </div>
            {tbLoading?<div style={{padding:"10px 12px",fontSize:12,color:T.dim,textAlign:"center"}}>Загрузка…</div>:!tbData?<div style={{padding:"10px 12px",fontSize:12,color:T.dim,textAlign:"center"}}>Tablebase недоступен (вероятно, оффлайн).</div>:<>
              <div style={{padding:"6px 12px",borderBottom:`1px solid ${T.border}`,background:"#f0f9ff",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:900,color:tbColor(tbData.category)}}>{tbLabel(tbData.category,game.turn())}</span>
                {tbData.dtm!==null&&!tbData.checkmate&&<span style={{fontSize:11,fontFamily:"monospace",fontWeight:800,color:T.text}}>DTM: {Math.abs(tbData.dtm)}</span>}
                {tbData.checkmate&&<span style={{fontSize:11,fontWeight:800,color:tbColor(tbData.category)}}>Мат на доске</span>}
                {tbData.stalemate&&<span style={{fontSize:11,fontWeight:800,color:T.dim}}>Пат</span>}
              </div>
              {tbData.moves.length>0&&<div style={{maxHeight:160,overflowY:"auto"}}>
                {tbData.moves.slice(0,6).map((m,i)=>{
                  return <div key={i} onClick={()=>{
                    try{
                      const ch=new Chess(game.fen());
                      const mv=ch.move({from:m.uci.slice(0,2) as Square,to:m.uci.slice(2,4) as Square,promotion:(m.uci[4]||"q") as any});
                      if(!mv)return;
                      setGame(ch);sBk(k=>k+1);
                      sHist(h=>[...h,mv.san]);
                      sFenHist(fh=>[...fh,ch.fen()]);
                      sLm({from:mv.from as Square,to:mv.to as Square});
                      sSel(null);sVm(new Set());
                    }catch{}
                  }} style={{padding:"5px 12px",borderBottom:i<5&&i<tbData.moves.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"background 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="#dbeafe"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                    <span style={{minWidth:54,fontSize:13,fontWeight:i===0?900:700,fontFamily:"monospace",color:T.text}}>{m.san}</span>
                    <span style={{padding:"1px 6px",borderRadius:3,fontSize:10,fontWeight:800,color:"#fff",background:tbColor(m.category),fontFamily:"monospace"}}>{m.category}</span>
                    {m.dtm!==null&&!m.checkmate&&<span style={{fontSize:10,color:T.dim,fontFamily:"monospace"}}>DTM {Math.abs(m.dtm)}</span>}
                    {m.checkmate&&<span style={{fontSize:10,fontWeight:800,color:tbColor(m.category)}}>#</span>}
                    {m.stalemate&&<span style={{fontSize:10,color:T.dim}}>пат</span>}
                  </div>;
                })}
              </div>}
            </>}
          </div>}

          {/* Analyze Game button - when game has history */}
          {tab==="analysis"&&hist.length>0&&!showAnal&&!analyzing&&<button onClick={runAnalysis} style={{padding:"10px 14px",borderRadius:10,border:"none",background:T.purple,color:"#fff",fontSize:13,fontWeight:800,cursor:"pointer",boxShadow:"0 2px 6px rgba(124,58,237,0.2)"}}>
            🔍 Проанализировать всю партию ({hist.length} ходов)
          </button>}
          {tab==="analysis"&&analyzing&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(124,58,237,0.08)",border:`1px solid ${T.purple}`,color:T.purple,fontSize:13,fontWeight:700,textAlign:"center"}}>⚡ Analyzing…</div>}

          <div ref={hR} style={{borderRadius:12,background:T.surface,border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}>
            {/* Premove queue — sits ABOVE the move list so the user can see what's queued.
                Each chip has a per-premove ✕ for surgical removal; the toolbar at the right
                has ↶ (undo last) and ✕ (clear all). User feedback: clicking the chip's ✕
                must remove that specific premove. */}
            {pms.length>0&&(tab==="play"||tab==="coach")&&<div style={{padding:"7px 10px",borderBottom:`1px solid #bfdbfe`,background:"linear-gradient(90deg,#eff6ff,#dbeafe)",display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <span style={{fontSize:10,fontWeight:900,letterSpacing:1.1,textTransform:"uppercase" as const,color:"#1d4ed8"}}>Премувы · {pms.length}</span>
              {pms.map((pm,i)=>(<span key={`pm-rp-${i}`} style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 3px 2px 8px",borderRadius:999,background:"#fff",border:"1px solid #93c5fd",fontSize:11,fontFamily:"ui-monospace, SFMono-Regular, monospace",color:"#1e40af",fontWeight:800}}>
                <span style={{minWidth:14,height:14,borderRadius:7,background:"#2563eb",color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900}}>{i+1}</span>
                <span>{pm.from}→{pm.to}</span>
                <button onClick={()=>{sPms(v=>v.filter((_,j)=>j!==i));snd("premove")}}
                  title={`Удалить премув ${pm.from}→${pm.to}`}
                  style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:18,height:18,borderRadius:9,border:"none",background:"transparent",color:"#94a3b8",fontSize:11,fontWeight:900,cursor:"pointer",lineHeight:1,padding:0,marginLeft:1}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#fee2e2";(e.currentTarget as HTMLElement).style.color="#dc2626"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent";(e.currentTarget as HTMLElement).style.color="#94a3b8"}}>✕</button>
              </span>))}
              <span style={{flex:1}}/>
              <button onClick={()=>{sPms(p=>p.slice(0,-1));snd("premove")}} title="Отменить последний премув"
                style={{padding:"3px 8px",borderRadius:6,border:"1px solid #93c5fd",background:"#eff6ff",color:"#1d4ed8",fontSize:11,fontWeight:800,cursor:"pointer"}}>↶</button>
              <button onClick={()=>{sPms([]);sPmSel(null);snd("cancel")}} title="Отменить все премувы"
                style={{padding:"3px 8px",borderRadius:6,border:"1px solid #fca5a5",background:"#fef2f2",color:"#b91c1c",fontSize:11,fontWeight:800,cursor:"pointer"}}>✕ всё</button>
            </div>}
            <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,background:"linear-gradient(180deg, #fafbfd, #f9fafb)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:11,fontWeight:900,letterSpacing:"0.1em",textTransform:"uppercase" as const,color:T.dim,display:"inline-flex",alignItems:"center",gap:6,flex:1,minWidth:0}}>
                <span style={{display:"inline-block",width:3,height:14,background:`linear-gradient(180deg, ${T.accent}, ${T.purple})`,borderRadius:2,flexShrink:0}}/>
                Ходы {hist.length>0&&<span style={{color:T.accent,fontWeight:900}}>{Math.ceil(hist.length/2)}</span>}
                {currentOpening&&hist.length>0&&hist.length<=30&&<span style={{
                  marginLeft:4,fontSize:10,fontWeight:700,color:"#059669",
                  letterSpacing:0.3,textTransform:"none" as const,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" as const,maxWidth:130,
                  padding:"1px 6px",borderRadius:RADIUS.full,background:"rgba(5,150,105,0.10)",
                }} title={currentOpening.name}>{currentOpening.eco} · {currentOpening.name}</span>}
                {refiningAnalysis&&<span style={{marginLeft:8,fontSize:10,color:T.purple,fontWeight:700,letterSpacing:"normal",textTransform:"none" as const,animation:"pulse 1.4s ease-in-out infinite"}}>⚡ уточняю d18...</span>}
              </span>
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
            <div ref={moveListScrollRef}
              onMouseLeave={()=>{
                // Container leave: restore snapshot (real position) — debounce to avoid flicker.
                if(previewLeaveTimer.current)window.clearTimeout(previewLeaveTimer.current);
                previewLeaveTimer.current=window.setTimeout(()=>{
                  if(!hoverSnapRef.current)return;
                  const snap=hoverSnapRef.current;hoverSnapRef.current=null;
                  try{const g=new Chess(snap.fen);setGame(g);sBk(k=>k+1);sLm(null);sSel(null);sVm(new Set());}catch{}
                  sPreviewIdx(null);
                  previewLeaveTimer.current=null;
                },80);
              }}
              style={{maxHeight:tab==="analysis"?520:320,overflowY:"auto",padding:"4px 0",scrollBehavior:"smooth"}}>
              {hist.length?<div style={{display:"grid",gridTemplateColumns:"36px 1fr 1fr",fontSize:13,fontFamily:"monospace"}}>
                {Array.from({length:Math.ceil(hist.length/2)}).map((_,i)=>{
                  const white=hist[i*2],black=hist[i*2+1];
                  const wIdx=i*2,bIdx=i*2+1;
                  const wIsBrowsed=browseIdx===wIdx||(browseIdx<0&&wIdx===hist.length-1);
                  const bIsBrowsed=browseIdx===bIdx||(browseIdx<0&&bIdx===hist.length-1);
                  const wIsPreview=previewIdx===wIdx;
                  const bIsPreview=previewIdx===bIdx;
                  const isActivePair=wIsBrowsed||bIsBrowsed||wIsPreview||bIsPreview;
                  const wEval=analysis[wIdx];const bEval=analysis[bIdx];
                  const wQ=wEval?.quality;const bQ=bEval?.quality;
                  const qIcon=(q?:string)=>q==="blunder"?"??":q==="mistake"?"?":q==="inacc"?"?!":q==="great"?"!":"";
                  const qColor=(q?:string)=>q==="blunder"?T.danger:q==="mistake"?"#ea580c":q==="inacc"?"#ca8a04":q==="great"?T.accent:"";
                  // Hover-scrub: snapshot canonical state on first enter, then preview.
                  // Click promotes preview to canonical (browseIdx) and clears the snapshot.
                  // GATED: disabled during an active live game (when `on && !over` — i.e. clock is
                  // running and you're playing). Reason: hover would call setGame() mid-drag and
                  // wipe the drag snapshot, breaking premoves and piece movement. Hover-scrub is
                  // useful in Analysis / Coach / post-game review — that's when it stays on.
                  const hoverScrubAllowed=tab==="analysis"||(!on||!!over);
                  const previewMove=(idx:number)=>{
                    if(!hoverScrubAllowed)return;
                    if(previewLeaveTimer.current){window.clearTimeout(previewLeaveTimer.current);previewLeaveTimer.current=null;}
                    if(!hoverSnapRef.current){hoverSnapRef.current={fen:game.fen(),idx:browseIdx};}
                    try{const g=new Chess(fenHist[idx+1]);setGame(g);sBk(k=>k+1);sLm(null);sSel(null);sVm(new Set());sPreviewIdx(idx);}catch{}
                  };
                  const commitMove=(idx:number)=>{
                    hoverSnapRef.current=null;sPreviewIdx(null);
                    if(previewLeaveTimer.current){window.clearTimeout(previewLeaveTimer.current);previewLeaveTimer.current=null;}
                    try{const g=new Chess(fenHist[idx+1]);setGame(g);sBk(k=>k+1);sBrowseIdx(idx);sLm(null);sSel(null);sVm(new Set());}catch{}
                  };
                  const wAnnot=moveAnnotations[wIdx];const bAnnot=moveAnnotations[bIdx];
                  const annotColor=(s?:string)=>ANNOT_SYMS.find(a=>a.s===s)?.c||T.text;
                  const openAnnot=(ply:number,e:React.MouseEvent)=>{if(tab!=="analysis")return;e.preventDefault();e.stopPropagation();sAnnotPicker({ply,x:Math.min(e.clientX,window.innerWidth-140),y:Math.min(e.clientY,window.innerHeight-120)});};
                  return <React.Fragment key={i}>
                    <span data-pair-idx={i} data-active={isActivePair?"1":undefined} style={{color:T.dim,fontWeight:700,textAlign:"center",padding:"5px 0",background:isActivePair?"rgba(5,150,105,0.10)":"#fafafa",borderRight:`1px solid ${T.border}`,fontSize:12}}>{i+1}</span>
                    <span onMouseEnter={()=>{if(white)previewMove(wIdx)}} onClick={()=>{if(white)commitMove(wIdx)}} onContextMenu={e=>openAnnot(wIdx,e)}
                      title={tab==="analysis"?"Правый клик — добавить аннотацию":undefined}
                      style={{color:T.text,fontWeight:600,padding:"5px 10px",background:wIsPreview?"rgba(245,158,11,0.20)":wIsBrowsed?"rgba(5,150,105,0.15)":"transparent",borderLeft:wIsPreview?`3px solid #f59e0b`:wIsBrowsed?`3px solid ${T.accent}`:"3px solid transparent",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{white||""}{wAnnot&&<span style={{color:annotColor(wAnnot),fontWeight:900,marginLeft:2,fontSize:12}}>{wAnnot}</span>}{!wAnnot&&wQ&&<span style={{color:qColor(wQ),fontWeight:900,marginLeft:3}}>{qIcon(wQ)}</span>}</span>
                      {wEval&&<span style={{fontSize:10,color:wEval.cp>0?T.accent:wEval.cp<0?T.danger:T.dim,fontWeight:700}}>{wEval.mate!==0?`M${Math.abs(wEval.mate)}`:(wEval.cp/100).toFixed(1)}</span>}
                    </span>
                    <span onMouseEnter={()=>{if(black)previewMove(bIdx)}} onClick={()=>{if(black)commitMove(bIdx)}} onContextMenu={e=>openAnnot(bIdx,e)}
                      title={tab==="analysis"&&black?"Правый клик — добавить аннотацию":undefined}
                      style={{color:T.text,fontWeight:600,padding:"5px 10px",background:bIsPreview?"rgba(245,158,11,0.20)":bIsBrowsed?"rgba(5,150,105,0.15)":"transparent",borderLeft:bIsPreview?`3px solid #f59e0b`:bIsBrowsed?`3px solid ${T.accent}`:"3px solid transparent",cursor:black?"pointer":"default",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>{black||""}{bAnnot&&<span style={{color:annotColor(bAnnot),fontWeight:900,marginLeft:2,fontSize:12}}>{bAnnot}</span>}{!bAnnot&&bQ&&<span style={{color:qColor(bQ),fontWeight:900,marginLeft:3}}>{qIcon(bQ)}</span>}</span>
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

          {/* Scratch / Analysis-during-play — relocated here per UX feedback (was above
              the move list, now below it so the move list sits closer to the top of the
              right panel). Same behaviour: enter scratch to play out variations without
              committing to the live game; clock keeps ticking. */}
          {tab==="play"&&on&&!over&&!setup&&<div style={{padding:"8px 12px",borderRadius:8,background:scratchOn?"linear-gradient(135deg,#fef3c7,#fde68a)":"linear-gradient(135deg,#f5f3ff,#ede9fe)",border:`1px solid ${scratchOn?"#fbbf24":"#c4b5fd"}`}}>
            {!scratchOn?<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                <span style={{fontSize:13,fontWeight:800,letterSpacing:"0.05em",color:T.purple}}>🔍 Анализ варианта</span>
                <span style={{fontSize:10,color:T.dim,fontStyle:"italic"}}>Двигай за обе стороны не ломая партию</span>
              </div>
              <button onClick={enterScratch} style={{padding:"6px 12px",borderRadius:7,border:"none",background:T.purple,color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer",letterSpacing:0.3,boxShadow:"0 2px 6px rgba(124,58,237,0.3)"}}>Войти →</button>
            </div>:<div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span style={{fontSize:13,fontWeight:900,letterSpacing:"0.08em",color:"#92400e"}}>🔍 РЕЖИМ АНАЛИЗА</span>
                <div style={{display:"flex",gap:5}}>
                  <button onClick={resetScratch} title="Сбросить к актуальной позиции" style={{padding:"4px 10px",borderRadius:6,border:"1px solid #fbbf24",background:"#fffbeb",color:"#92400e",fontSize:11,fontWeight:800,cursor:"pointer"}}>↺ Сброс</button>
                  <button onClick={exitScratch} title="Вернуться к партии" style={{padding:"4px 10px",borderRadius:6,border:"none",background:T.danger,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"}}>✕ Выйти</button>
                </div>
              </div>
              {scratchHist.length>0&&<div style={{display:"flex",flexWrap:"wrap",gap:4,padding:"4px 0"}}>{scratchHist.map((s,i)=><span key={i} style={{padding:"1px 5px",borderRadius:3,background:"rgba(255,255,255,0.6)",color:"#92400e",fontSize:11,fontWeight:700,fontFamily:"monospace"}}>{i%2===0?`${Math.floor(i/2)+1}.`:""}{s}</span>)}</div>}
              <span style={{fontSize:10,color:"#78350f",fontStyle:"italic"}}>Партия идёт параллельно · таймеры тикают · соперник может сходить</span>
            </div>}
          </div>}

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
                {pzMode==="rush"&&rushActive&&<div style={{
                  marginBottom:SPACE[2],borderRadius:RADIUS.md,overflow:"hidden",
                  border:"1px solid #fcd34d",
                  background:"linear-gradient(135deg,#0f172a,#1c1400)",
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:SPACE[2],padding:`${SPACE[2]}px ${SPACE[3]}px`}}>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"center",minWidth:52}}>
                      <div style={{fontSize:28,fontWeight:900,color:"#fcd34d",lineHeight:1,fontFamily:"ui-monospace,monospace"}}>{rushScore}</div>
                      <div style={{fontSize:9,fontWeight:800,color:"#92400e",letterSpacing:1,textTransform:"uppercase" as const}}>решено</div>
                    </div>
                    <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center"}}>
                      {rushStreak>=3?<div style={{fontSize:22,fontWeight:900,color:rushStreak>=5?"#ef4444":"#f97316",display:"flex",alignItems:"center",gap:2}}>
                        {Array.from({length:Math.min(rushStreak,5)}).map((_,i)=><span key={i} style={{filter:`hue-rotate(${i*10}deg)`,animation:`cc-pulse-glow ${0.8+i*0.1}s ease-in-out infinite`,fontSize:16+i*2}}>🔥</span>)}
                        <span style={{fontSize:18,fontWeight:900,marginLeft:2}}>{rushStreak}</span>
                      </div>:rushStreak>0?<div style={{fontSize:16,fontWeight:900,color:"#fb923c"}}>🔥 {rushStreak}</div>:<div style={{fontSize:12,color:"#475569",fontWeight:700}}>Без стрика</div>}
                      <div style={{fontSize:9,color:"#78716c",fontWeight:700}}>COMBO</div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
                      {rushBest>0&&<div style={{fontSize:10,color:"#94a3b8",fontWeight:700}}>рекорд <span style={{color:"#fcd34d",fontWeight:900}}>{rushBest}</span></div>}
                      {rushBestStreak>0&&<div style={{fontSize:10,color:"#94a3b8",fontWeight:700}}>серия <span style={{color:"#fb923c",fontWeight:900}}>{rushBestStreak}</span></div>}
                    </div>
                  </div>
                </div>}
                {/* Tags + rating */}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
                  {pzCurrent.r>0&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:10,
                    background:pzCurrent.r<1000?"#f0fdf4":pzCurrent.r<1500?"#fef9c3":pzCurrent.r<2000?"#fff7ed":"#fef2f2",
                    color:pzCurrent.r<1000?"#065f46":pzCurrent.r<1500?"#92400e":pzCurrent.r<2000?"#9a3412":"#991b1b",
                    fontWeight:800,border:"1px solid currentColor",opacity:0.7}}>
                    ⭐ {pzCurrent.r}
                  </span>}
                  {[pzCurrent.phase,pzCurrent.theme].filter(Boolean).map(t=><span key={t} style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#f3f4f6",color:T.dim,fontWeight:700}}>{t}</span>)}
                  {pzCurrent.goal==="Mate"&&pzCurrent.mateIn&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#fef2f2",color:"#991b1b",fontWeight:800}}>Мат в {pzCurrent.mateIn}</span>}
                </div>
                {/* Result banner */}
                {pzAttempt==="correct"&&<div style={{
                  fontSize:15,fontWeight:900,color:"#065f46",
                  padding:"10px 14px",marginBottom:10,borderRadius:8,
                  background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",
                  border:"1px solid #6ee7b7",
                  display:"flex",alignItems:"center",gap:8,
                  animation:"cc-turn-flash 0.6s ease-out"
                }}>
                  <span style={{fontSize:20}}>✅</span>
                  <span>{pzMode==="rush"&&rushStreak>=3?`Серия ${rushStreak}! 🔥`:pzMode==="rush"?"Верно! 🎯":"Отлично! Верный ход"}</span>
                  {(pzMode==="timed3"||pzMode==="timed5"||pzMode==="rush"||pzMode==="custom")&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:"#059669"}}>+3с ⏱</span>}
                </div>}
                {pzAttempt==="wrong"&&<div style={{
                  fontSize:14,fontWeight:900,color:"#991b1b",
                  padding:"10px 14px",marginBottom:10,borderRadius:8,
                  background:"linear-gradient(135deg,#fef2f2,#fee2e2)",
                  border:"1px solid #fca5a5",
                  display:"flex",alignItems:"center",gap:8
                }}>
                  <span style={{fontSize:18}}>❌</span>
                  <span>{pzMode==="rush"?"Неверно! Стрик сброшен":"Неверно. Попробуй ещё"}</span>
                  {pzMode==="rush"&&<span style={{marginLeft:"auto",fontSize:12,fontWeight:700,color:T.danger}}>−5с ⏱</span>}
                </div>}
                {pzAttempt==="shown"&&<div style={{
                  fontSize:13,fontWeight:800,color:"#78350f",
                  padding:"10px 14px",marginBottom:10,borderRadius:8,
                  background:"linear-gradient(135deg,#fffbeb,#fef3c7)",
                  border:"1px solid #fde68a"
                }}>💡 Правильный ход: <span style={{fontFamily:"monospace",background:"rgba(0,0,0,0.07)",padding:"2px 8px",borderRadius:4,fontSize:14,letterSpacing:1}}>{pzCurrent.sol[0]}</span></div>}
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
              {pzStreak.best>0&&<Card padding={SPACE[2]} tone="surface1" style={{background:"linear-gradient(135deg,#fff7ed,#ffedd5)",borderColor:"#fdba74",textAlign:"center"}}>
                <div style={{fontSize:20,fontWeight:900,color:"#c2410c",lineHeight:1}}>🔥{pzStreak.best}</div>
                <div style={{fontSize:10,color:"#9a3412",fontWeight:800,marginTop:2,letterSpacing:0.5,textTransform:"uppercase" as const}}>Рекорд серии</div>
              </Card>}
            </div>

            {/* ── Слабые темы — темы с наибольшим % ошибок (мин. 3 попытки) */}
            {Object.keys(themePerf).length>=3&&(()=>{
              const weak=Object.entries(themePerf)
                .filter(([,v])=>v.c+v.w>=3)
                .map(([th,v])=>({th,wr:Math.round(v.c/(v.c+v.w)*100),total:v.c+v.w}))
                .sort((a,b)=>a.wr-b.wr)
                .slice(0,3);
              if(weak.length===0)return null;
              return <div style={{padding:"8px 12px",borderRadius:8,background:"linear-gradient(135deg,#fef9c3,#fef3c7)",border:"1px solid #fde68a",fontSize:11}}>
                <div style={{fontWeight:900,color:"#92400e",marginBottom:5}}>⚠ Тренируй слабые темы:</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {weak.map(w=><button key={w.th} onClick={()=>{sPzFilterTheme(w.th);sPzI(0);sPzCategory("all")}}
                    style={{padding:"3px 9px",borderRadius:999,border:"1px solid #fbbf24",background:pzFilterTheme===w.th?"#fbbf24":"#fffbeb",color:pzFilterTheme===w.th?"#fff":"#92400e",fontWeight:800,cursor:"pointer",fontSize:10}}>
                    {w.th} · {w.wr}% ({w.total})
                  </button>)}
                </div>
              </div>;
            })()}

            {/* ── Theme Browser ── lichess-style visual theme grid (top 16 by count). One click sets the
                theme filter and resets the index. Bigger cards than the category selector to draw the eye. */}
            {(()=>{
              const themeCounts=new Map<string,number>();
              for(const p of PUZZLES){if(p.theme)themeCounts.set(p.theme,(themeCounts.get(p.theme)||0)+1)}
              const top=Array.from(themeCounts.entries()).sort((a,b)=>b[1]-a[1]).slice(0,16);
              if(top.length===0)return null;
              const THEME_META:Record<string,{emoji:string;color:string}>={
                "Мат в 1":{emoji:"♔",color:"#dc2626"},
                "Мат в 2":{emoji:"♔",color:"#ea580c"},
                "Мат в 3":{emoji:"♔",color:"#d97706"},
                "Вилка":{emoji:"🍴",color:"#7c3aed"},
                "Связка":{emoji:"📎",color:"#0891b2"},
                "Двойной удар":{emoji:"💥",color:"#be123c"},
                "Завлечение":{emoji:"🎣",color:"#0e7490"},
                "Отвлечение":{emoji:"🎭",color:"#9333ea"},
                "Открытое нападение":{emoji:"🗡",color:"#b91c1c"},
                "Жертва":{emoji:"⚔",color:"#9f1239"},
                "Эндшпиль":{emoji:"🏁",color:"#059669"},
                "Дебют":{emoji:"📖",color:"#2563eb"},
                "Миттельшпиль":{emoji:"⚡",color:"#7c2d12"},
                "Промежуточный ход":{emoji:"⏱",color:"#a16207"},
                "Твоя ошибка":{emoji:"🎯",color:"#be185d"},
              };
              return <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
                <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,background:"#f9fafb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:800,color:T.dim,letterSpacing:"0.06em",textTransform:"uppercase" as const}}>🏷 Темы · топ {top.length} из {themeCounts.size}</span>
                  {pzFilterTheme!=="all"&&<button onClick={()=>{sPzFilterTheme("all");sPzI(0)}}
                    style={{fontSize:10,padding:"3px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",color:T.dim,fontWeight:700,cursor:"pointer"}}>× очистить</button>}
                </div>
                <div style={{padding:"8px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:6}}>
                  {top.map(([th,cnt])=>{
                    const meta=THEME_META[th]||{emoji:"♟",color:T.text};
                    const active=pzFilterTheme===th;
                    return <button key={th} onClick={()=>{sPzFilterTheme(active?"all":th);sPzI(0);sPzCategory("all");sPzFilterGoal("all");sPzFilterMate(0);sPzFilterPhase("all")}}
                      title={`${th} · ${cnt} задач`}
                      style={{
                        padding:"10px 8px",borderRadius:8,
                        border:active?`2px solid ${meta.color}`:`1px solid ${T.border}`,
                        background:active?`${meta.color}15`:"#fff",
                        color:active?meta.color:T.text,
                        fontSize:11,fontWeight:700,cursor:"pointer",
                        display:"flex",flexDirection:"column",alignItems:"center",gap:3,
                        transition:`all ${MOTION.fast} ${MOTION.ease}`
                      }}>
                      <span style={{fontSize:18}}>{meta.emoji}</span>
                      <span style={{fontSize:11,fontWeight:800,lineHeight:1.2,textAlign:"center"}}>{th}</span>
                      <span style={{fontSize:9,color:T.dim,fontWeight:800}}>{cnt}</span>
                    </button>;
                  })}
                </div>
              </div>;
            })()}

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
              <SectionHeader title="РЕЖИМ" hint={pzMode==="rush"?`Rush ${Math.floor(rushDuration/60)}:${String(rushDuration%60).padStart(2,"0")} · +1..+3с per solve`:pzMode==="timed3"?"3 мин + bonus":pzMode==="timed5"?"5 мин + bonus":pzMode==="custom"?`Custom ${Math.floor(pzCustomSec/60)}:${String(pzCustomSec%60).padStart(2,"0")}`:""}/>
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:SPACE[1]}}>
                {([["learn","📚","Обучение"],["timed3","3⏱","3 мин"],["timed5","5⏱","5 мин"],["custom","⚙","Custom"],["rush","⚡","Rush"]] as const).map(([m,ic,label])=>{
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
              {/* Custom duration input — пресеты + произвольное число секунд (любой контроль). */}
              {pzMode==="custom"&&<div style={{marginTop:SPACE[2],paddingTop:SPACE[2],borderTop:`1px dashed ${CC.border}`}}>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:1.2,color:CC.textMute,textTransform:"uppercase" as const,marginBottom:6}}>Длительность · любой контроль</div>
                <div style={{display:"flex",gap:SPACE[1],flexWrap:"wrap",alignItems:"center"}}>
                  {([[60,"1 мин"],[120,"2 мин"],[600,"10 мин"],[1200,"20 мин"],[1800,"30 мин"]] as const).map(([sec,label])=>{
                    const active=pzCustomSec===sec;
                    return <button key={sec} onClick={()=>{sPzCustomSec(sec);sPzTimeLeft(sec);showToast(`Custom ${label}`,"info")}}
                      style={{padding:"5px 10px",borderRadius:RADIUS.sm,
                        border:active?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                        background:active?"rgba(5,150,105,0.10)":CC.surface1,color:active?CC.brand:CC.textDim,
                        fontSize:11,fontWeight:800,cursor:"pointer"}}>{label}</button>;
                  })}
                  <span style={{fontSize:11,color:CC.textMute,marginLeft:4}}>сек:</span>
                  <input type="number" min={30} max={3600} step={30}
                    value={pzCustomSec}
                    onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>=30&&v<=3600){sPzCustomSec(v);sPzTimeLeft(v)}}}
                    style={{width:78,padding:"5px 8px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontSize:12,fontFamily:"ui-monospace,monospace",fontWeight:800,color:CC.text,background:CC.surface1}}/>
                </div>
              </div>}
              {/* Rush duration selector — виден только когда выбран Rush */}
              {pzMode==="rush"&&<div style={{marginTop:SPACE[2],paddingTop:SPACE[2],borderTop:`1px dashed ${CC.border}`}}>
                <div style={{fontSize:9,fontWeight:900,letterSpacing:1.2,color:CC.textMute,textTransform:"uppercase" as const,marginBottom:6}}>Длительность Rush</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:SPACE[1]}}>
                  {([[90,"1:30"],[180,"3 мин"],[300,"5 мин"],[600,"10 мин"]] as const).map(([sec,label])=>{
                    const active=rushDuration===sec;
                    return <button key={sec} onClick={()=>{sRushDuration(sec);if(rushActive){sPzTimeLeft(sec);sRushScore(0);sRushStreak(0);sRushBestStreak(0)}}}
                      style={{padding:"6px 4px",borderRadius:RADIUS.sm,
                        border:active?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                        background:active?"rgba(5,150,105,0.10)":CC.surface1,color:active?CC.brand:CC.textDim,
                        fontSize:11,fontWeight:800,cursor:"pointer",
                        transition:`all ${MOTION.fast} ${MOTION.ease}`}}>{label}</button>;
                  })}
                  <input type="number" min={30} max={1800} step={30}
                    value={[90,180,300,600].includes(rushDuration)?"":rushDuration}
                    onChange={e=>{const v=parseInt(e.target.value);if(!isNaN(v)&&v>=30&&v<=1800)sRushDuration(v)}}
                    placeholder="свой"
                    title="Custom (30-1800 сек)"
                    style={{padding:"6px 4px",borderRadius:RADIUS.sm,
                      border:![90,180,300,600].includes(rushDuration)?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                      background:CC.surface1,color:CC.text,fontSize:11,fontWeight:800,textAlign:"center",
                      width:"100%",outline:"none"}}/>
                </div>
              </div>}
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
                {/* Rating range filter */}
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:5,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Сложность (рейтинг)</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                    {([["all","Все"],[0,800,"Новичок"],[800,1200,"Лёгкий"],[1200,1600,"Средний"],[1600,2000,"Сложный"],[2000,3000,"Мастер"]] as const).map((entry,i)=>{
                      const isAll=entry[0]==="all";
                      const label=isAll?entry[1]:entry[2] as string;
                      const active=isAll?(pzFilterRating[0]===0&&pzFilterRating[1]===3000):(pzFilterRating[0]===(entry[0] as number)&&pzFilterRating[1]===(entry[1] as number));
                      return <button key={i} onClick={()=>{
                        if(isAll){sPzFilterRating([0,3000]);}
                        else{sPzFilterRating([entry[0] as number,entry[1] as number]);}
                        sPzI(0);
                      }} style={{padding:"4px 9px",borderRadius:6,border:"none",background:active?"#1e293b":"#f3f4f6",color:active?"#fff":T.dim,fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>;
                    })}
                    <button onClick={()=>{
                      // Match ELO — puzzles ±200 of player rating
                      const lo=Math.max(0,rat-200),hi=Math.min(3000,rat+200);
                      sPzFilterRating([lo,hi]);sPzI(0);
                      showToast(`Пазлы подобраны под ELO ${rat} (${lo}–${hi})`,"info");
                    }} style={{padding:"4px 9px",borderRadius:6,border:"1px solid #7c3aed",background:Math.abs(pzFilterRating[0]-(Math.max(0,rat-200)))<50?"#7c3aed":"transparent",color:Math.abs(pzFilterRating[0]-(Math.max(0,rat-200)))<50?"#fff":"#7c3aed",fontSize:11,fontWeight:800,cursor:"pointer"}}>
                      ⚡ Матч ELO {rat}
                    </button>
                  </div>
                </div>
                {(pzFilterGoal!=="all"||pzFilterPhase!=="all"||pzFilterSide!=="all"||pzFilterTheme!=="all"||pzFilterMate!==0||pzFilterRating[0]!==0||pzFilterRating[1]!==3000)&&<button onClick={()=>{sPzFilterGoal("all");sPzFilterPhase("all");sPzFilterSide("all");sPzFilterTheme("all");sPzFilterMate(0);sPzFilterRating([0,3000]);sPzI(0);}} style={{padding:"6px 12px",borderRadius:6,border:`1px solid ${T.danger}`,background:"#fff",color:T.danger,fontSize:12,fontWeight:700,cursor:"pointer",alignSelf:"flex-start"}}>✕ Сбросить</button>}
              </div>}
            </div>

            {/* ── Puzzle List (collapsible) ── */}
            <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,overflow:"hidden"}}>
              <div role="button" tabIndex={0} onClick={()=>sPuzzleListOpen(!puzzleListOpen)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();sPuzzleListOpen(!puzzleListOpen)}}} style={{width:"100%",padding:"10px 14px",borderBottom:puzzleListOpen?`1px solid ${T.border}`:"none",background:"#f9fafb",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
                <span style={{fontSize:12,fontWeight:800,color:T.text,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>📋 Список задач ({fPz.length}/{PUZZLES.length})</span>
                {PUZZLES.length<5000&&<button onClick={e=>{e.stopPropagation();sShowPuzzleExpand(true)}} className="cc-focus-ring" style={{marginLeft:"auto",padding:"3px 10px",borderRadius:RADIUS.full,background:CC.accentSoft,color:CC.accent,border:`1px solid ${CC.accent}`,fontSize:11,fontWeight:800,cursor:"pointer"}}>+ Расширить до 20k</button>}
                <span style={{fontSize:11,color:T.dim,fontWeight:700,transform:puzzleListOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}>▼</span>
              </div>
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

          {/* ── Eval Graph + Key Moments ── lichess-style timeline. Visible only when analysis has run.
              Each ply is plotted on a sparkline; clicking a point jumps to that move (sets browseIdx).
              Below the graph is a chip-row of "key moments" (blunders/mistakes/brilliancies) for fast nav. */}
          {tab==="analysis"&&analysis.length>0&&hist.length>0&&(()=>{
            const W=560,H=72;
            const pts=analysis.map((a,i)=>{
              const cp=a.mate!==0?(a.mate>0?2000:-2000):Math.max(-1000,Math.min(1000,a.cp));
              return{x:i,cp,quality:a.quality};
            });
            const xs=(i:number)=>pts.length<=1?W/2:(i/(pts.length-1))*W;
            const ys=(cp:number)=>H/2-(Math.max(-1000,Math.min(1000,cp))/1000)*(H/2-2);
            const path=pts.map((p,i)=>`${i===0?"M":"L"}${xs(i).toFixed(1)},${ys(p.cp).toFixed(1)}`).join(" ");
            const fillPath=`${path} L${xs(pts.length-1).toFixed(1)},${H/2} L${xs(0).toFixed(1)},${H/2} Z`;
            const QUALITY_COL:Record<string,string>={great:"#10b981",good:"#94a3b8",inacc:"#f59e0b",mistake:"#ea580c",blunder:"#dc2626"};
            // Key moments — only blunders+mistakes+great moves. Show as jump chips.
            const keyMoments=pts.filter(p=>p.quality==="blunder"||p.quality==="mistake"||p.quality==="great");
            // browseIdx maps to ply index. Convert: ply N is between fenHist[N] and fenHist[N+1]; analysis[i] corresponds to ply i.
            const goToPly=(i:number)=>{
              const fenIdx=i+1; // after the move was played
              if(!fenHist[fenIdx])return;
              try{const g=new Chess(fenHist[fenIdx]);setGame(g);sBk(k=>k+1);sBrowseIdx(fenIdx>=hist.length?-1:fenIdx);sLm(null);sSel(null);sVm(new Set())}catch{}
            };
            const curPly=browseIdx<0?hist.length-1:browseIdx-1;
            return <div style={{borderRadius:RADIUS.lg,background:T.surface,border:`1px solid ${T.border}`,padding:`${SPACE[3]}px ${SPACE[4]}px`,display:"flex",flexDirection:"column",gap:SPACE[2]}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{fontSize:11,fontWeight:900,letterSpacing:0.5,textTransform:"uppercase" as const,color:T.purple}}>📈 Эval graph · {pts.length} ходов</div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <button onClick={()=>{try{navigator.clipboard.writeText(game.fen());showToast("FEN скопирован","success")}catch{}}} style={{padding:"3px 8px",borderRadius:6,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}} title="Скопировать FEN текущей позиции">📋 Скопировать FEN</button>
                  <div style={{fontSize:10,color:T.dim,fontWeight:700}}>клик по точке → переход к ходу</div>
                </div>
              </div>
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
                style={{width:"100%",height:78,background:"linear-gradient(180deg,#fafafa 0%,#f3f4f6 50%,#fafafa 100%)",borderRadius:6,cursor:"crosshair"}}>
                <line x1="0" y1={H/2} x2={W} y2={H/2} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3,2"/>
                <path d={fillPath} fill="rgba(124,58,237,0.10)"/>
                <path d={path} fill="none" stroke="#7c3aed" strokeWidth="1.4" strokeLinejoin="round"/>
                {pts.map((p,i)=>{
                  const isCur=i===curPly;
                  const r=p.quality==="blunder"||p.quality==="great"?2.6:isCur?2.8:1.6;
                  return <circle key={i} cx={xs(i)} cy={ys(p.cp)} r={r}
                    fill={QUALITY_COL[p.quality]||"#7c3aed"}
                    stroke={isCur?"#0f172a":"#fff"} strokeWidth={isCur?1.4:0.6}
                    style={{cursor:"pointer"}}
                    onClick={()=>goToPly(i)}>
                    <title>Ход {Math.floor(i/2)+1}{i%2===0?".":"..."} {hist[i]||""} · cp {(p.cp/100).toFixed(1)}{p.quality!=="good"?` · ${p.quality}`:""}</title>
                  </circle>;
                })}
              </svg>
              {keyMoments.length>0&&<div style={{display:"flex",gap:SPACE[1],flexWrap:"wrap",alignItems:"center",fontSize:11}}>
                <span style={{fontSize:10,color:T.dim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const,marginRight:4}}>🎯 ключевые моменты:</span>
                {keyMoments.map(m=>{
                  const isUserMove=hist.length>0&&((pCol==="w")===(m.x%2===0));
                  const ic=m.quality==="blunder"?"??":m.quality==="mistake"?"?":"!";
                  const col=QUALITY_COL[m.quality];
                  return <button key={m.x} onClick={()=>goToPly(m.x)}
                    title={`${hist[m.x]||""} · ход ${Math.floor(m.x/2)+1}${m.x%2===0?".":"..."} · ${m.quality}`}
                    style={{display:"inline-flex",alignItems:"center",gap:4,padding:"3px 9px",borderRadius:999,
                      border:`1px solid ${col}66`,background:`${col}14`,color:col,
                      fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",
                      ...(isUserMove?{}:{opacity:0.7})}}>
                    <span style={{fontWeight:900}}>{ic}</span>
                    <span>{Math.floor(m.x/2)+1}{m.x%2===0?".":"..."}</span>
                  </button>;
                })}
              </div>}
              {/* Critical moment card — largest single eval swing */}
              {pts.length>=4&&(()=>{
                let maxSwing=0;let swingIdx=1;
                for(let i=1;i<pts.length;i++){
                  const swing=Math.abs(pts[i].cp-pts[i-1].cp);
                  if(swing>maxSwing){maxSwing=swing;swingIdx=i}
                }
                if(maxSwing<150)return null; // not significant
                const p=pts[swingIdx];const prev=pts[swingIdx-1];
                const isUserCaused=((pCol==="w")===(swingIdx%2===0));
                const moveSan=hist[swingIdx]||`ход ${Math.floor(swingIdx/2)+1}`;
                const cpChange=((p.cp-prev.cp)/100).toFixed(1);
                return <div onClick={()=>goToPly(swingIdx)} style={{
                  marginTop:4,padding:"7px 10px",borderRadius:8,cursor:"pointer",
                  background:isUserCaused?"rgba(220,38,38,0.06)":"rgba(5,150,105,0.06)",
                  border:`1px solid ${isUserCaused?"#fca5a5":"#a7f3d0"}`,
                  display:"flex",alignItems:"center",gap:8,
                }}>
                  <span style={{fontSize:16}}>⚡</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:900,color:isUserCaused?"#b91c1c":"#065f46"}}>
                      {isUserCaused?"Поворотный момент — здесь ты изменил ход партии":"Соперник изменил ход партии здесь"}
                    </div>
                    <div style={{fontSize:10,color:T.dim}}>
                      {moveSan} · изменение {cpChange} cp · ход {Math.floor(swingIdx/2)+1}
                    </div>
                  </div>
                  <span style={{fontSize:10,color:T.dim,fontWeight:700}}>→ перейти</span>
                </div>;
              })()}
            </div>;
          })()}

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
              {/* Position Notes — user annotations for current analysis session */}
              {(()=>{
                const PN_KEY=`aevion_pos_note_${game.fen().split(" ")[0]}`;
                const[note,sNote]=typeof window!=="undefined"?[localStorage.getItem(PN_KEY)||"",(v:string)=>{try{localStorage.setItem(PN_KEY,v)}catch{}}]:["",()=>{}];
                return<div style={{marginTop:8}}>
                  <div style={{fontSize:10,fontWeight:800,color:T.dim,letterSpacing:0.5,textTransform:"uppercase" as const,marginBottom:4}}>📝 Заметки к позиции</div>
                  <textarea defaultValue={note} onChange={e=>{sNote(e.target.value)}} placeholder="Запиши идею, план или комментарий к этой позиции…" rows={2}
                    style={{width:"100%",padding:"6px 8px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:12,color:T.text,resize:"vertical",background:"#fafafa",boxSizing:"border-box"}}/>
                </div>;
              })()}

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
            {/* ─── Best 3 games card — shown when user has ≥3 games and is in setup view ─── */}
            {setup&&savedGames.length>=3&&(()=>{
              const isW=(g:SavedGame)=>g.result.includes("You win")||g.result.includes("win!");
              const isD=(g:SavedGame)=>g.result.includes("Draw")||g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
              const wins=savedGames.filter(g=>isW(g)).slice(0,3);
              const toShow=wins.length>=3?wins:savedGames.slice(0,3);
              return <div style={{borderRadius:10,background:"linear-gradient(135deg,#fefce8,#fef9c3)",border:"1px solid #fde047",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>🏅</span>
                  <span style={{fontSize:11,fontWeight:900,color:"#713f12",letterSpacing:0.5,textTransform:"uppercase" as const,flex:1}}>Лучшие партии</span>
                  <span style={{fontSize:10,color:"#92400e",fontWeight:700}}>{savedGames.length} всего</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {toShow.map((g,i)=>{
                    const w=isW(g);const d=isD(g);
                    return <div key={g.id||i} style={{
                      display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
                      borderRadius:7,background:"rgba(255,255,255,0.65)",
                      border:"1px solid rgba(253,224,71,0.5)",fontSize:12
                    }}>
                      <span style={{fontSize:14,minWidth:18}}>{w?"🏆":d?"🤝":"💔"}</span>
                      <span style={{fontWeight:700,color:"#451a03",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{g.opening||"Стандарт"}</span>
                      <span style={{color:"#78350f",fontWeight:700,whiteSpace:"nowrap"}}>{g.moves?.length||0} ходов</span>
                      <span style={{color:w?"#059669":d?"#6b7280":"#dc2626",fontWeight:900,fontSize:11}}>{g.rating||rat}</span>
                    </div>;
                  })}
                </div>
              </div>;
            })()}
            {/* ─── Personal Opening Repertoire summary ─── lichess-style mini-tracker.
                Shows white/black entry counts, top-3 most-used lines with W/L,
                CTA to add current line and to open the full modal. */}
            {(()=>{
              const wEntries=repertoire.entries.filter(e=>e.color==="w");
              const bEntries=repertoire.entries.filter(e=>e.color==="b");
              const top3=[...repertoire.entries].sort((a,b)=>b.uses-a.uses).slice(0,3);
              const canAddCurrent=hist.length>=4;
              const matched=matchHist(repertoire,hist,pCol);
              const onBook=matched.length>0&&matched[0].matchedPlies===hist.length;
              return <div style={{borderRadius:10,background:"linear-gradient(135deg,#fffbeb,#fef9c3)",border:"1px solid #fde68a",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>📚</span>
                  <span style={{fontSize:11,fontWeight:900,color:"#92400e",letterSpacing:0.5,textTransform:"uppercase" as const,flex:1}}>Мой дебютный репертуар</span>
                  {hist.length>0&&matched.length>0&&<span title={`Совпадение с «${matched[0].entry.name}» на ${matched[0].matchedPlies}/${matched[0].entry.moves.length} ходов`} style={{
                    fontSize:10,fontWeight:900,padding:"2px 8px",borderRadius:RADIUS.full,
                    background:onBook?"#10b981":"#94a3b8",color:"#fff",letterSpacing:0.3
                  }}>{onBook?"✓ on book":`${matched[0].matchedPlies}/${matched[0].entry.moves.length}`}</span>}
                </div>
                <div style={{display:"flex",gap:6,fontSize:11,color:"#78350f"}}>
                  <span>⚪ {wEntries.length} линий за белых</span>
                  <span>·</span>
                  <span>⚫ {bEntries.length} линий за чёрных</span>
                  {repertoire.entries.length>0&&<>
                    <span>·</span>
                    <span>сыграно: {repertoire.entries.reduce((a,e)=>a+e.uses,0)}</span>
                  </>}
                </div>
                {top3.length>0&&<div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {top3.map(e=>{
                    const total=e.wins+e.losses+e.draws;
                    const wr=total>0?Math.round(e.wins/total*100):0;
                    return <div key={e.id} style={{
                      display:"flex",alignItems:"center",gap:6,padding:"4px 8px",
                      borderRadius:6,background:"rgba(255,255,255,0.55)",
                      fontSize:11
                    }}>
                      <span style={{fontSize:12}}>{e.color==="w"?"⚪":"⚫"}</span>
                      <span style={{fontWeight:700,color:"#451a03",flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.name}</span>
                      <span style={{color:"#92400e",fontWeight:700}}>{e.moves.length} ходов</span>
                      {e.uses>0&&<span style={{color:wr>=50?CC.brand:CC.danger,fontWeight:800,minWidth:34,textAlign:"right"}}>{wr}% WR</span>}
                    </div>;
                  })}
                </div>}
                {repertoire.entries.length===0&&<div style={{fontSize:11,color:"#78350f",fontStyle:"italic",lineHeight:1.5}}>
                  Сохрани свои дебютные линии — Coach будет подсказывать «on book / off book» во время игры. Lichess-style.
                </div>}
                <div style={{display:"flex",gap:6}}>
                  {canAddCurrent&&<Btn size="sm" variant="secondary" onClick={()=>{
                    const name=prompt("Название линии (например, «Italian — Main»):",currentOpening?.name||`Моя линия #${repertoire.entries.length+1}`);
                    if(!name)return;
                    const eco=currentOpening?.eco;
                    const ecoName=currentOpening?.name;
                    const entry:RepertoireEntry={
                      id:Date.now().toString(36),name,color:pCol,
                      moves:[...hist],eco,ecoName,
                      createdAt:Date.now(),uses:0,wins:0,losses:0,draws:0
                    };
                    sRepertoire(r=>({...r,entries:[entry,...r.entries]}));
                    showToast(`📚 «${name}» сохранено в репертуар`,"success");
                  }}>+ Сохранить текущую линию</Btn>}
                  <Btn size="sm" variant="primary" onClick={()=>sRepertoireOpen(true)}>📖 Открыть репертуар (R)</Btn>
                </div>
              </div>;
            })()}
            {/* ─── Coach Chat — conversational AI tutor ─── sends FEN + history + question to
                /api/coach/chat (Anthropic Claude). Suggested questions auto-populate the input.
                Messages persist within session (not localStorage — too sensitive to overflow). */}
            {(()=>{
              const BACKEND=typeof window!=="undefined"&&window.location.hostname==="localhost"?"http://localhost:4001":"https://api.aevion.app";
              const SUGGESTED=[
                {q:"Что в этой позиции? Объясни сильные и слабые стороны.",icon:"🔍"},
                {q:"Какой план мне сейчас играть?",icon:"📋"},
                {q:"Где моя последняя ошибка и как её надо было сыграть?",icon:"❓"},
                {q:"Какой дебют я играю и какие типичные планы в нём?",icon:"📖"},
                {q:"Объясни последний ход соперника — почему он его сделал?",icon:"🤔"},
                {q:"Какие тактические возможности есть в позиции?",icon:"🎯"},
                {q:"Как улучшить мою активность фигур?",icon:"♞"},
                {q:"Чему меня учит эта партия?",icon:"🎓"},
              ];
              const sendChat=async(question:string)=>{
                if(coachChatLoading)return;
                if(!question.trim())return;
                sendChatRef.current=sendChat;
                const fen=game.fen();
                const turn=game.turn()==="w"?"белые":"чёрные";
                const lastMove=hist.length>0?hist[hist.length-1]:"(партия не начата)";
                const recent=hist.slice(-10).join(" ");
                const evalCpStr=evalMate!==0?`#${evalMate>0?evalMate:-evalMate}`:`${evalCp>=0?"+":""}${(evalCp/100).toFixed(2)}`;
                const phase=hist.length<14?"дебют":hist.length<40?"миттельшпиль":"эндшпиль";
                const userMsg:CoachMsg={role:"user",content:question.trim(),ts:Date.now()};
                const newMsgs=[...coachChat,userMsg];
                sCoachChat(newMsgs);
                sCoachChatInput("");
                sCoachChatLoading(true);
                // Annotated moves summary for coach context
                const annotSummary=Object.keys(moveAnnotations).length>0
                  ?"\nАннотации игрока: "+Object.entries(moveAnnotations).map(([i,a])=>{const mv=hist[Number(i)];return mv?`${mv}${a}`:"";}).filter(Boolean).join(", ")
                  :"";
                const openingCtx=currentOpening?`\nДебют: ${currentOpening.eco} ${currentOpening.name}`:"";
                const variantCtx=variant!=="standard"?`\nВариант: ${variant}`:"";
                // Build context block prepended to the user's question for the API.
                const contextBlock=`КОНТЕКСТ ПОЗИЦИИ:
FEN: ${fen}
Ход ${Math.floor(hist.length/2)+1}, ${turn} ходят. Фаза: ${phase}.${openingCtx}${variantCtx}
Последние ходы: ${recent||"начало партии"}
Последний ход: ${lastMove}
Engine eval: ${evalCpStr} (с точки зрения белых)
Игрок играет: ${pCol==="w"?"белыми":"чёрными"}, рейтинг ${rat}${annotSummary}

ВОПРОС УЧЕНИКА:
${question.trim()}`;
                const SYSTEM=`Ты AEVION CyberChess Coach — опытный шахматный тренер. Отвечай на русском, конкретно, по позиции. 2-5 предложений. Без воды и общих фраз. Если просят план — дай конкретные ходы (SAN) и идею. Если про ошибку — назови ход и худшую альтернативу. Используй FEN и engine eval как источник истины. Не выдумывай ходов. Если есть аннотации — прокомментируй отмеченные моменты.`;
                try{
                  const ctrl=new AbortController();
                  const tId=setTimeout(()=>ctrl.abort(),30000);
                  const apiMsgs=[...coachChat,{role:"user" as const,content:contextBlock}].map(m=>({role:m.role,content:typeof m==="object"&&"content" in m?m.content:""}));
                  const res=await fetch(`${BACKEND}/api/coach/chat`,{
                    method:"POST",headers:{"Content-Type":"application/json"},
                    body:JSON.stringify({system:SYSTEM,messages:apiMsgs,maxTokens:600}),
                    signal:ctrl.signal
                  });
                  clearTimeout(tId);
                  if(!res.ok){const e=await res.json().catch(()=>({error:`HTTP ${res.status}`}));throw new Error(e.error||`Server ${res.status}`)}
                  const data=await res.json();
                  const reply=data.content?.filter((c:any)=>c.type==="text"||c.text).map((c:any)=>c.text||"").join("")||"(нет ответа)";
                  sCoachChat([...newMsgs,{role:"assistant",content:reply,ts:Date.now()}]);
                }catch(e:any){
                  const errMsg=e?.name==="AbortError"?"⏱ Coach думал слишком долго — попробуй ещё раз":/fetch|network|Failed/i.test(e?.message||"")?"⚠ Не могу связаться с Coach AI. Бэкенд недоступен — попробуй через минуту или используй кнопки 🔍 Объясни / 📋 План выше.":`Ошибка: ${e?.message||"unknown"}`;
                  sCoachChat([...newMsgs,{role:"assistant",content:errMsg,ts:Date.now()}]);
                }finally{
                  sCoachChatLoading(false);
                }
              };
              return <div style={{borderRadius:10,background:"linear-gradient(135deg,#eff6ff,#dbeafe)",border:"1px solid #93c5fd",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>💬</span>
                  <span style={{fontSize:11,fontWeight:900,color:T.blue,letterSpacing:0.5,textTransform:"uppercase" as const,flex:1}}>Спроси Coach — chat с AI</span>
                  {coachChat.length>0&&<span style={{fontSize:9,color:T.dim,fontWeight:600}}>{coachChat.length} сообщ.</span>}
                  {coachChat.length>0&&<button onClick={()=>sCoachChat([])} title="Очистить историю" style={{padding:"2px 8px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:10,fontWeight:700,color:T.dim,cursor:"pointer"}}>× очистить</button>}
                </div>
                {coachChat.length>0&&coachChat[0]?.ts&&Date.now()-coachChat[0].ts>60000&&(
                  <div style={{fontSize:10,color:"#1e40af",padding:"4px 8px",borderRadius:6,background:"rgba(30,64,175,0.08)",border:"1px solid #bfdbfe"}}>
                    📂 История восстановлена из прошлой сессии
                  </div>
                )}
                {coachChat.length===0&&<div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {SUGGESTED.map(s=><button key={s.q} onClick={()=>sendChat(s.q)} disabled={coachChatLoading}
                    style={{padding:"5px 9px",borderRadius:RADIUS.full,border:`1px solid ${T.border}`,background:"#fff",color:"#1e3a8a",fontSize:11,fontWeight:700,cursor:"pointer",lineHeight:1.3,opacity:coachChatLoading?0.5:1}}>
                    {s.icon} {s.q.length>40?s.q.slice(0,38)+"…":s.q}
                  </button>)}
                </div>}
                {coachChat.length>0&&<div ref={coachChatScrollRef} style={{maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:6,padding:"4px 0"}}>
                  {coachChat.map((m,i)=><div key={i} style={{
                    padding:"7px 10px",borderRadius:RADIUS.md,
                    background:m.role==="user"?"linear-gradient(135deg,#1e40af,#3b82f6)":"#fff",
                    color:m.role==="user"?"#fff":"#0f172a",
                    fontSize:12,lineHeight:1.55,whiteSpace:"pre-wrap",
                    border:m.role==="user"?"none":"1px solid #c7d2fe",
                    alignSelf:m.role==="user"?"flex-end":"flex-start",
                    maxWidth:"92%",
                    boxShadow:m.role==="user"?"0 1px 3px rgba(30,64,175,0.2)":"none"
                  }}>
                    <div style={{fontSize:9,fontWeight:900,opacity:0.7,marginBottom:2,letterSpacing:0.4,textTransform:"uppercase" as const}}>{m.role==="user"?"ты":"☕ coach"}</div>
                    {m.content}
                  </div>)}
                  {coachChatLoading&&<div style={{padding:"7px 10px",borderRadius:RADIUS.md,background:"#fff",border:"1px solid #c7d2fe",color:T.dim,fontSize:12,fontStyle:"italic",alignSelf:"flex-start",maxWidth:"92%"}}>
                    Coach печатает<span style={{animation:"cc-fade-in 0.6s ease-out infinite alternate"}}>…</span>
                  </div>}
                </div>}
                <div style={{display:"flex",gap:6}}>
                  <input
                    value={coachChatInput}
                    onChange={e=>sCoachChatInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"&&coachChatInput.trim()&&!coachChatLoading){sendChat(coachChatInput)}}}
                    placeholder={coachChatLoading?"Coach думает…":"Спроси что-нибудь о позиции…"}
                    disabled={coachChatLoading}
                    style={{flex:1,padding:"7px 10px",borderRadius:RADIUS.md,border:`1px solid ${T.border}`,fontSize:12,background:"#fff",color:T.text,outline:"none"}}
                  />
                  <button onClick={()=>sendChat(coachChatInput)} disabled={coachChatLoading||!coachChatInput.trim()}
                    style={{padding:"7px 14px",borderRadius:RADIUS.md,border:"none",background:coachChatLoading||!coachChatInput.trim()?"#cbd5e1":"linear-gradient(135deg,#1e40af,#3b82f6)",color:"#fff",fontSize:12,fontWeight:800,cursor:coachChatLoading||!coachChatInput.trim()?"default":"pointer"}}>
                    {coachChatLoading?"…":"Спросить"}
                  </button>
                </div>
                <div style={{fontSize:10,color:"#64748b",lineHeight:1.4}}>
                  💡 Coach видит текущий FEN, последние 10 ходов, eval Stockfish и твой рейтинг. Спрашивай про позицию, план, ошибки, дебют — будет конкретный ответ. Pro: Anthropic Claude Sonnet, ~3 секунды на ответ.
                </div>
              </div>;
            })()}
            {/* ─── Personal weakness analyzer ─── data-driven insights from saved games.
                Uses existing computeGameDNA. Hidden until 5+ games played. */}
            {savedGames.length>=5&&(()=>{
              const dna=gameDna;
              const flags:{label:string;detail:string;tone:"warn"|"info"|"good"}[]=[];
              if(dna.whiteWinPct-dna.blackWinPct>20&&dna.blackGames>=3){
                flags.push({label:"⚫ Слабая защита",detail:`${dna.whiteWinPct}% за белых vs ${dna.blackWinPct}% за чёрных. Учи дебюты за чёрных (Caro-Kann, KID).`,tone:"warn"});
              }
              if(dna.blackWinPct-dna.whiteWinPct>20&&dna.whiteGames>=3){
                flags.push({label:"⚪ Слабая инициатива",detail:`${dna.blackWinPct}% за чёрных vs ${dna.whiteWinPct}% за белых. Учи активные дебюты за белых (Italian, KIA).`,tone:"warn"});
              }
              if(dna.avgLengthLoss>0&&dna.avgLengthLoss<25){
                flags.push({label:"⚡ Ранние зевки",detail:`Средняя длина проигрыша: ${dna.avgLengthLoss} ходов. Урок 2 «Не зевай — blunder check» — твой приоритет.`,tone:"warn"});
              }
              if(dna.tacticalPhaseLoss==="opening"){
                flags.push({label:"📖 Дебютные ошибки",detail:`Большинство поражений — в дебюте. Работай над репертуаром (Урок 14) и принципами (Урок 1).`,tone:"warn"});
              }
              if(dna.tacticalPhaseLoss==="endgame"){
                flags.push({label:"🏁 Слабый эндшпиль",detail:`Чаще теряешь в эндшпиле. Урок 5 (пешечные эндшпили) + Урок 3 (базовые маты).`,tone:"warn"});
              }
              if(dna.recentTrend==="up"&&dna.recentWinPctDelta>=10){
                flags.push({label:"📈 Растёшь",detail:`Последние 10 партий +${dna.recentWinPctDelta}% к WR. Продолжай в том же темпе!`,tone:"good"});
              }
              if(dna.recentTrend==="down"&&dna.recentWinPctDelta<=-10){
                flags.push({label:"📉 Спад формы",detail:`Последние 10 партий ${dna.recentWinPctDelta}% к WR. Возможно — усталость. Сделай перерыв или возьми Урок по психологии (Roadmap).`,tone:"warn"});
              }
              if(dna.bestOpening){
                flags.push({label:`✓ Сильный дебют: ${dna.bestOpening.opening}`,detail:`${dna.bestOpening.winPct}% побед в ${dna.bestOpening.total} партиях. Изучи его глубже — это твой репертуар.`,tone:"good"});
              }
              if(dna.worstOpening&&dna.worstOpening.total>=3){
                flags.push({label:`✗ Слабый дебют: ${dna.worstOpening.opening}`,detail:`${dna.worstOpening.winPct}% побед в ${dna.worstOpening.total} партиях. Либо изучи его, либо смени на другой.`,tone:"warn"});
              }
              if(dna.currentStreak.type==="L"&&dna.currentStreak.count>=3){
                flags.push({label:`💔 Серия проигрышей ×${dna.currentStreak.count}`,detail:`Возьми паузу 30 минут или поиграй пазлы для восстановления уверенности.`,tone:"warn"});
              }
              return <div style={{borderRadius:10,background:"linear-gradient(135deg,#fef2f2,#fff1f2)",border:"1px solid #fca5a5",padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14}}>🩺</span>
                  <span style={{fontSize:11,fontWeight:900,color:"#991b1b",letterSpacing:0.5,textTransform:"uppercase" as const,flex:1}}>Персональная диагностика · {dna.total} партий</span>
                  <span style={{fontSize:10,color:"#6b7280",fontWeight:700}}>WR {dna.winPct}%</span>
                </div>
                {/* Quick stats grid */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:4,fontSize:10}}>
                  <div style={{textAlign:"center",padding:"5px 4px",background:"#fff",borderRadius:5}}>
                    <div style={{fontWeight:900,color:CC.brand,fontSize:14}}>{dna.wins}</div>
                    <div style={{color:CC.textDim,letterSpacing:0.3}}>побед</div>
                  </div>
                  <div style={{textAlign:"center",padding:"5px 4px",background:"#fff",borderRadius:5}}>
                    <div style={{fontWeight:900,color:CC.danger,fontSize:14}}>{dna.losses}</div>
                    <div style={{color:CC.textDim,letterSpacing:0.3}}>пораж.</div>
                  </div>
                  <div style={{textAlign:"center",padding:"5px 4px",background:"#fff",borderRadius:5}}>
                    <div style={{fontWeight:900,color:CC.text,fontSize:14}}>{dna.avgLengthWin}</div>
                    <div style={{color:CC.textDim,letterSpacing:0.3}}>avg ходов</div>
                  </div>
                  <div style={{textAlign:"center",padding:"5px 4px",background:"#fff",borderRadius:5}}>
                    <div style={{fontWeight:900,color:dna.ratingGrowth>=0?CC.brand:CC.danger,fontSize:14}}>{dna.ratingGrowth>=0?"+":""}{dna.ratingGrowth}</div>
                    <div style={{color:CC.textDim,letterSpacing:0.3}}>ELO Δ</div>
                  </div>
                </div>
                {/* Insights / flags */}
                {flags.length>0?<div style={{display:"flex",flexDirection:"column",gap:4}}>
                  {flags.slice(0,5).map((f,i)=><div key={i} style={{
                    padding:"6px 10px",borderRadius:6,
                    background:f.tone==="good"?"rgba(16,185,129,0.10)":f.tone==="warn"?"rgba(220,38,38,0.06)":"rgba(59,130,246,0.06)",
                    border:`1px solid ${f.tone==="good"?"rgba(16,185,129,0.3)":f.tone==="warn"?"rgba(220,38,38,0.25)":"rgba(59,130,246,0.25)"}`,
                    fontSize:11,lineHeight:1.5
                  }}>
                    <div style={{fontWeight:900,color:f.tone==="good"?"#065f46":f.tone==="warn"?"#991b1b":"#1e3a8a",marginBottom:1}}>{f.label}</div>
                    <div style={{color:"#475569",fontSize:11}}>{f.detail}</div>
                  </div>)}
                </div>:<div style={{fontSize:11,color:"#6b7280",fontStyle:"italic",lineHeight:1.5}}>
                  Слабостей не найдено — продолжай играть стабильно.
                </div>}
                {dna.insights.length>0&&<div style={{fontSize:10,color:"#6b7280",lineHeight:1.5,paddingTop:4,borderTop:"1px dashed rgba(220,38,38,0.2)"}}>
                  💡 Дополнительно: {dna.insights.slice(0,2).join(" · ")}
                </div>}
              </div>;
            })()}
            {/* ── Blunder Book ── Personal collection of positions where user blundered */}
            {blunderBook.length>0&&<div style={{borderRadius:10,background:"linear-gradient(135deg,#fef2f2,#fff1f2)",border:"1px solid #fca5a5",padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:14}}>📕</span>
                <span style={{fontSize:11,fontWeight:900,color:"#991b1b",letterSpacing:0.5,textTransform:"uppercase" as const,flex:1}}>Блундер-бук · {blunderBook.length} позиций</span>
                <button onClick={()=>sBlunderBook([])} title="Очистить" style={{fontSize:10,fontWeight:700,color:"#6b7280",border:"1px solid #fca5a5",borderRadius:4,padding:"2px 6px",background:"#fff",cursor:"pointer"}}>× очистить</button>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {blunderBook.slice(0,5).map((b,i)=>(
                  <button key={i} onClick={()=>{
                    try{const g=new Chess(b.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([b.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");sOn(true);sSetup(false);
                      showToast(`Позиция загружена — найди лучший ход вместо ${b.san}!`,"info");
                    }catch{showToast("Ошибка загрузки позиции","error")}}
                  } style={{
                    padding:"6px 10px",borderRadius:6,border:"1px solid #fca5a5",background:"#fff",
                    cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:8
                  }}>
                    <span style={{fontSize:16,flexShrink:0}}>💀</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:"#991b1b"}}>
                        Ход {b.moveNum}: {b.san} ??{b.opening?` · ${b.opening.slice(0,25)}`:""}
                      </div>
                      <div style={{fontSize:9,color:"#6b7280",fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {b.fen.slice(0,40)}…
                      </div>
                    </div>
                    <span style={{fontSize:10,color:"#991b1b",fontWeight:700,flexShrink:0}}>→</span>
                  </button>
                ))}
              </div>
              {blunderBook.length>5&&<div style={{fontSize:10,color:"#991b1b",marginTop:4,textAlign:"center"}}>+{blunderBook.length-5} ещё позиций</div>}
            </div>}

            {/* ── Study Plan — weekly recommendation based on weaknesses + themePerf ── */}
            {savedGames.length>=3&&(()=>{
              const dna=gameDna;
              // Build a personalized 7-item weekly plan
              const plan:{day:string;task:string;icon:string;action:()=>void}[]=[];
              // Monday: play a game
              plan.push({day:"Пн",task:"Сыграй партию",icon:"♟",action:()=>{sTab("play");sSetup(true)}});
              // Tuesday: weak theme puzzles if any
              const weakThemes=Object.entries(themePerf).filter(([,v])=>v.c+v.w>=3&&v.c/(v.c+v.w)<0.5).sort((a,b)=>(a[1].c/(a[1].c+a[1].w))-(b[1].c/(b[1].c+b[1].w)));
              if(weakThemes.length>0){
                const wt=weakThemes[0][0];
                plan.push({day:"Вт",task:`Пазлы: ${wt}`,icon:"🎯",action:()=>{sTab("puzzles");sPzFilterTheme(wt);sPzI(0);sPzCategory("all")}});
              }else{
                plan.push({day:"Вт",task:"Реши 10 пазлов",icon:"🎯",action:()=>{sTab("puzzles");sPzMode("learn" as any)}});
              }
              // Wednesday: Coach knowledge reading
              plan.push({day:"Ср",task:"Читай базу знаний",icon:"📚",action:()=>{sShowKnowledge(true)}});
              // Thursday: analysis of last game
              if(savedGames.length>0)plan.push({day:"Чт",task:"Разбери последнюю партию",icon:"🔍",action:()=>{sTab("analysis");const last=savedGames[0];const g=new Chess();const fh=[g.fen()];const mh:string[]=[];for(const s of last.moves){try{const mv=g.move(s);if(mv){mh.push(mv.san);fh.push(g.fen())}}catch{break}}setGame(g);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(last.result);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(last.playerColor);sFlip(last.playerColor==="b")}});
              // Friday: blunder book practice
              if(blunderBook.length>0)plan.push({day:"Пт",task:"Тренируй позиции из блундер-бука",icon:"📕",action:()=>{const b=blunderBook[0];try{const g=new Chess(b.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([b.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");sOn(true);sSetup(false);}catch{}}});
              else plan.push({day:"Пт",task:"Puzzle Rush 3 мин",icon:"⚡",action:()=>{sTab("puzzles");sPzMode("rush" as any)}});
              // Saturday: variant game
              plan.push({day:"Сб",task:"Играй вариант",icon:"🎲",action:()=>{sTab("play");sShowVariants(true)}});
              // Sunday: rest or openings
              plan.push({day:"Вс",task:"Изучи дебютный репертуар",icon:"📖",action:()=>{sTab("coach")}});
              const todayDay=new Date().getDay(); // 0=Sun,1=Mon...
              const dayMap=[6,0,1,2,3,4,5]; // JS 0=Sun → plan[6]
              const todayPlanIdx=dayMap[todayDay];
              return <div style={{borderRadius:10,background:"linear-gradient(135deg,#f0f9ff,#dbeafe)",border:"1px solid #93c5fd",padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                  <span style={{fontSize:14}}>📅</span>
                  <span style={{fontSize:11,fontWeight:900,color:"#1e40af",letterSpacing:0.5,textTransform:"uppercase" as const}}>Недельный план · на основе анализа игры</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
                  {plan.slice(0,7).map((p,i)=>{
                    const isToday=i===todayPlanIdx;
                    return <button key={p.day} onClick={p.action} style={{
                      padding:"5px 3px",borderRadius:6,border:isToday?`2px solid #3b82f6`:"1px solid #bfdbfe",
                      background:isToday?"linear-gradient(135deg,#dbeafe,#bfdbfe)":"#f0f9ff",
                      cursor:"pointer",textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:2
                    }}>
                      <span style={{fontSize:10,fontWeight:900,color:isToday?"#1e40af":"#93c5fd"}}>{p.day}</span>
                      <span style={{fontSize:14,lineHeight:1}}>{p.icon}</span>
                      <span style={{fontSize:9,color:isToday?"#1e3a8a":"#3b82f6",fontWeight:700,lineHeight:1.2}}>{p.task.slice(0,10)}</span>
                    </button>;
                  })}
                </div>
                {plan[todayPlanIdx]&&<div style={{marginTop:6,fontSize:11,color:"#1e40af",fontWeight:700}}>
                  📌 Сегодня: <span onClick={plan[todayPlanIdx].action} style={{cursor:"pointer",textDecoration:"underline"}}>{plan[todayPlanIdx].task}</span>
                </div>}
              </div>;
            })()}

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

                <button onClick={()=>sShowKnowledge(true)} style={{padding:"8px 10px",borderRadius:7,border:`1px solid #a7f3d0`,background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",fontSize:12,fontWeight:700,cursor:"pointer",color:"#065f46",textAlign:"left"}}>📚 База знаний</button>
                <button onClick={()=>sShowLessons(true)} style={{padding:"8px 10px",borderRadius:7,border:`1px solid #93c5fd`,background:"linear-gradient(135deg,#eff6ff,#dbeafe)",fontSize:12,fontWeight:700,cursor:"pointer",color:"#1e3a8a",textAlign:"left"}}>📖 Курс (14 уроков)</button>
                <button onClick={()=>{sShowFlashcards(true);sFlashcardIdx(0);sFlashcardFlipped(false)}} style={{padding:"8px 10px",borderRadius:7,border:`1px solid #fde68a`,background:"linear-gradient(135deg,#fefce8,#fef9c3)",fontSize:12,fontWeight:700,cursor:"pointer",color:"#92400e",textAlign:"left"}}>🃏 Флеш-карточки</button>
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

          {tab==="coach"&&!editorMode&&(()=>{
            const detail=detectPhase(game.fen(),hist.length);
            const phaseSym=detail.phase==="opening"?SYM.play:detail.phase==="endgame"?SYM.endgame:SYM.coach;
            const tips=PHASE_TIPS[detail.phase];
            return <div style={{borderRadius:RADIUS.lg,background:`linear-gradient(135deg,#fff,${phaseSym.bg})`,border:`1px solid ${phaseSym.color}33`,padding:SPACE[3],marginBottom:SPACE[3],boxShadow:SHADOW.sm}}>
              <div style={{display:"flex",alignItems:"center",gap:SPACE[2],marginBottom:SPACE[2]}}>
                <span style={{width:36,height:36,borderRadius:"50%",background:phaseSym.gradient,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:`0 4px 12px ${phaseSym.ring}`,flexShrink:0}}>
                  <phaseSym.icon size={20} color="#fff"/>
                </span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase" as const,color:phaseSym.color}}>Фаза партии</div>
                  <div style={{fontSize:16,fontWeight:900,color:CC.text,lineHeight:1.2}}>{detail.label}</div>
                  <div style={{fontSize:11,color:CC.textDim,marginTop:1}}>{detail.reason}</div>
                </div>
              </div>
              <div style={{fontSize:12,color:CC.text,lineHeight:1.55,marginBottom:SPACE[2]}}>{tips.intro}</div>
              <details style={{borderTop:`1px dashed ${phaseSym.color}33`,paddingTop:SPACE[2]}}>
                <summary style={{cursor:"pointer",fontSize:11,fontWeight:800,color:phaseSym.color,letterSpacing:0.3,outline:"none",listStyle:"none"}}>
                  ▾ Принципы для этой стадии ({tips.tips.length})
                </summary>
                <div style={{marginTop:SPACE[2],display:"flex",flexDirection:"column",gap:SPACE[2]}}>
                  {tips.tips.map((t,i)=><div key={i} style={{display:"flex",gap:SPACE[2]}}>
                    <span style={{
                      flexShrink:0,width:22,height:22,borderRadius:"50%",
                      background:t.priority===1?phaseSym.gradient:t.priority===2?phaseSym.bg:CC.surface3,
                      color:t.priority===1?"#fff":phaseSym.color,
                      display:"inline-flex",alignItems:"center",justifyContent:"center",
                      fontSize:10,fontWeight:900,
                    }}>{i+1}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:CC.text,lineHeight:1.3}}>{t.title}</div>
                      <div style={{fontSize:11,color:CC.textDim,lineHeight:1.5,marginTop:1}}>{t.body}</div>
                    </div>
                  </div>)}
                </div>
              </details>
            </div>;
          })()}

          {tab==="coach"&&!editorMode&&coachAIEnabled&&<AiCoach
            fen={game.fen()}
            moves={hist}
            fenHist={fenHist}
            evalCp={evalCp}
            evalMate={evalMate}
            opening={currentOpening}
            playerColor={pCol}
            phaseLabel={detectPhase(game.fen(),hist.length).label}
            visible={true}
            onClose={()=>sTab("play")}
            runEngine={runEnginePromise}
            quickEval={quickEvalPromise}
          />}

          <CoachKnowledge
            visible={showKnowledge}
            onClose={()=>sShowKnowledge(false)}
            onLoadPosition={(fen:string,hint?:string)=>{
              try{
                const g=new Chess(fen);
                setGame(g);sBk(k=>k+1);sHist([]);sFenHist([fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol(g.turn());sFlip(g.turn()==="b");
                sShowKnowledge(false);
                if(hint)showToast(hint,"info");
                else showToast("Позиция загружена","success");
              }catch{showToast("Неверная позиция","error")}
            }}
          />

          {showFlashcards&&(()=>{const cards=COACH_KNOWLEDGE.flatMap(c=>c.entries.filter(e=>!!e.bestMove&&!!e.fen).map(e=>({t:e.title,f:e.fen!,b:e.bestMove!,ex:typeof e.explanation==="string"?e.explanation.slice(0,180):String(e.explanation).slice(0,180),cat:c.title})));if(!cards.length)return null;const card=cards[flashcardIdx%cards.length];return<div onClick={()=>sShowFlashcards(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:220,padding:16}}><div onClick={e=>e.stopPropagation()} style={{background:"linear-gradient(135deg,#0f172a,#1e1b4b)",color:"#fff",borderRadius:16,maxWidth:460,width:"100%",padding:"24px",border:"1px solid rgba(167,139,250,0.3)",boxShadow:"0 24px 64px rgba(0,0,0,0.5)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}><span>🃏</span><span style={{fontSize:11,fontWeight:900,letterSpacing:1,color:"#a78bfa",textTransform:"uppercase" as const}}>Флеш-карточки</span><span style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{(flashcardIdx%cards.length)+1}/{cards.length}</span><button onClick={()=>sShowFlashcards(false)} style={{padding:"2px 7px",borderRadius:4,border:"1px solid rgba(255,255,255,0.15)",background:"transparent",color:"#94a3b8",fontSize:11,cursor:"pointer"}}>✕</button></div>
            <div style={{textAlign:"center",marginBottom:12}}><div style={{fontSize:16,fontWeight:900,color:"#f1f5f9",marginBottom:4}}>{card.t}</div><div style={{fontSize:11,color:"#a78bfa",padding:"1px 8px",borderRadius:999,background:"rgba(124,58,237,0.15)",display:"inline-block"}}>{card.cat}</div></div>
            <button onClick={()=>sFlashcardFlipped(v=>!v)} style={{width:"100%",padding:"12px",borderRadius:10,border:"1px solid rgba(167,139,250,0.4)",background:flashcardFlipped?"rgba(124,58,237,0.18)":"transparent",color:"#e9d5ff",fontSize:13,fontWeight:800,cursor:"pointer",marginBottom:10}}>{flashcardFlipped?`✓ Ход: ${card.b}`:"👁 Показать ответ"}</button>
            {flashcardFlipped&&<div style={{fontSize:11,color:"#cbd5e1",lineHeight:1.55,padding:"8px 12px",background:"rgba(255,255,255,0.05)",borderRadius:8,marginBottom:12}}>{card.ex}</div>}
            <div style={{display:"flex",gap:8}}><button onClick={()=>{sFlashcardIdx(i=>(i-1+cards.length)%cards.length);sFlashcardFlipped(false)}} style={{flex:1,padding:"9px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>← Назад</button><button onClick={()=>{sFlashcardIdx(i=>(i+1)%cards.length);sFlashcardFlipped(false)}} style={{flex:2,padding:"9px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>Следующая →</button></div>
          </div></div>;})()}

          <CoachLessonsModal
            open={showLessons}
            onClose={()=>sShowLessons(false)}
            onLoadPosition={(fen:string,hint?:string,meta?:any)=>{
              try{
                const g=new Chess(fen);
                setGame(g);sBk(k=>k+1);sHist([]);sFenHist([fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sPCol(g.turn());sFlip(g.turn()==="b");
                sShowLessons(false);sTab("coach");
                if(meta)sActiveLesson({id:meta.lessonId,step:meta.stepIdx,title:meta.lessonTitle,emoji:meta.lessonEmoji});
                if(hint)showToast(hint,"info");
                else showToast("Позиция загружена","success");
              }catch{showToast("Неверная позиция","error")}
            }}
          />

          {tab==="play"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
            {[{v:sts.w,l:"W",c:T.accent},{v:sts.l,l:"L",c:T.danger},{v:sts.d,l:"D",c:T.dim}].map(s=><div key={s.l} style={{padding:"8px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:13,color:T.dim}}>{s.l}</div></div>)}
          </div>}
        </div>}
      </div>}

      {promo&&<div className="cc-backdrop" style={{display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>sPromo(null)}>
        <div className="cc-modal-shell" style={{
          background:"linear-gradient(180deg, #ffffff, #fafbfd)",
          borderRadius:RADIUS.xl,padding:`${SPACE[4]}px ${SPACE[5]}px`,
          border:`1px solid ${CC.border}`,
          boxShadow:SHADOW.xl,
          maxWidth:380
        }} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:11,fontWeight:900,color:CC.brand,letterSpacing:1.5,textTransform:"uppercase" as const,textAlign:"center",marginBottom:SPACE[1]}}>Promotion · {promo.to.toUpperCase()}</div>
          <div style={{fontSize:18,fontWeight:900,color:CC.text,textAlign:"center",marginBottom:SPACE[3]}}>В какую фигуру?</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:SPACE[2]}}>
            {(["q","r","b","n"] as const).map(pt=>{
              const labels:Record<string,string>={q:"Ферзь",r:"Ладья",b:"Слон",n:"Конь"};
              const hot:Record<string,string>={q:"Q",r:"R",b:"B",n:"N"};
              return <button key={pt} onClick={()=>{exec(promo.from,promo.to,pt);sPromo(null)}} className="cc-focus-ring"
                style={{
                  display:"flex",flexDirection:"column",alignItems:"center",gap:4,
                  padding:`${SPACE[2]}px ${SPACE[1]}px`,
                  borderRadius:RADIUS.md,
                  border:`2px solid ${CC.border}`,
                  background:`linear-gradient(135deg, ${pt==="q"?"#fef3c7":CC.surface1}, ${pt==="q"?"#fde68a":CC.surface2})`,
                  cursor:"pointer",
                  transition:`all ${MOTION.fast} ${MOTION.ease}`,
                  position:"relative"
                }}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor=CC.brand;el.style.transform="translateY(-3px)";el.style.boxShadow="0 6px 16px rgba(5,150,105,0.25)"}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.borderColor=CC.border;el.style.transform="";el.style.boxShadow="none"}}>
                <div style={{width:54,height:54,display:"flex",alignItems:"center",justifyContent:"center"}}><Piece type={pt} color={pCol}/></div>
                <span style={{fontSize:11,fontWeight:800,color:CC.text}}>{labels[pt]}</span>
                <span style={{position:"absolute",top:4,right:6,fontSize:9,fontWeight:900,color:CC.textDim,fontFamily:"ui-monospace,monospace"}}>{hot[pt]}</span>
              </button>;
            })}
          </div>
          <div style={{marginTop:SPACE[3],fontSize:11,color:CC.textDim,textAlign:"center"}}>Клик мимо — отмена</div>
        </div>
      </div>}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes diceRoll{0%{transform:rotate(0) scale(0.5);opacity:0.3}50%{transform:rotate(180deg) scale(1.15)}100%{transform:rotate(360deg) scale(1);opacity:1}}@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}@keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}@keyframes pop{0%{transform:scale(0.85);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes sf-depth-pulse{0%{opacity:0.45;transform:scale(0.96)}50%{opacity:1;transform:scale(1.04)}100%{opacity:0.85;transform:scale(1)}}@keyframes pip-suggest-pulse{0%,100%{box-shadow:0 0 0 0 rgba(168,85,247,0.6)}50%{box-shadow:0 0 0 8px rgba(168,85,247,0)}}`}</style>
    {/* Games History Modal */}
    {gamesModalOpen&&(()=>{
      // Library v2 — full search/sort/filter/PGN export/delete.
      const isWinG=(g:SavedGame)=>g.result.includes("You win")||g.result.includes("win!");
      const isLossG=(g:SavedGame)=>g.result.includes("AI wins")||g.result.includes("resigned");
      const isDrawG=(g:SavedGame)=>g.result.includes("Draw")||g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
      const byCategory=(cat:string)=>savedGames.filter(g=>cat==="all"||g.category===cat);
      const categoryFilter=gamesFilter;
      const sCategoryFilter=sGamesFilter;
      // Apply: category → result → search → sort
      const q=gamesSearch.trim().toLowerCase();
      const filteredRaw=byCategory(categoryFilter)
        .filter(g=>{
          if(gamesResult==="win"&&!isWinG(g))return false;
          if(gamesResult==="loss"&&!isLossG(g))return false;
          if(gamesResult==="draw"&&!isDrawG(g))return false;
          if(q){
            const hay=`${g.opening||""} ${g.aiLevel} ${g.result} ${g.tc} ${g.category}`.toLowerCase();
            if(!hay.includes(q))return false;
          }
          return true;
        });
      const filtered=[...filteredRaw].sort((a,b)=>{
        if(gamesSort==="date")return new Date(b.date).getTime()-new Date(a.date).getTime();
        if(gamesSort==="rating")return b.rating-a.rating;
        if(gamesSort==="length")return b.moves.length-a.moves.length;
        if(gamesSort==="result"){const ra=isWinG(a)?2:isDrawG(a)?1:0;const rb=isWinG(b)?2:isDrawG(b)?1:0;return rb-ra}
        return 0;
      });
      const ratingHistory=[...savedGames].reverse().map((g,i)=>({x:i,y:g.rating}));
      const minR=ratingHistory.length>0?Math.min(...ratingHistory.map(p=>p.y),rat)-50:rat-50;
      const maxR=ratingHistory.length>0?Math.max(...ratingHistory.map(p=>p.y),rat)+50:rat+50;
      const range=Math.max(100,maxR-minR);
      const catStats=(cat:string)=>{
        const games=byCategory(cat);
        const wins=games.filter(isWinG).length;
        const losses=games.filter(isLossG).length;
        const draws=games.length-wins-losses;
        return{total:games.length,wins,losses,draws};
      };
      // Bulk PGN export — concatenate all filtered games as a multi-PGN .pgn file
      const exportPGN=()=>{
        if(filtered.length===0){showToast("Нет партий для экспорта","error");return}
        const today=new Date().toISOString().slice(0,10);
        const blocks=filtered.map((g,i)=>{
          const white=g.playerColor==="w"?"You":g.aiLevel;
          const black=g.playerColor==="b"?"You":g.aiLevel;
          const result=isWinG(g)?(g.playerColor==="w"?"1-0":"0-1"):isLossG(g)?(g.playerColor==="w"?"0-1":"1-0"):"1/2-1/2";
          const date=new Date(g.date).toISOString().slice(0,10).replace(/-/g,".");
          return buildPGN(g.moves,{white,black,result,date,event:`AEVION CyberChess · ${g.category} · ${g.opening||""}`});
        });
        const blob=new Blob([blocks.join("\n\n")],{type:"application/x-chess-pgn"});
        downloadFile(blob,`aevion-chess-library-${today}-${filtered.length}games.pgn`);
        showToast(`📦 ${filtered.length} партий → PGN`,"success");
      };
      const deleteOne=(id:string)=>{
        if(!confirm("Удалить эту партию из библиотеки?"))return;
        const next=savedGames.filter(g=>g.id!==id);
        try{localStorage.setItem(GK,JSON.stringify(next))}catch{}
        sSavedGames(next);
        showToast("Партия удалена","info");
      };
      const deleteAll=()=>{
        if(savedGames.length===0)return;
        if(!confirm(`Удалить ВСЕ ${savedGames.length} партий? Это нельзя отменить.`))return;
        try{localStorage.setItem(GK,"[]")}catch{}
        sSavedGames([]);
        showToast("Библиотека очищена","info");
      };
      const ICON_RES:Record<"win"|"loss"|"draw"|"all",string>={all:"🎯",win:"🏆",loss:"💔",draw:"½"};
      return<Modal open={gamesModalOpen} onClose={()=>sGamesModalOpen(false)} size="xl"
        title={<span>📚 Библиотека партий <span style={{fontSize:13,color:CC.textDim,fontWeight:600,marginLeft:8}}>{savedGames.length} всего · {rat} ELO · показано {filtered.length}</span></span>}>

        {/* Rating progression chart */}
        {ratingHistory.length>1&&<div style={{background:"#0f172a",borderRadius:RADIUS.md,padding:`${SPACE[3]}px ${SPACE[4]}px`,marginBottom:SPACE[3],border:"1px solid #334155"}}>
          <div style={{fontSize:11,fontWeight:800,color:"#94a3b8",letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2],display:"flex",justifyContent:"space-between"}}>
            <span>📈 Прогресс рейтинга · {ratingHistory.length} партий</span>
            <span style={{fontSize:10,color:"#64748b"}}>{minR} — {maxR}</span>
          </div>
          <svg viewBox={`0 0 ${Math.max(100,ratingHistory.length*8)} 80`} preserveAspectRatio="none" style={{width:"100%",height:90,background:"linear-gradient(180deg,#1e293b 0%,#0f172a 100%)",borderRadius:6}}>
            <line x1="0" y1="40" x2={ratingHistory.length*8} y2="40" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2"/>
            <polyline fill="none" stroke="#7c3aed" strokeWidth="1.8" points={ratingHistory.map(p=>`${p.x*8},${80-((p.y-minR)/range)*80}`).join(" ")}/>
            {ratingHistory.map(p=><circle key={p.x} cx={p.x*8} cy={80-((p.y-minR)/range)*80} r="1.8" fill="#a78bfa"/>)}
          </svg>
        </div>}

        {/* Category strip */}
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

        {/* Search + filter row */}
        <div style={{display:"flex",gap:SPACE[2],marginBottom:SPACE[2],flexWrap:"wrap",alignItems:"center"}}>
          <input value={gamesSearch} onChange={e=>sGamesSearch(e.target.value)}
            placeholder="🔎 Поиск по дебюту, AI-уровню, результату…"
            style={{flex:"2 1 220px",minWidth:200,padding:"8px 12px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:13,background:CC.surface1,color:CC.text,outline:"none"}}/>
          <select value={gamesSort} onChange={e=>sGamesSort(e.target.value as any)}
            style={{padding:"8px 10px",borderRadius:RADIUS.md,border:`1px solid ${CC.border}`,fontSize:12,fontWeight:700,background:CC.surface1,color:CC.text,cursor:"pointer"}}>
            <option value="date">📅 Сначала новые</option>
            <option value="rating">⭐ По рейтингу</option>
            <option value="length">📏 По длине партии</option>
            <option value="result">🏆 По результату</option>
          </select>
          <div style={{display:"flex",gap:4}}>
            {(["all","win","loss","draw"] as const).map(r=>{
              const a=gamesResult===r;
              const lbl=r==="all"?"Все":r==="win"?"Победы":r==="loss"?"Пораж.":"Ничьи";
              return <button key={r} onClick={()=>sGamesResult(r)} className="cc-focus-ring"
                style={{padding:"7px 11px",borderRadius:RADIUS.md,border:a?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                  background:a?CC.brandSoft:CC.surface1,color:a?CC.brand:CC.textDim,fontSize:11,fontWeight:800,cursor:"pointer"}}>
                {ICON_RES[r]} {lbl}
              </button>;
            })}
          </div>
          <div style={{flex:1}}/>
          <Btn size="sm" variant="secondary" onClick={exportPGN} disabled={filtered.length===0}>📦 PGN ({filtered.length})</Btn>
          {savedGames.length>0&&<Btn size="sm" variant="danger" onClick={deleteAll}>🗑 Очистить всё</Btn>}
        </div>

        {/* Games list */}
        <div style={{border:`1px solid ${CC.border}`,borderRadius:RADIUS.md,overflow:"hidden",maxHeight:440,overflowY:"auto"}}>
          {filtered.length===0?<div style={{padding:40,textAlign:"center",color:CC.textDim,fontSize:14}}>
            {savedGames.length===0?"Сыграй хотя бы одну партию — она появится здесь":"Ничего не найдено по этим фильтрам"}
          </div>:
          filtered.map(g=>{
            const isWin=isWinG(g);const isDraw=isDrawG(g);
            const resCol=isWin?CC.brand:isDraw?CC.textDim:CC.danger;
            const date=new Date(g.date);
            return<div key={g.id} className="cc-focus-ring"
              style={{display:"flex",alignItems:"stretch",borderBottom:`1px solid ${CC.border}`,background:CC.surface1,
                transition:`background ${MOTION.fast} ${MOTION.ease}`}}
              onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background=CC.surface2}
              onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background=CC.surface1}>
              <button onClick={()=>{
                sGamesModalOpen(false);
                const destTab=tab==="coach"?"coach":"analysis";
                sTab(destTab);
                const ch=new Chess();const fh:string[]=[ch.fen()];const mh:string[]=[];
                for(const san of g.moves){try{const mv=ch.move(san);if(mv){mh.push(mv.san);fh.push(ch.fen())}}catch{break}}
                setGame(ch);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(g.result);sOn(false);sSetup(false);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.playerColor);sFlip(g.playerColor==="b");
                if(destTab==="coach"){sCoachAIEnabled(false);sEditorMode(false);}
                showToast(`Партия открыта · ${mh.length} ходов${destTab==="coach"?" · Coach готов к разбору":""}`,"success");
              }} style={{flex:1,padding:`${SPACE[3]}px ${SPACE[4]}px`,border:"none",background:"transparent",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",borderLeft:`3px solid ${resCol}`}}>
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
              </button>
              <button onClick={e=>{e.stopPropagation();deleteOne(g.id)}} title="Удалить партию"
                style={{padding:"0 14px",border:"none",borderLeft:`1px solid ${CC.border}`,background:"transparent",
                  color:CC.textDim,fontSize:14,cursor:"pointer",fontWeight:700}}
                onMouseEnter={e=>{(e.currentTarget as HTMLButtonElement).style.color=CC.danger;(e.currentTarget as HTMLButtonElement).style.background="rgba(220,38,38,0.06)"}}
                onMouseLeave={e=>{(e.currentTarget as HTMLButtonElement).style.color=CC.textDim;(e.currentTarget as HTMLButtonElement).style.background="transparent"}}>
                🗑
              </button>
            </div>;
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
        {id:"hint_ghost",name:isPro?"Ghost-подсказка ✨":"Ghost-подсказка",desc:isPro?"Pro: бесплатные подсказки. На 3 секунды увидишь лучший ход на доске.":"На 3 секунды увидишь лучший ход прямо на доске (разовое использование в текущей партии)",cost:isPro?0:15,kind:"action",disabled:!on||!!over,onBuy:()=>{
          if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
          sShowShop(false);
          showToast("🧠 Считаю подсказку...","info");
          sfR.current.go(game.fen(),12,(f,t)=>{
            if(!f||!t){showToast("Не нашёл хода","error");return}
            sArrows([{from:f as Square,to:t as Square,c:"#22c55e"}]);
            setTimeout(()=>sArrows(a=>a.filter(x=>!(x.from===f&&x.to===t))),3000);
          });
        }},
        {id:"deep_review",name:isPro?"Глубокий разбор ✨":"Глубокий разбор партии",desc:isPro?"Pro: бесплатно. Coach пройдёт по всем ходам и выдаст план на будущее.":"Coach пройдёт по всем ходам и выдаст план на будущее",cost:isPro?0:20,kind:"action",disabled:hist.length<4,onBuy:()=>{sTab("coach");sShowShop(false);showToast("Открой Coach — разбор готов","info")}},
        // New shop items
        {id:"theme_wood",name:"Тема Wood 🪵",desc:"Тёплая деревянная доска",cost:40,kind:"unlock"},
        {id:"theme_ice",name:"Тема Ice ❄️",desc:"Холодный ледяной стиль",cost:40,kind:"unlock"},
        {id:"theme_rose",name:"Тема Rose 🌹",desc:"Розовая романтика",cost:40,kind:"unlock"},
        {id:"theme_dark",name:"Тема Dark 🌑",desc:"Тёмный минималистичный",cost:35,kind:"unlock"},
        {id:"streak_shield",name:"Щит стрика 🛡",desc:"Защита от сброса стрика пазлов один раз",cost:25,kind:"action",onBuy:()=>{
          sChessy(c=>({...c,owned:{...c.owned,streak_shield:true}}));sShowShop(false);showToast("🛡 Щит стрика активирован!","success");
        }},
        {id:"puzzle_boost",name:"Пазл-буст ⚡",desc:"Следующие 10 пазлов с двойным Chessy-бонусом",cost:30,kind:"action",onBuy:()=>{
          sChessy(c=>({...c,owned:{...c.owned,puzzle_boost:true}}));sShowShop(false);showToast("⚡ Пазл-буст активирован на 10 пазлов!","success");
        }},
      ];
      const purchaseUnlock=(id:string,cost:number,name:string)=>{
        if(chessy.owned[id]){showToast("Уже куплено","info");return}
        if(!spendChessy(cost,`покупка: ${name}`))return;
        sChessy(c=>({...c,owned:{...c.owned,[id]:true}}));
        showToast(`✓ Куплено: ${name}`,"success");
      };
      return <Modal open={showShop} onClose={()=>sShowShop(false)} size="lg"
        title={<span>🛒 Chessy · магазин <Badge tone="gold" size="md" style={{marginLeft:8}}><Icon.Coin width={12} height={12}/> {chessy.balance}</Badge></span>}>

        {/* ─── AEVION Pro / monetization tier card ─── three-tier ladder shown above the
            Chessy spend grid. Free is current default; Pro and Ultimate are gated.
            For now both paid tiers route to AEVION Bank for an entrance ticket via AEV;
            real billing wires up next session. */}
        <div style={{borderRadius:RADIUS.lg,padding:`${SPACE[3]}px ${SPACE[4]}px`,marginBottom:SPACE[4],
          background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)",color:"#fff",
          border:"1px solid #312e81",boxShadow:"0 6px 22px rgba(15,23,42,0.18)"}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase" as const,color:"#a78bfa",marginBottom:SPACE[1]}}>🎟 Билет в AEVION CyberChess</div>
          <div style={{fontSize:18,fontWeight:900,color:"#fff",marginBottom:SPACE[3]}}>Открой полный доступ к платформе</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:SPACE[2]}}>
            {[
              {id:"free",name:"Free",price:"0",sub:"навсегда",
                features:["Игра против AI до 2000 ELO","Все 12 вариантов шахмат","3418 пазлов с фильтрами","Coach knowledge база","P2P партии с другом","Library + PGN-экспорт"],
                cta:"Текущий тариф",disabled:true},
              {id:"pro",name:"Pro",price:"500",sub:"AEV / месяц",accent:true,
                features:["Всё из Free","Master AI до 2800 ELO","Безлимитные подсказки","Глубокий разбор каждой партии","Дебютная теория из мастер-партий","Multi-PV анализ до 5 линий","🎬 Auto-Reels без водяного знака"],
                cta:"Купить через AEV"},
              {id:"ultimate",name:"Ultimate",price:"5000",sub:"AEV / lifetime",
                features:["Всё из Pro","Кастомные AI-личности (Magnus, Hikaru…)","Персональный AI-коуч с памятью","Турниры с призами в AEV","Раннее тестирование новых вариантов","API-доступ к engine","Приоритетная поддержка"],
                cta:"Купить через AEV"}
            ].map(t=>{
              const isPro=t.id==="pro";const isUlt=t.id==="ultimate";
              const owned=t.id!=="free"&&!!chessy.owned[t.id];
              const eitherOwned=!!chessy.owned.pro||!!chessy.owned.ultimate;
              return <div key={t.id} style={{
                background:owned?"linear-gradient(135deg,rgba(16,185,129,0.22),rgba(52,211,153,0.10))":isPro?"linear-gradient(135deg,rgba(124,58,237,0.18),rgba(167,139,250,0.10))":isUlt?"linear-gradient(135deg,rgba(217,119,6,0.18),rgba(252,211,77,0.10))":"rgba(255,255,255,0.04)",
                border:`1px solid ${owned?"rgba(52,211,153,0.55)":isPro?"rgba(167,139,250,0.45)":isUlt?"rgba(252,211,77,0.45)":"rgba(148,163,184,0.25)"}`,
                borderRadius:RADIUS.md,padding:`${SPACE[3]}px ${SPACE[4]}px`,
                position:"relative",
                ...(t.accent&&!owned?{transform:"scale(1.02)",boxShadow:"0 4px 16px rgba(167,139,250,0.25)"}:{})
              }}>
                {owned&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
                  background:"linear-gradient(135deg,#10b981,#34d399)",color:"#fff",fontSize:10,fontWeight:900,
                  padding:"2px 10px",borderRadius:RADIUS.full,letterSpacing:1,textTransform:"uppercase" as const,
                  boxShadow:"0 2px 8px rgba(16,185,129,0.4)"}}>✓ активен</div>}
                {!owned&&t.accent&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",
                  background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",fontSize:10,fontWeight:900,
                  padding:"2px 10px",borderRadius:RADIUS.full,letterSpacing:1,textTransform:"uppercase" as const,
                  boxShadow:"0 2px 8px rgba(124,58,237,0.4)"}}>популярный</div>}
                <div style={{fontSize:14,fontWeight:900,color:"#fff",marginBottom:2}}>{t.name}</div>
                <div style={{display:"flex",alignItems:"baseline",gap:6,marginBottom:SPACE[2]}}>
                  <span style={{fontSize:24,fontWeight:900,color:owned?"#34d399":isPro?"#c4b5fd":isUlt?"#fcd34d":"#cbd5e1"}}>{t.price}</span>
                  <span style={{fontSize:11,color:"#94a3b8",fontWeight:700}}>{t.sub}</span>
                </div>
                <ul style={{margin:0,padding:0,listStyle:"none",fontSize:11,lineHeight:1.6,color:"#cbd5e1",marginBottom:SPACE[2]}}>
                  {t.features.map((f,i)=><li key={i} style={{display:"flex",alignItems:"flex-start",gap:5,marginBottom:2}}>
                    <span style={{color:owned?"#34d399":isPro?"#a78bfa":isUlt?"#fcd34d":"#64748b",flexShrink:0,fontWeight:900}}>✓</span>
                    <span>{f}</span>
                  </li>)}
                </ul>
                {/* Free tile is always disabled. Pro/Ultimate: if owned → "Активирован" disabled; if other tier owned → "Сменить" allowed; else → primary buy CTA. */}
                <button disabled={t.disabled||owned}
                  onClick={async()=>{
                    if(t.id==="free")return;
                    if(owned)return;
                    const tier=t.id as ChessyTier;
                    const amountAev=parseInt(t.price,10)||0;
                    // 1) JWT lookup — mirror keys used elsewhere in the app
                    const jwt=(typeof window!=="undefined")
                      ? (window.localStorage.getItem("aevion_auth_token_v1")
                        ?? window.localStorage.getItem("aevion_token")
                        ?? window.localStorage.getItem("aevion_jwt")
                        ?? "")
                      : "";
                    if(!jwt){
                      showToast("Войди в аккаунт чтобы купить","info");
                      sShowShop(false);
                      setTimeout(()=>{try{window.location.href="/auth"}catch{}},600);
                      return;
                    }
                    // 2) Create QPayNet payment request
                    showToast(`💳 Создаю счёт на ${t.name}…`,"info");
                    const r=await createTierPaymentRequest(tier,amountAev,jwt);
                    if(!r.ok){
                      if(r.error==="platform_wallet_not_configured"){
                        showToast("Биллинг не настроен · используй 🧪 Тест-активацию ниже","error");
                      }else if(r.error==="auth_required"){
                        showToast("Сессия истекла — войди заново","error");
                      }else{
                        showToast(`Ошибка биллинга: ${r.error}`,"error");
                      }
                      return;
                    }
                    // 3) Open pay URL + pending modal with "Я оплатил" CTA
                    try{window.open(r.payUrl,"_blank","noopener,noreferrer")}catch{}
                    sShowShop(false);
                    sBillingPending({tier,tierName:t.name,requestId:r.requestId,token:r.token,payUrl:r.payUrl,busy:false});
                  }}
                  style={{
                    width:"100%",padding:"8px 12px",borderRadius:RADIUS.md,
                    border:"none",cursor:(t.disabled||owned)?"default":"pointer",
                    background:owned?"rgba(16,185,129,0.18)":t.disabled?"rgba(148,163,184,0.18)":isPro?"linear-gradient(135deg,#7c3aed,#a78bfa)":isUlt?"linear-gradient(135deg,#d97706,#fcd34d)":"rgba(148,163,184,0.18)",
                    color:owned?"#34d399":t.disabled?"#94a3b8":"#fff",
                    fontSize:12,fontWeight:900,letterSpacing:0.3,
                    boxShadow:(t.disabled||owned)?"none":"0 2px 8px rgba(0,0,0,0.2)"
                  }}>{owned?"✓ Активирован":eitherOwned&&t.id!=="free"?"Сменить тариф":t.cta}</button>
                {/* Dev-only test activator (until real billing wires up). Skipped on Free. */}
                {!owned&&t.id!=="free"&&<button onClick={()=>{
                  if(!confirm(`🧪 Тест-активация ${t.name} (без реальной оплаты)?\n\nВсе premium-фичи разблокируются. Можно отключить через localStorage clear.`))return;
                  sChessy(c=>({...c,owned:{...c.owned,[t.id]:true}}));
                  showToast(`✨ ${t.name} активирован (тест-режим)`,"success");
                }} style={{width:"100%",marginTop:6,padding:"4px 8px",borderRadius:RADIUS.sm,border:"1px dashed rgba(148,163,184,0.4)",background:"transparent",color:"#94a3b8",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:0.3}}>
                  🧪 Тест-активация (без оплаты)
                </button>}
                {owned&&<button onClick={()=>{
                  if(!confirm(`Отключить ${t.name}?`))return;
                  sChessy(c=>{const o={...c.owned};delete o[t.id];return {...c,owned:o}});
                  showToast(`${t.name} отключён`,"info");
                }} style={{width:"100%",marginTop:6,padding:"4px 8px",borderRadius:RADIUS.sm,border:"1px dashed rgba(52,211,153,0.4)",background:"transparent",color:"#34d399",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:0.3}}>
                  Отключить тариф
                </button>}
              </div>;
            })}
          </div>
          <div style={{fontSize:11,color:"#94a3b8",marginTop:SPACE[2],lineHeight:1.5}}>
            💡 AEV — нативный токен AEVION. Можно заработать в QTrade, CyberChess (победы/пазлы), QShield, или купить за фиат через QPayNet.
          </div>
        </div>

        <div style={{fontSize:11,fontWeight:900,letterSpacing:1.2,color:CC.textDim,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>💰 Магазин Chessy · бонусы и расходники</div>
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

    {/* QPayNet billing pending modal (Pro/Ultimate tier purchase) */}
    {billingPending&&(()=>{
      const bp=billingPending;
      return <Modal open={!!billingPending} onClose={()=>{if(!bp.busy)sBillingPending(null)}} size="sm"
        title={<span>💳 Оплата · {bp.tierName}</span>}>
        <div style={{fontSize:13,color:CC.text,lineHeight:1.6,marginBottom:SPACE[3]}}>
          Открыл AEVION Bank в новой вкладке. Заверши оплату и нажми «Я оплатил» — мы проверим
          статус и активируем {bp.tierName} в течение минуты.
        </div>
        <div style={{display:"flex",gap:SPACE[2],flexDirection:"column"}}>
          <Btn variant="primary" size="md" full disabled={bp.busy}
            onClick={async()=>{
              sBillingPending(p=>p?{...p,busy:true}:p);
              showToast("⏳ Проверяю оплату…","info");
              const jwt=(typeof window!=="undefined")
                ? (window.localStorage.getItem("aevion_auth_token_v1")
                  ?? window.localStorage.getItem("aevion_token")
                  ?? window.localStorage.getItem("aevion_jwt")
                  ?? "")
                : "";
              const paid=await pollPaymentRequest(bp.token,jwt,{intervalMs:3000,timeoutMs:60000});
              if(paid){
                sChessy(c=>({...c,owned:{...c.owned,[bp.tier]:true}}));
                showToast(`✨ ${bp.tierName} активирован!`,"success");
                sBillingPending(null);
              }else{
                showToast("Оплата не подтверждена за минуту — попробуй обновить страницу","error");
                sBillingPending(p=>p?{...p,busy:false}:p);
              }
            }}>
            {bp.busy?"⏳ Проверяю…":"✓ Я оплатил"}
          </Btn>
          <Btn variant="secondary" size="sm" full disabled={bp.busy}
            onClick={()=>{try{window.open(bp.payUrl,"_blank","noopener,noreferrer")}catch{}}}>
            ↗ Открыть страницу оплаты снова
          </Btn>
          <Btn variant="ghost" size="sm" full disabled={bp.busy}
            onClick={()=>sBillingPending(null)}>
            Отменить
          </Btn>
        </div>
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

    {/* Daily Login Reward modal */}
    {dailyReward&&<div role="dialog" aria-modal="true"
      style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.65)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:250,padding:16}}
      onClick={()=>sDailyReward(null)}>
      <div onClick={e=>e.stopPropagation()} style={{
        background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)",color:"#fff",
        borderRadius:20,maxWidth:360,width:"100%",padding:"28px 32px",textAlign:"center",
        boxShadow:"0 24px 64px -8px rgba(15,23,42,0.6)",border:"1px solid rgba(167,139,250,0.3)",
      }}>
        <div style={{fontSize:64,lineHeight:1,marginBottom:10}}>
          {dailyReward.isWelcome?"🎉":dailyReward.streak>=14?"🔥":dailyReward.streak>=7?"⭐":dailyReward.streak>=3?"✨":"☀"}
        </div>
        <div style={{fontSize:22,fontWeight:900,marginBottom:4}}>
          {dailyReward.isWelcome?"Добро пожаловать!":dailyReward.streak>=7?"Недельный стрик!":dailyReward.streak>=3?"Отличная серия!":"Ежедневный бонус"}
        </div>
        <div style={{fontSize:15,color:"#cbd5e1",marginBottom:16,lineHeight:1.4}}>
          {dailyReward.isWelcome?"Твой первый визит — начнём вместе":"День "+dailyReward.streak+" подряд — продолжай в том же духе!"}
        </div>
        <div style={{
          display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",
          borderRadius:999,background:"linear-gradient(135deg,#fef3c7,#fde68a)",
          fontSize:24,fontWeight:900,color:"#78350f",
          boxShadow:"0 4px 16px rgba(217,119,6,0.3)",marginBottom:16
        }}>
          <span>🪙</span>
          <span>+{dailyReward.bonus} Chessy</span>
        </div>
        {/* Streak track */}
        {!dailyReward.isWelcome&&<div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:16}}>
          {[1,2,3,4,5,6,7].map(d=><div key={d} style={{
            width:28,height:28,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:900,
            background:d<=dailyReward.streak?"linear-gradient(135deg,#f59e0b,#fcd34d)":"rgba(255,255,255,0.08)",
            color:d<=dailyReward.streak?"#78350f":"rgba(255,255,255,0.3)",
            border:d===dailyReward.streak?"2px solid #fbbf24":"1px solid rgba(255,255,255,0.1)",
          }}>{d<=dailyReward.streak?"✓":d}</div>)}
        </div>}
        <div style={{fontSize:11,color:"#94a3b8",marginBottom:16}}>
          {dailyReward.streak>=14?"Следующий бонус: +200 (14 дней)":dailyReward.streak>=7?"Следующий рубеж: 14 дней → +200":dailyReward.streak>=3?"Следующий рубеж: 7 дней → +100":"Следующий рубеж: 3 дня → +30"}
        </div>
        <button onClick={()=>sDailyReward(null)} style={{
          width:"100%",padding:"12px 20px",borderRadius:12,border:"none",
          background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",
          fontSize:16,fontWeight:900,cursor:"pointer",letterSpacing:0.5,
          boxShadow:"0 4px 14px rgba(124,58,237,0.4)",
        }}>▶ Начать</button>
      </div>
    </div>}

    {/* Floating PiP — YouTube/Twitch стрим поверх доски, перетаскиваемый */}
    {pip.open&&pip.source&&<WorkspacePiP
      initialSource={pip.source}
      onClose={pip.hide}
      showChatPanel={pip.source.kind==="twitch"}
    />}

    {/* PiP UX polish: variant-of-day pulsing stream suggestion.
        Appears once per day in the bottom-right corner when PiP is closed AND
        today's daily variant is unplayed. Two CTAs:
          1) "Включить" → opens a Twitch stream of a relevant GM (Naroditsky default)
          2) "×" → dismiss for the rest of the day (localStorage-keyed by date) */}
    {showPipSuggest&&<div
      role="alert"
      style={{
        position:"fixed",right:20,bottom:20,zIndex:7900,
        display:"flex",alignItems:"center",gap:10,
        padding:"10px 14px",borderRadius:999,
        background:"linear-gradient(135deg,#1e1b4b 0%,#581c87 100%)",color:"#fff",
        boxShadow:"0 8px 24px -4px rgba(168,85,247,0.45), 0 2px 8px rgba(15,23,42,0.4)",
        border:"1px solid rgba(168,85,247,0.5)",
        animation:"pip-suggest-pulse 2s ease-in-out infinite",
        fontSize:13,fontWeight:700,maxWidth:340,
      }}>
      <span style={{fontSize:18,lineHeight:1}}>📺</span>
      <span style={{flex:1}}>Включи стрим от GM Naroditsky к {dailyVariantInfo?.variant?`варианту дня (${dailyVariantInfo.variant})`:"варианту дня"}?</span>
      <button
        type="button"
        onClick={()=>{
          pip.show({kind:"twitch",url:"gmnaroditsky",title:"GM Naroditsky · вариант дня"});
          dismissPipSuggest();
        }}
        style={{
          background:"#a855f7",color:"#fff",border:"none",
          padding:"5px 11px",borderRadius:999,fontSize:12,fontWeight:800,cursor:"pointer",
          whiteSpace:"nowrap",
        }}
      >Включить</button>
      <button
        type="button"
        aria-label="Скрыть подсказку"
        onClick={dismissPipSuggest}
        style={{
          background:"transparent",color:"rgba(255,255,255,0.6)",border:"none",
          fontSize:18,lineHeight:1,cursor:"pointer",padding:"0 2px",
        }}
      >×</button>
    </div>}

    {/* First-time onboarding — 3-step color/AI/time choice (runs BEFORE the tour) */}
    {showOnboarding&&<OnboardingOverlay
      onComplete={(choice:OnboardingChoice)=>{
        try{localStorage.setItem("aevion_onboarding_choice_v1",JSON.stringify(choice))}catch{}
        markOnboardingDone();
        sShowOnboarding(false);
      }}
      onSkip={()=>{markOnboardingDone();sShowOnboarding(false)}}
    />}

    {/* Coach SR reminders — surfaced as a single toast-card if any 1/3/7-day milestones are due */}
    {dueReminders.length>0&&<div style={{
      position:"fixed",bottom:20,right:20,zIndex:9000,
      background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",
      padding:"12px 16px",borderRadius:12,boxShadow:"0 6px 24px rgba(124,58,237,0.4)",
      maxWidth:340,fontSize:13,lineHeight:1.5,
    }}>
      <div style={{fontWeight:900,marginBottom:4}}>🎓 Coach reminder</div>
      <div style={{fontSize:12,opacity:0.92,marginBottom:8}}>
        У тебя {dueReminders.length} тема{dueReminders.length===1?"":dueReminders.length<5?"ы":""} для повторения по spaced-repetition (1/3/7 дней). Открой Coach Knowledge.
      </div>
      <div style={{display:"flex",gap:6}}>
        <button onClick={()=>{
          // Dismiss all current due reminders
          for(const r of dueReminders)dismissReminder(r.entryId,r.milestone);
          sDueReminders([]);
        }} style={{background:"rgba(255,255,255,0.18)",border:"none",color:"#fff",fontSize:11,fontWeight:700,padding:"5px 10px",borderRadius:6,cursor:"pointer"}}>Скрыть</button>
      </div>
    </div>}

    {/* First-time welcome tour */}
    {tourStep>=0&&(()=>{
      const slides=[
        {icon:"♞",title:"Добро пожаловать в AEVION CyberChess",body:<>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}>Полноценный шахматный тренажёр: AI-движок Stockfish, живой тренер, 5000+ пазлов, 12 вариантов игры и своя валюта.</p>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center",marginTop:8}}>
            {["⚡ Puzzle Rush","🎓 Coach AI","🎲 12 вариантов","📊 Analysis","🏆 Турниры"].map(f=><span key={f} style={{fontSize:11,padding:"3px 9px",borderRadius:999,background:"rgba(5,150,105,0.12)",color:CC.brand,fontWeight:700}}>{f}</span>)}
          </div>
          <p style={{margin:"12px 0 0",color:CC.textDim,fontSize:13}}>+50 Chessy уже на счёте. Начнём?</p>
        </>},
        {icon:"🎯",title:"5000+ пазлов и тайм-режимы",body:<>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}><b>Puzzle Rush</b> — реши как можно больше за 3 минуты. Streak 🔥 увеличивает Chessy-бонус.</p>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}><b>Тайм-режимы</b> — 3мин / 5мин / свой: авто-переход после каждого решения, итоговый экран с WR%.</p>
          <p style={{margin:0,color:CC.textDim,fontSize:13}}>Нажми <b>Puzzles</b> в верхней навигации → Выбери режим → Вперёд!</p>
        </>},
        {icon:"🎓",title:"AI Coach с Anthropic Claude",body:<>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}>Задай вопрос во вкладке Coach — тренер видит текущую позицию, оценку движка и историю ходов.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
            {["🔍 Объясни позицию","📋 Найди план","🎯 Где тактика","🛡 Слабости"].map(a=><div key={a} style={{fontSize:11,padding:"5px 8px",background:"rgba(124,58,237,0.08)",borderRadius:6,color:"#6d28d9",fontWeight:700,textAlign:"center"}}>{a}</div>)}
          </div>
          <p style={{margin:0,color:CC.textDim,fontSize:13}}>База знаний: 93 записи по тактике, дебютам, эндшпилям, времени и пути роста.</p>
        </>},
        {icon:"🎲",title:"12 вариантов шахмат",body:<>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}>Играй не только классику — доступны Fischer 960, Atomic, King of the Hill, Three-Check, Crazyhouse и ещё 7.</p>
          <p style={{margin:"0 0 10px",lineHeight:1.6}}>Каждый вариант — свои правила, своя стратегия, своё место в таблице лидеров.</p>
          <p style={{margin:0,color:CC.textDim,fontSize:13}}>На Setup экране нажми быстрый tile или <b>⚙ Настройки → Игра → 12 Вариантов</b>.</p>
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

    {/* Leaderboard expanded — full top with user position highlighted */}
    {(()=>{
      if(!lbExpanded)return null;
      const myName="Ты";
      const myRating=lbExpanded==="puzzles"?800+pzSolvedCount*8:lbExpanded==="rush"?rushBest:rat;
      const all=getFullBoardAroundMe(lbExpanded,myRating,myName);
      const myRank=findMyRank(lbExpanded,myRating);
      // Авто-скролл к юзеру когда модалка открывается. Делаем DOM lookup
      // в setTimeout чтобы рендер успел.
      setTimeout(()=>{
        try{const el=document.querySelector("[data-lb-me=\"1\"]");if(el)(el as HTMLElement).scrollIntoView({block:"center",behavior:"smooth"})}catch{}
      },50);
      return <Modal open={!!lbExpanded} onClose={()=>sLbExpanded(null)} size="lg" title={`🏆 ${CATEGORY_LABEL[lbExpanded]} · топ-${all.length}`}>
        <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[2]}}>Твоя позиция: <span style={{fontWeight:900,color:CC.brand}}>#{myRank.toLocaleString()}</span> · рейтинг {myRating}</div>
        <div style={{maxHeight:"60vh",overflowY:"auto",border:`1px solid ${CC.border}`,borderRadius:RADIUS.md,background:CC.surface1}}>
          {all.map((e,i)=>{
            const podium=e.rank===1?"🥇":e.rank===2?"🥈":e.rank===3?"🥉":null;
            return <div key={`${e.rank}-${i}`} data-lb-me={e.isMe?"1":"0"} style={{
              display:"flex",alignItems:"center",gap:SPACE[2],padding:"7px 12px",
              borderBottom:i<all.length-1?`1px solid ${CC.border}`:"none",
              background:e.isMe?"rgba(5,150,105,0.1)":"transparent",
              borderLeft:e.isMe?`3px solid ${CC.brand}`:"3px solid transparent",
            }}>
              <span style={{width:36,fontSize:12,fontWeight:900,color:e.rank<=3?CC.gold:CC.textDim,textAlign:"center"}}>{podium||`#${e.rank}`}</span>
              <span style={{fontSize:14,lineHeight:1}}>{e.country}</span>
              <span style={{flex:1,fontSize:13,fontWeight:e.isMe?900:600,color:e.isMe?CC.brand:CC.text}}>{e.name}{e.isMe&&<span style={{marginLeft:6,padding:"1px 6px",borderRadius:3,background:CC.brand,color:"#fff",fontSize:9.5,letterSpacing:0.5}}>ВЫ</span>}</span>
              {e.games!==undefined&&<span style={{fontSize:10.5,color:CC.textMute,fontWeight:600}}>{e.games.toLocaleString()} игр</span>}
              <span style={{minWidth:48,textAlign:"right",fontSize:13,fontWeight:800,color:CC.text,fontFamily:"ui-monospace, SFMono-Regular, monospace"}}>{e.rating}</span>
            </div>;
          })}
        </div>
        <div style={{fontSize:10,color:CC.textMute,marginTop:SPACE[2],fontStyle:"italic"}}>Симулированный лидерборд для одиночной игры. Реальные таблицы появятся после связки с бэкендом.</div>
      </Modal>;
    })()}

    {/* Multi-Panel — split-screen до 4 окон с YouTube/Twitch */}
    <MultiPanel open={showMultiPanel} onClose={()=>sShowMultiPanel(false)}/>

    {/* Personal Opening Repertoire (R hotkey) */}
    <RepertoireModal
      open={repertoireOpen}
      onClose={()=>sRepertoireOpen(false)}
      histSan={hist}
      myColor={pCol}
      onPlayMove={(san)=>{try{const g=new Chess(game.fen());const m=g.move(san);if(m){setGame(g);sHist(h=>[...h,m.san]);sLm({from:m.from,to:m.to});sBk(k=>k+1);sRepertoireOpen(false)}}catch{}}}
    />

    {/* Keyboard Shortcuts Help Overlay — расширенная версия с группировкой */}
    <Modal open={showHelp} onClose={()=>sShowHelp(false)} size="md" title="⌨ Горячие клавиши">
      <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[3]}}>Работают во всех вкладках, пока курсор не в поле ввода.</div>
      {([
        {title:"Ввод хода (когда твой ход)",rows:[
          ["e4 / d5 / Nf3","Просто печатай — ход выполнится автоматом"],
          ["O-O / 0-0","Короткая рокировка"],
          ["O-O-O / 0-0-0","Длинная рокировка"],
          ["e8=Q","Превращение пешки"],
          ["Backspace","Стереть последний символ буфера"],
        ]},
        {title:"Навигация по ходам",rows:[
          ["←  / →","Листать ходы назад / вперёд"],
          ["Home / End","К первому / последнему ходу"],
          ["↑  / ↓","Перейти на 5 ходов"],
        ]},
        {title:"Действия с доской",rows:[
          ["F","Перевернуть доску"],
          ["Esc","Очистить буфер ввода / сбросить премувы"],
          ["ПКМ-drag","Нарисовать стрелку (Analysis / Coach / после партии)"],
          ["ПКМ клик","Подсветить клетку · Shift=красный, Ctrl=синий"],
        ]},
        {title:"Глобально",rows:[
          ["Ctrl+K","⌕ Command Palette — поиск любого действия (▶ play / ◆ puzzle / 🌐 lichess / …)"],
          ["M","Вкл./выкл. звук"],
          ["N","Новая партия (в Play, до старта)"],
          ["R","📚 Открыть / закрыть Репертуар дебютов"],
          ["S","🔗 Скопировать ссылку на текущую позицию (FEN URL)"],
          ["B","⭐ Сохранить позицию в закладки (Ctrl+K → найти открыть)"],
          ["H","💡 Показать лучший ход (3 сек, 5 Chessy в Play, free в Анализе)"],
          ["Ctrl+V","📋 Вставить FEN / PGN / Lichess URL — авто-загрузка в Анализ"],
          ["1..5","Workspace: Focus / Standard / Stream / Study / Coach"],
          ["Ctrl+Shift+D","Debug HUD (drag-механика)"],
          ["?","Показать / скрыть эту подсказку"],
        ]},
        {title:"История ходов",rows:[
          ["Hover на ход","🟧 Превью позиции на доске (без потери текущего состояния)"],
          ["Click на ход","🟢 Прыгнуть в эту позицию навсегда (browse mode)"],
          ["ПКМ на ход","✍ Открыть меню аннотаций (!! ! !? ?! ? ??)"],
        ]},
        {title:"Аннотации (в режиме Analysis)",rows:[
          ["1","!! Блестящий ход"],
          ["2","! Хороший ход"],
          ["3","!? Интересный ход"],
          ["4","?! Сомнительный ход"],
          ["5","? Ошибка"],
          ["6","?? Блундер"],
          ["(повтор клавиши)","Снять аннотацию с хода"],
        ]},
        {title:"Эксклюзивные фичи AEVION",rows:[
          ["⚔ в «Мои партии»","Ghost Duel — дуэль с прошлой собой"],
          ["🤝 Друг онлайн","P2P без сервера — отправь другу ссылку"],
          ["BoardArt в Настройках","Декор доски: Шанырак, Волна, Klimt…"],
          ["?? / !! тосты","Авто-обнаружение блунда/брилланта"],
          ["WhatIf в Analysis","AI объяснит любую кандидатную линию"],
        ]},
      ] as const).map(grp=><div key={grp.title} style={{marginBottom:SPACE[3]}}>
        <div style={{fontSize:10,fontWeight:900,letterSpacing:1.2,textTransform:"uppercase" as const,color:CC.textMute,marginBottom:6}}>{grp.title}</div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:"8px 14px",fontSize:13,alignItems:"center"}}>
          {grp.rows.map(([k,v])=><React.Fragment key={k}>
            <kbd style={{fontFamily:"ui-monospace, SFMono-Regular, monospace",fontWeight:900,fontSize:12,padding:"4px 10px",borderRadius:RADIUS.sm,background:CC.surface3,border:`1px solid ${CC.border}`,color:CC.text,whiteSpace:"nowrap"}}>{k}</kbd>
            <span style={{color:CC.text,lineHeight:1.5}}>{v}</span>
          </React.Fragment>)}
        </div>
      </div>)}
    </Modal>

    {/* Floating keyboard hint pill — bottom-right, кликабельно открывает help */}
    {!streamerMode&&!showHelp&&<button onClick={()=>sShowHelp(true)} title="Показать горячие клавиши"
      style={{
        position:"fixed",bottom:16,right:16,zIndex:Z.sticky,
        display:"inline-flex",alignItems:"center",gap:6,
        padding:"6px 12px 6px 6px",
        background:CC.surface1,
        border:`1px solid ${CC.border}`,
        borderRadius:RADIUS.full,
        boxShadow:SHADOW.md,
        cursor:"pointer",
        transition:`transform ${MOTION.fast} ${MOTION.ease}, box-shadow ${MOTION.base} ${MOTION.ease}`,
      }}
      onMouseEnter={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.transform="translateY(-1px)";el.style.boxShadow=SHADOW.lg}}
      onMouseLeave={e=>{const el=e.currentTarget as HTMLButtonElement;el.style.transform="";el.style.boxShadow=SHADOW.md}}
    >
      <kbd style={{fontFamily:"ui-monospace, SFMono-Regular, monospace",fontWeight:900,fontSize:11,padding:"2px 8px",borderRadius:RADIUS.sm,background:CC.surface3,border:`1px solid ${CC.border}`,color:CC.text}}>?</kbd>
      <span style={{fontSize:11,fontWeight:700,color:CC.textDim,letterSpacing:0.2}}>горячие клавиши</span>
    </button>}

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
            const capped=(chessy.owned.master_ai||isPro)?targetIdx:Math.min(targetIdx,4);
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
    {/* ─── Variant tutorial overlay ─── shown once per variant on its first play. After dismiss,
        the lighter "tip toast" path takes over for subsequent first 3 plays as a refresher. */}
    {variantTutorialFor&&(()=>{
      const v=VARIANTS.find(x=>x.id===variantTutorialFor);
      if(!v)return null;
      const tip=VARIANT_TUTORIAL[variantTutorialFor];
      const dismiss=()=>{
        sSeenVariantTutorials(prev=>{const n=new Set(prev);n.add(variantTutorialFor);return n});
        sVariantTutorialFor(null);
      };
      return <div role="dialog" aria-modal="true" onClick={dismiss}
        style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.62)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:240,padding:16}}>
        <div onClick={e=>e.stopPropagation()} style={{
          background:"linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%)",color:"#fff",
          borderRadius:16,maxWidth:520,width:"100%",padding:"24px 28px",
          boxShadow:"0 24px 64px -8px rgba(15,23,42,0.55)",border:"1px solid #312e81"
        }}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
            <div style={{fontSize:42,lineHeight:1}}>{v.emoji}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:900,letterSpacing:1.5,textTransform:"uppercase" as const,color:"#a78bfa"}}>Новый режим</div>
              <div style={{fontSize:22,fontWeight:900,color:"#fff",lineHeight:1.15}}>{v.name}</div>
            </div>
          </div>
          <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.6,marginBottom:14}}>{v.longDesc}</div>
          {tip&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(124,58,237,0.18)",border:"1px solid rgba(167,139,250,0.4)",fontSize:13,color:"#e9d5ff",lineHeight:1.55,marginBottom:14}}>
            <span style={{fontWeight:900,color:"#a78bfa"}}>💡 Совет:</span> {tip.replace(/^[^\s]+\s/,"")}
          </div>}
          {v.notes&&v.notes.length>0&&<ul style={{margin:0,padding:0,listStyle:"none",fontSize:12,color:"#94a3b8",lineHeight:1.7,marginBottom:16}}>
            {v.notes.map((n,i)=><li key={i} style={{display:"flex",gap:6}}><span style={{color:"#a78bfa",flexShrink:0}}>·</span><span>{n}</span></li>)}
          </ul>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={dismiss} style={{
              flex:1,padding:"10px 16px",borderRadius:10,border:"none",
              background:"linear-gradient(135deg,#7c3aed,#a78bfa)",color:"#fff",
              fontSize:14,fontWeight:900,cursor:"pointer",letterSpacing:0.5,
              boxShadow:"0 4px 14px rgba(124,58,237,0.4)"
            }}>▶ Понял, играть</button>
            <button onClick={()=>{dismiss();sShowVariants(true)}} style={{
              padding:"10px 16px",borderRadius:10,border:"1px solid rgba(148,163,184,0.4)",
              background:"transparent",color:"#cbd5e1",
              fontSize:13,fontWeight:700,cursor:"pointer"
            }}>Все режимы</button>
          </div>
        </div>
      </div>;
    })()}

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
              const lvl=(chessy.owned.master_ai||isPro)?g.aiLevel:Math.min(4,g.aiLevel);
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
                  const lvl=(chessy.owned.master_ai||isPro)?cl.aiLevel:Math.min(4,cl.aiLevel);
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
    {showConfetti&&<Confetti onDone={()=>sShowConfetti(false)}/>}

    {/* ─── Timed Puzzle Session result modal (3min / 5min / custom) ─── */}
    <Modal open={!!timedResult} onClose={()=>sTimedResult(null)} size="sm"
      title={timedResult?`⏱ ${timedResult.mode} завершено`:"Сессия завершена"}>
      {timedResult&&<div style={{textAlign:"center"}}>
        <div style={{fontSize:56,lineHeight:1,marginBottom:SPACE[3]}}>
          {timedResult.solved===0?"😔":timedResult.solved>=10?"🏆":timedResult.solved>=5?"🎯":"⏱"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:SPACE[2],marginBottom:SPACE[4]}}>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.brandSoft,border:`1px solid ${CC.brand}`}}>
            <div style={{fontSize:10,color:CC.brand,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Решено</div>
            <div style={{fontSize:32,fontWeight:900,color:CC.brand,lineHeight:1.1,marginTop:2}}>{timedResult.solved}</div>
          </div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"#fef2f2",border:"1px solid #fca5a5"}}>
            <div style={{fontSize:10,color:CC.danger,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>Ошибок</div>
            <div style={{fontSize:32,fontWeight:900,color:CC.danger,lineHeight:1.1,marginTop:2}}>{timedResult.failed}</div>
          </div>
          <div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:CC.surface3,border:`1px solid ${CC.border}`}}>
            <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:0.5,textTransform:"uppercase" as const}}>WR%</div>
            <div style={{fontSize:32,fontWeight:900,color:CC.text,lineHeight:1.1,marginTop:2}}>
              {timedResult.solved+timedResult.failed>0?Math.round(timedResult.solved/(timedResult.solved+timedResult.failed)*100):0}%
            </div>
          </div>
        </div>
        {timedResult.solved>0&&<div style={{padding:SPACE[3],borderRadius:RADIUS.md,background:"linear-gradient(135deg,#fffbeb,#fef3c7)",border:"1px solid #fcd34d",marginBottom:SPACE[3]}}>
          <div style={{fontSize:12,fontWeight:800,color:"#92400e"}}>Начислено Chessy</div>
          <div style={{fontSize:22,fontWeight:900,color:"#78350f",display:"inline-flex",alignItems:"center",gap:4,marginTop:2}}>
            <Icon.Coin width={20} height={20}/>+{timedResult.solved*2}
          </div>
        </div>}
        <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[3]}}>
          {timedResult.solved>=10?"Отличный результат! Продолжай в том же духе.":timedResult.solved>=5?"Хорошо! Больше практики — и вырастешь.":timedResult.solved===0?"Попробуй снова — главное начать!":"Неплохое начало. Тренируй тактику каждый день!"}
        </div>
        <div style={{display:"flex",gap:SPACE[2]}}>
          <Btn variant="secondary" size="md" full onClick={()=>sTimedResult(null)}>Закрыть</Btn>
          <Btn variant="primary" size="md" full onClick={()=>{
            sTimedResult(null);
            const sec=timedResult.mode==="3 мин"?180:timedResult.mode==="5 мин"?300:pzCustomSec;
            sPzSolvedCount(0);sPzFailedCount(0);sPzTimeLeft(sec);
            if(fPz.length)ldPz(Math.floor(Math.random()*fPz.length));
          }}>▶ Ещё раз</Btn>
        </div>
      </div>}
    </Modal>

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

    {/* ═══ Coordinates Trainer (killer #13) ═══ */}
    <Modal open={showCoord} onClose={()=>{sShowCoord(false);sCoordSession(null);sCoordResult(null)}} size="lg"
      title="🎯 Coordinates Trainer">
      {!coordSession?(()=>{
        const top=coordLB[0];
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          <Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#fffbeb,#fef3c7)",borderColor:"#fcd34d"}}>
            <div style={{fontSize:13,color:"#92400e",fontWeight:800,marginBottom:SPACE[1]}}>Как играть</div>
            <div style={{fontSize:13,color:CC.text,lineHeight:1.6}}>
              Тебе показывают координату (например <b>e4</b>). Тапай по правильной клетке.
              За 30 секунд набери максимум — каждое попадание даёт +100 очков, ошибка −50.
              Чем быстрее реакция, тем больше бонус.
            </div>
            {top&&<div style={{marginTop:SPACE[2],fontSize:12,color:"#92400e"}}>
              <b>Твой рекорд:</b> {top.result.score} очков · {top.result.hits}/{top.result.total} · средняя реакция {top.result.avgReactionMs}ms
            </div>}
          </Card>
          <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap"}}>
            <Btn variant="primary" size="lg" full onClick={()=>{sCoordSession(coordStart(30_000,true));sCoordResult(null)}}>
              ▶ Старт · 30 сек (белыми)
            </Btn>
            <Btn variant="secondary" size="md" onClick={()=>{sCoordSession(coordStart(30_000,false));sCoordResult(null)}}>
              ▶ Старт чёрными
            </Btn>
            <Btn variant="secondary" size="md" onClick={()=>{sCoordSession(coordStart(60_000,true));sCoordResult(null)}}>
              ▶ 60 сек hardcore
            </Btn>
          </div>
          {coordLB.length>0&&<Card padding={SPACE[3]} tone="surface1">
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>Лидерборд (TOP 10)</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {coordLB.slice(0,10).map((e,i)=>{
                const r=coordRank(e.result.score);
                return <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 8px",borderRadius:RADIUS.sm,background:i===0?"#fef3c7":CC.surface1,border:`1px solid ${i===0?"#fcd34d":CC.border}`}}>
                  <span style={{fontSize:12,fontWeight:800,color:CC.text}}>#{i+1} {r.emoji} {r.title}</span>
                  <span style={{fontSize:13,fontWeight:900,fontFamily:"ui-monospace, monospace",color:CC.brand}}>{e.result.score}</span>
                  <span style={{fontSize:11,color:CC.textDim,fontFamily:"ui-monospace, monospace"}}>{e.result.hits}/{e.result.total} · {e.result.avgReactionMs}ms</span>
                </div>;
              })}
            </div>
          </Card>}
        </div>;
      })():coordResult?(()=>{
        const r=coordRank(coordResult.score);
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3],alignItems:"center"}}>
          <div style={{fontSize:48}}>{r.emoji}</div>
          <div style={{fontSize:22,fontWeight:900,color:CC.text}}>{r.title}</div>
          <div style={{fontSize:48,fontWeight:900,color:CC.brand,fontFamily:"ui-monospace, monospace"}}>{coordResult.score}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:SPACE[2],width:"100%"}}>
            <Card padding={SPACE[2]} tone="surface1"><div style={{fontSize:10,color:CC.textDim,fontWeight:800,textTransform:"uppercase" as const}}>Попадания</div><div style={{fontSize:18,fontWeight:900,color:CC.brand}}>{coordResult.hits}</div></Card>
            <Card padding={SPACE[2]} tone="surface1"><div style={{fontSize:10,color:CC.textDim,fontWeight:800,textTransform:"uppercase" as const}}>Точность</div><div style={{fontSize:18,fontWeight:900,color:CC.text}}>{coordResult.accuracy}%</div></Card>
            <Card padding={SPACE[2]} tone="surface1"><div style={{fontSize:10,color:CC.textDim,fontWeight:800,textTransform:"uppercase" as const}}>Средняя</div><div style={{fontSize:18,fontWeight:900,color:CC.text}}>{coordResult.avgReactionMs}ms</div></Card>
            <Card padding={SPACE[2]} tone="surface1"><div style={{fontSize:10,color:CC.textDim,fontWeight:800,textTransform:"uppercase" as const}}>Лучшая</div><div style={{fontSize:18,fontWeight:900,color:CC.brand}}>{coordResult.bestReactionMs}ms</div></Card>
          </div>
          <div style={{fontSize:13,color:CC.textDim,textAlign:"center"}}>+{r.reward} Chessy в копилку 🎉</div>
          <div style={{display:"flex",gap:SPACE[2],width:"100%"}}>
            <Btn variant="primary" full onClick={()=>{sCoordSession(coordStart(30_000,true));sCoordResult(null)}}>↻ Ещё раз</Btn>
            <Btn variant="secondary" full onClick={()=>{sCoordSession(null);sCoordResult(null)}}>← Меню</Btn>
          </div>
        </div>;
      })():(()=>{
        // Active session
        const ms=coordTimeLeft(coordSession);
        const sec=Math.ceil(ms/1000);
        const target=coordSession.round.target;
        const pct=Math.max(0,Math.min(100,(ms/coordSession.durationMs)*100));
        const grid:string[][]=[];
        for(let r=0;r<8;r++){const row:string[]=[];for(let f=0;f<8;f++)row.push(`${"abcdefgh"[f]}${8-r}`);grid.push(row);}
        const flipBoard=!coordSession.asWhite;
        const dispRows=flipBoard?[...grid].reverse().map(r=>[...r].reverse()):grid;
        const flash=coordFlash;
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:SPACE[2]}}>
            <div style={{flex:1}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Найди клетку</div>
              <div style={{fontSize:48,fontWeight:900,color:CC.brand,fontFamily:"ui-monospace, monospace",lineHeight:1}}>{target}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Осталось</div>
              <div style={{fontSize:32,fontWeight:900,color:sec<=5?CC.danger:CC.text,fontFamily:"ui-monospace, monospace",lineHeight:1}}>{sec}s</div>
            </div>
          </div>
          <div style={{height:8,borderRadius:RADIUS.full,overflow:"hidden",background:CC.surface3}}>
            <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${CC.brand},${sec<=5?CC.danger:CC.brand})`,transition:"width 0.1s linear"}}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:0,width:"100%",maxWidth:480,aspectRatio:"1",margin:"0 auto",border:`2px solid ${CC.borderStrong}`,borderRadius:RADIUS.md,overflow:"hidden"}}>
            {dispRows.flatMap((row,rIdx)=>row.map((sq,fIdx)=>{
              const isLight=(rIdx+fIdx)%2===0;
              const isFlashing=flash&&flash.sq===sq&&Date.now()-flash.ts<400;
              const flashCol=flash?.ok?"#10b981":"#ef4444";
              return <button key={sq} onClick={()=>{
                const{session,correct,reactionMs}=coordHit(coordSession,sq);
                sCoordFlash({sq,ok:correct,ts:Date.now()});
                if(correct)snd("move");else snd("check");
                sCoordSession(session);
                if(coordExpired(session)){
                  const res=coordSummarize(session);
                  sCoordResult(res);
                  sCoordLB(coordSaveLB(res));
                  const rank=coordRank(res.score);
                  addChessy(rank.reward,`Coord: ${rank.title}`);
                }
              }} style={{aspectRatio:"1",border:"none",cursor:"pointer",background:isFlashing?flashCol:(isLight?"#fef3c7":"#92400e"),transition:"background 0.18s",fontSize:0,outline:"none"}} aria-label={sq}/>;
            }))}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:13,color:CC.textDim}}>
            <span>✓ {coordSession.hits} · ✗ {coordSession.misses}</span>
            <span style={{fontFamily:"ui-monospace, monospace"}}>{coordSession.asWhite?"Белыми":"Чёрными"}</span>
            <Btn size="sm" variant="secondary" onClick={()=>{
              const res=coordSummarize(coordSession);
              sCoordResult(res);
              sCoordLB(coordSaveLB(res));
            }}>Стоп</Btn>
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Personality Quiz (killer #14) ═══ */}
    <Modal open={showQuiz} onClose={()=>{sShowQuiz(false);sQuizAnswers([]);sQuizResult(null)}} size="lg"
      title="🧠 Chess Personality">
      {(()=>{
        if(quizResult){
          const top=QUIZ_PLAYERS[quizResult.topId];
          const second=QUIZ_PLAYERS[quizResult.ranked[1]];
          return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
            <Card padding={SPACE[4]} tone="surface1" style={{background:`linear-gradient(135deg,#fdf4ff,#fae8ff)`,borderColor:"#e9d5ff",textAlign:"center"}}>
              <div style={{fontSize:64,lineHeight:1}}>{top.emoji}</div>
              <div style={{fontSize:11,color:"#a21caf",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginTop:SPACE[2]}}>Твой стиль ближе всего к</div>
              <div style={{fontSize:24,fontWeight:900,color:CC.text,marginTop:4}}>{top.name}</div>
              <div style={{fontSize:13,color:CC.textDim,marginTop:2,fontStyle:"italic"}}>{top.tagline} · {top.era}</div>
              <div style={{fontSize:13,color:CC.text,lineHeight:1.6,marginTop:SPACE[2]}}>{top.bio}</div>
              <div style={{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center",marginTop:SPACE[3]}}>
                {top.strengths.map(s=><Badge key={s} tone="accent" size="sm">{s}</Badge>)}
              </div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:SPACE[2],fontFamily:"ui-monospace, monospace"}}>★ Знаковая партия: {top.signatureGame}</div>
            </Card>
            <Card padding={SPACE[3]} tone="surface1">
              <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>Полный рейтинг</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {quizResult.ranked.map((id,i)=>{
                  const p=QUIZ_PLAYERS[id];
                  const score=quizResult.scores[id];
                  const max=quizResult.scores[quizResult.topId];
                  const pct=max>0?Math.round((score/max)*100):0;
                  return <div key={id}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:2}}>
                      <span style={{fontWeight:i===0?900:700,color:CC.text}}>#{i+1} {p.emoji} {p.name}</span>
                      <span style={{fontFamily:"ui-monospace, monospace",color:CC.textDim}}>{score} pts</span>
                    </div>
                    <div style={{height:6,borderRadius:RADIUS.full,overflow:"hidden",background:CC.surface3}}>
                      <div style={{width:`${pct}%`,height:"100%",background:i===0?CC.accent:CC.textDim,transition:"width 0.6s ease"}}/>
                    </div>
                  </div>;
                })}
              </div>
            </Card>
            <div style={{display:"flex",gap:SPACE[2]}}>
              <Btn variant="primary" full onClick={()=>{
                svQuizResult(quizResult);
                sSavedQuizResult({ts:Date.now(),result:quizResult});
                showToast("Результат сохранён","success");
                sShowQuiz(false);
              }}>💾 Сохранить</Btn>
              <Btn variant="secondary" onClick={()=>{
                const txt=`Я как ${top.name} ${top.emoji} в шахматах! Найди свой стиль на AEVION CyberChess.`;
                if(navigator.share)navigator.share({title:"Chess Personality",text:txt}).catch(()=>{});
                else{navigator.clipboard?.writeText(txt);showToast("Скопировано в буфер","success")}
              }}>📤 Поделиться</Btn>
              <Btn variant="ghost" onClick={()=>{sQuizAnswers([]);sQuizResult(null)}}>↻ Заново</Btn>
            </div>
          </div>;
        }
        const idx=quizAnswers.length;
        if(idx>=QUIZ_Q.length){
          // защита
          return null;
        }
        const q=QUIZ_Q[idx];
        const pct=Math.round((idx/QUIZ_Q.length)*100);
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          <div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:4}}>
              <span>Вопрос {idx+1} из {QUIZ_Q.length}</span><span>{pct}%</span>
            </div>
            <div style={{height:6,borderRadius:RADIUS.full,overflow:"hidden",background:CC.surface3}}>
              <div style={{width:`${pct}%`,height:"100%",background:CC.accent,transition:"width 0.4s ease"}}/>
            </div>
          </div>
          <div style={{fontSize:18,fontWeight:800,color:CC.text,lineHeight:1.4}}>{q.q}</div>
          <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
            {q.options.map((o,i)=>(
              <button key={i} onClick={()=>{
                const next=[...quizAnswers,i];
                if(next.length>=QUIZ_Q.length){
                  const res=scoreQuiz(next);
                  sQuizResult(res);
                  addChessy(30,"Personality Quiz");
                }
                sQuizAnswers(next);
              }} style={{padding:"14px 16px",textAlign:"left",borderRadius:RADIUS.md,border:`1.5px solid ${CC.border}`,background:CC.surface1,color:CC.text,fontSize:14,fontWeight:600,lineHeight:1.5,cursor:"pointer",transition:`all ${MOTION.fast} ${MOTION.ease}`}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=CC.accent;e.currentTarget.style.background="#faf5ff"}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=CC.border;e.currentTarget.style.background=CC.surface1}}>
                {String.fromCharCode(65+i)}. {o.label}
              </button>
            ))}
          </div>
          {idx>0&&<Btn size="sm" variant="ghost" onClick={()=>sQuizAnswers(quizAnswers.slice(0,-1))}>← Назад</Btn>}
        </div>;
      })()}
    </Modal>

    {/* ═══ Board Editor (killer #15) ═══ */}
    <Modal open={showEditor} onClose={()=>sShowEditor(false)} size="xl"
      title="♛ Board Editor">
      {(()=>{
        const fenPreview=edToFen(editorBoard,editorSide);
        const palette:[("p"|"n"|"b"|"r"|"q"|"k"),"w"|"b"][]=ED_PIECES.flatMap(t=>[[t,"w" as const],[t,"b" as const]]);
        const pieceGlyph=(t:"p"|"n"|"b"|"r"|"q"|"k",c:"w"|"b")=>PM[`${c}${t}`]||"";
        const place=(r:number,f:number)=>{
          sEditorBoard(b=>{
            const cp=b.map(row=>row.slice());
            if(editorPalette.type==="erase")cp[r][f]=null;
            else cp[r][f]={type:editorPalette.type,color:editorPalette.color};
            return cp;
          });
          sEditorErrors([]);
        };
        return <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 260px), 1fr))",gap:SPACE[3],alignItems:"start"}}>
          {/* Board */}
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",border:`2px solid ${CC.borderStrong}`,borderRadius:RADIUS.md,overflow:"hidden",userSelect:"none",aspectRatio:"1",maxWidth:520,margin:"0 auto"}}>
              {Array.from({length:8}).flatMap((_,r)=>Array.from({length:8}).map((__,f)=>{
                const cell=editorBoard[r][f];
                const isLight=(r+f)%2===0;
                return <div key={`er-${r}-${f}`} onClick={()=>place(r,f)}
                  style={{aspectRatio:"1",background:isLight?"#fef3c7":"#92400e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,cursor:"pointer",lineHeight:1,position:"relative",transition:"background 0.12s"}}>
                  {cell&&<div style={{width:"86%",height:"86%",filter:"drop-shadow(0 2px 3px rgba(0,0,0,0.3))"}}><Piece type={cell.type} color={cell.color}/></div>}
                </div>;
              }))}
            </div>
            <div style={{display:"flex",gap:SPACE[2],marginTop:SPACE[2],flexWrap:"wrap",justifyContent:"center"}}>
              <Btn size="sm" variant="secondary" onClick={()=>sEditorBoard(edStart())}>↻ Стартовая</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>sEditorBoard(edEmpty())}>🗑 Очистить</Btn>
              <Btn size="sm" variant="secondary" onClick={()=>{
                const fen=prompt("Вставь FEN:",fenPreview);
                if(fen){try{sEditorBoard(edFromFen(fen.trim()));sEditorErrors([])}catch{sEditorErrors(["Невалидный FEN"])}}
              }}>📋 Импорт FEN</Btn>
            </div>
          </div>
          {/* Palette + side */}
          <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:6}}>Палитра</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4}}>
                {palette.map(([t,c])=>{
                  const sel=editorPalette.type===t&&editorPalette.color===c;
                  return <button key={`${c}${t}`} onClick={()=>sEditorPalette({type:t,color:c})}
                    title={`${c==="w"?"Белые":"Чёрные"} · ${ED_NAMES[t]}`}
                    style={{aspectRatio:"1",border:sel?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,background:sel?CC.brandSoft:CC.surface1,borderRadius:RADIUS.sm,fontSize:24,cursor:"pointer",lineHeight:1,padding:0,color:c==="w"?"#0f172a":"#0f172a",textShadow:c==="w"?"0 0 0 #fff":"none"}}>
                    {pieceGlyph(t,c)}
                  </button>;
                })}
              </div>
              <button onClick={()=>sEditorPalette({type:"erase" as any,color:"w"})}
                style={{width:"100%",marginTop:6,padding:"8px",borderRadius:RADIUS.sm,border:editorPalette.type==="erase"?`2px solid ${CC.danger}`:`1px solid ${CC.border}`,background:editorPalette.type==="erase"?"#fee2e2":CC.surface1,fontSize:12,fontWeight:800,color:editorPalette.type==="erase"?CC.danger:CC.text,cursor:"pointer"}}>🗑 Стереть</button>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:6}}>Ход</div>
              <div style={{display:"flex",gap:4}}>
                {(["w","b"] as const).map(c=>{
                  const sel=editorSide===c;
                  return <button key={c} onClick={()=>sEditorSide(c)}
                    style={{flex:1,padding:"8px",borderRadius:RADIUS.sm,border:sel?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,background:sel?CC.brandSoft:CC.surface1,fontSize:13,fontWeight:800,color:CC.text,cursor:"pointer"}}>
                    {c==="w"?"Белые":"Чёрные"}
                  </button>;
                })}
              </div>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:6}}>FEN</div>
              <textarea readOnly value={fenPreview} rows={3}
                style={{width:"100%",padding:6,borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontFamily:"ui-monospace, monospace",fontSize:11,resize:"none",background:CC.surface2,color:CC.text}}/>
              <Btn size="sm" variant="secondary" full onClick={()=>{
                navigator.clipboard?.writeText(fenPreview);
                showToast("FEN скопирован","success");
              }}>📋 Копировать FEN</Btn>
            </Card>
            {editorErrors.length>0&&<Card padding={SPACE[2]} tone="surface1" style={{borderColor:"#fecaca",background:"#fef2f2"}}>
              <div style={{fontSize:11,fontWeight:800,color:CC.danger,marginBottom:4}}>Проблемы:</div>
              <ul style={{margin:0,paddingLeft:18,fontSize:12,color:"#7f1d1d",lineHeight:1.5}}>
                {editorErrors.map((e,i)=><li key={i}>{e}</li>)}
              </ul>
            </Card>}
            <Btn variant="primary" full onClick={()=>{
              const v=edValidate(editorBoard,editorSide);
              if(!v.ok){sEditorErrors(v.errors);return}
              try{
                const ch=new Chess(v.fen);
                setGame(ch);sBk(k=>k+1);sHist([]);sFenHist([v.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sOn(false);sSetup(false);sPzCurrent(null);sPzAttempt("idle");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(ch.turn());sFlip(ch.turn()==="b");sPms([]);sPmSel(null);
                sTab("analysis");
                sShowEditor(false);
                showToast("Позиция загружена в Анализ","success");
              }catch(e:any){sEditorErrors([String(e?.message||e)])}
            }}>⚡ Анализировать позицию</Btn>
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Settings — единая панель управления ═══ */}
    <Modal open={showSettings} onClose={()=>sShowSettings(false)} size="md"
      title="⚙ Настройки">
      {(()=>{
        const Row=({label,desc,checked,onChange,disabled}:{label:string;desc:string;checked:boolean;onChange:()=>void;disabled?:boolean})=>(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:SPACE[3],padding:`${SPACE[2]}px 0`,borderBottom:`1px solid ${CC.border}`,opacity:disabled?0.55:1}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:800,color:CC.text}}>{label}</div>
              <div style={{fontSize:12,color:CC.textDim,marginTop:1,lineHeight:1.4}}>{desc}</div>
            </div>
            <button onClick={disabled?undefined:onChange} disabled={disabled}
              style={{position:"relative",width:42,height:24,borderRadius:12,border:`1px solid ${checked?CC.brand:CC.border}`,background:checked?CC.brand:CC.surface3,cursor:disabled?"not-allowed":"pointer",transition:`all ${MOTION.fast} ${MOTION.ease}`,padding:0,flexShrink:0}}>
              <span style={{position:"absolute",top:2,left:checked?20:2,width:18,height:18,borderRadius:"50%",background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,0.25)",transition:`left ${MOTION.fast} ${MOTION.ease}`}}/>
            </button>
          </div>
        );
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>🌗 Внешний вид</div>
            <Row label="Тёмная тема" desc="Тёмный фон, светлый текст. Темы доски и набор фигур не меняются." checked={themeMode==="dark"} onChange={()=>{sThemeMode(m=>m==="dark"?"light":"dark");showToast(themeMode==="dark"?"Светлая тема":"Тёмная тема","info")}}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>🔊 Звук</div>
            <Row label="Звук в игре" desc="Хлопки фигур, шах, мат, сигналы." checked={!muted} onChange={()=>{sMuted(v=>!v);showToast(muted?"Звук включён":"Mute","info")}}/>
            <Row label="Голосовые комментарии" desc="Coach зачитывает важные моменты партии (Chrome)." checked={liveCommentary} onChange={()=>sLiveCommentary(v=>!v)}/>
            <Row label="Голос на Master Games" desc="Чтение разбора и заметок к ходам в библиотеке мастеров." checked={masterVoice} onChange={()=>{
              if(masterVoice&&typeof window!=="undefined"&&window.speechSynthesis)window.speechSynthesis.cancel();
              sMasterVoice(v=>!v);
            }}/>
            <div style={{padding:`${SPACE[3]}px 0`,borderBottom:`1px solid ${CC.border}`}}>
              <div style={{fontSize:13,fontWeight:800,color:CC.text,marginBottom:2}}>Звуки фигур — 40 пресетов + молчание</div>
              <div style={{fontSize:12,color:CC.textDim,lineHeight:1.4,marginBottom:SPACE[2]}}>
                Сейчас: <b style={{color:CC.text}}>{CHESS_SOUND_PRESETS.find(p=>p.id===soundPresetId)?.emoji} {CHESS_SOUND_PRESETS.find(p=>p.id===soundPresetId)?.name}</b>
              </div>
              {(["classic","exotic","silent"] as const).map(cat=>{
                const items=CHESS_SOUND_PRESETS.filter(p=>p.category===cat);
                if(items.length===0)return null;
                const catLabel=cat==="classic"?"Классические":cat==="exotic"?"Нетиповые":"Тишина";
                return <div key={cat} style={{marginBottom:SPACE[2]}}>
                  <div style={{fontSize:10,fontWeight:900,color:CC.textDim,letterSpacing:0.8,textTransform:"uppercase" as const,marginBottom:4}}>{catLabel}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {items.map(p=>{
                      const selected=soundPresetId===p.id;
                      return <button key={p.id}
                        onClick={()=>{sSoundPresetId(p.id);playChessSound(p.id,"move");showToast(`${p.emoji} ${p.name}`,"info")}}
                        title={p.desc}
                        style={{
                          padding:"4px 8px",borderRadius:RADIUS.full,
                          border:selected?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                          background:selected?CC.brandSoft:CC.surface1,
                          color:selected?CC.text:CC.textDim,
                          cursor:"pointer",fontSize:11,fontWeight:selected?800:600,
                          transition:`all ${MOTION.fast} ${MOTION.ease}`,
                          whiteSpace:"nowrap" as const,
                        }}>
                        {p.emoji} {p.name}
                      </button>;
                    })}
                  </div>
                </div>;
              })}
              <div style={{fontSize:11,color:CC.textMute,marginTop:4}}>Клик по пресету — мгновенный preview хода.</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>🎮 Игра</div>
            <Row label="Auto-queen (превращение в ферзя)" desc="Пешка на 8-й сразу становится ферзём — без модалки. Для bullet/blitz и премувов. Выключи если нужны underpromotions (конь, ладья, слон)." checked={autoQueen} onChange={()=>sAutoQueen(v=>!v)}/>
            <Row label="Threat Heatmap" desc="Подсветка контроля доски: зелёный — белые, красный — чёрные, янтарный — спорно." checked={showThreatMap} onChange={()=>sShowThreatMap(v=>!v)}/>
            <Row label="Streamer Mode" desc="Скрывает рейтинг и историю — для стримов и публичных демо." checked={streamerMode} onChange={()=>sStreamerMode(v=>!v)}/>
            <div style={{padding:`${SPACE[3]}px 0`,borderBottom:`1px solid ${CC.border}`}}>
              <div style={{fontSize:13,fontWeight:800,color:CC.text,marginBottom:2}}>Глубина анализа Stockfish (F2-3)</div>
              <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[2],lineHeight:1.4}}>Для CPI и top-3 metrics. Не влияет на силу противника. <b style={{color:CC.text}}>Сейчас: depth={sfDepth}</b></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[{d:14,lbl:"⚡ 14 (быстро)"},{d:18,lbl:"🎯 18 (баланс)"},{d:22,lbl:"📈 22 (точнее)"},{d:25,lbl:"🔬 25 (макс)"},{d:30,lbl:"🧠 30 (NNUE deep)"}].map(opt=>{
                  const selected=sfDepth===opt.d;
                  return <button key={opt.d}
                    onClick={()=>{sSfDepth(opt.d);showToast(`Stockfish depth=${opt.d}`,"info")}}
                    style={{
                      padding:"5px 10px",borderRadius:RADIUS.full,
                      border:selected?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                      background:selected?CC.brandSoft:CC.surface1,
                      color:selected?CC.text:CC.textDim,
                      cursor:"pointer",fontSize:11,fontWeight:selected?800:600,
                      transition:`all ${MOTION.fast} ${MOTION.ease}`,
                    }}>
                    {opt.lbl}
                  </button>;
                })}
              </div>
              <div style={{fontSize:10,color:CC.textMute,marginTop:4}}>Чем выше — тем точнее CPI, но дольше ожидание (depth 25+ может занимать 1-2 сек на ход).</div>
            </div>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>📚 Анализ</div>
            <Row label="Opening Explorer" desc="Автозагрузка статистики мастеров для текущей позиции в Analysis." checked={showOpeningExp} onChange={()=>sShowOpeningExp(v=>!v)}/>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>🎨 Тема доски</div>
            <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[2]}}>Сейчас: <b style={{color:CC.text}}>{bT.name} {bT.icon}</b></div>
            <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap"}}>
              {BOARD_THEMES.map((th,i)=>{
                const locked=!!th.premium&&!chessy.owned[th.premium!];
                const selected=boardTheme===i;
                return <button key={i}
                  className="cc-focus-ring"
                  onClick={()=>{if(locked){showToast("Premium — доступно в магазине","info");sShowSettings(false);sShowShop(true);return}sBoardTheme(i)}}
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
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginTop:SPACE[3],marginBottom:SPACE[1]}}>🖼 Декор доски (Board Art)</div>
            <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap",marginBottom:SPACE[2]}}>
              {BOARD_ART_OPTIONS.map(opt=>{
                const selected=boardArt===opt.v;
                return <button key={opt.v} className="cc-focus-ring" onClick={()=>{sBoardArt(opt.v);showToast(`Арт: ${opt.label}`,"info")}}
                  title={opt.hint}
                  style={{padding:"5px 12px",borderRadius:RADIUS.full,border:selected?`2px solid ${CC.accent}`:`1px solid ${CC.border}`,background:selected?CC.accentSoft:CC.surface1,cursor:"pointer",fontSize:12,fontWeight:selected?800:600,color:selected?CC.accent:CC.textDim,transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                  {opt.label}
                </button>;
              })}
            </div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginTop:SPACE[3],marginBottom:SPACE[1]}}>♟ Набор фигур</div>
            <div style={{display:"flex",gap:SPACE[2],flexWrap:"wrap",marginBottom:SPACE[2]}}>
              {PIECE_SETS.map(ps=>{
                const selected=activePieceSet===ps.id;
                return <button key={ps.id}
                  className="cc-focus-ring"
                  onClick={()=>{setActivePieceSet(ps.id);showToast(`Набор: ${ps.name}`,"info")}}
                  title={ps.hint}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",
                    borderRadius:RADIUS.full,
                    border:selected?`2px solid ${CC.brand}`:`1px solid ${CC.border}`,
                    background:selected?CC.brandSoft:CC.surface1,
                    cursor:"pointer",
                    transition:`all ${MOTION.fast} ${MOTION.ease}`}}>
                  <div style={{width:28,height:18,display:"flex",gap:1,alignItems:"center",justifyContent:"center",background:bT.light,borderRadius:3,padding:1}}>
                    <div style={{width:13,height:16}}><Piece type="n" color="w" setOverride={ps.id}/></div>
                    <div style={{width:13,height:16,background:bT.dark,borderRadius:2}}><Piece type="n" color="b" setOverride={ps.id}/></div>
                  </div>
                  <span style={{fontSize:12,fontWeight:selected?800:600,color:selected?CC.text:CC.textDim}}>{ps.name}</span>
                </button>;
              })}
            </div>
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginTop:SPACE[3],marginBottom:SPACE[1]}}>⚡ Очередь премувов</div>
            <label style={{display:"flex",alignItems:"center",gap:SPACE[2],fontSize:12,color:CC.textDim,fontWeight:600}}>
              <span>Лимит: <b style={{color:CC.text}}>{pmLim}</b></span>
              <input type="range" min={1} max={50} value={pmLim} onChange={e=>sPmLim(+e.target.value)} style={{flex:1,accentColor:CC.brand}}/>
            </label>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:CC.danger,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[1]}}>⚠ Сброс данных</div>
            <div style={{fontSize:12,color:CC.textDim,marginBottom:SPACE[2],lineHeight:1.5}}>Удалить локальные данные: партии, рейтинг, Chessy, достижения, прогресс мастер-партий. Это действие необратимо.</div>
            <Btn size="sm" variant="danger" onClick={()=>{
              if(!confirm("Точно сбросить ВСЁ? Партии, рейтинг, Chessy и прогресс будут удалены."))return;
              try{
                const keys=["aevion_chess_games_v1","aevion_chess_rating_v2","aevion_chess_stats_v2","aevion_chessy_v1","aevion_chessy_log_v1","aevion_chess_master_progress_v1","aevion_chess_coord_lb_v1","aevion_chess_personality_v1","aevion_chess_daily_v1","aevion_variant_stats_v1","aevion_chess_clones_v1","aevion_chess_rival_v1","aevion_chess_tournament_v1","aevion_chess_trophies_v1"];
                for(const k of keys)try{localStorage.removeItem(k)}catch{}
                showToast("Локальные данные сброшены — обнови страницу","success");
              }catch{showToast("Не удалось сбросить","error")}
            }}>🗑 Сбросить локальные данные</Btn>
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Master Games + Guess the Move (killer #17) ═══ */}
    <Modal open={showMasters} onClose={()=>{sShowMasters(false);sMasterCurrent(null)}} size="xl"
      title="♛ Master Games">
      {(()=>{
        const games=ldMasterGames();
        if(!masterCurrent){
          return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
            <Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#fef9c3,#fde68a)",borderColor:"#facc15"}}>
              <div style={{fontSize:13,color:"#854d0e",fontWeight:800,marginBottom:SPACE[1]}}>Что внутри</div>
              <div style={{fontSize:13,color:CC.text,lineHeight:1.6}}>
                {games.length} знаменитых партий — от «Бессмертной» (1851) до Карлсена (2014). Два режима: <b>Replay</b> (просто пройти партию с аннотациями) и <b>Угадай ход</b> (предсказывай ход мастера и получай Chessy за каждое попадание).
              </div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(260px,1fr))",gap:SPACE[2]}}>
              {games.map(g=>{
                const themeCol={Attack:"#dc2626",Sacrifice:"#a21caf",Endgame:"#0369a1",Strategy:"#047857",Defense:"#854d0e"}[g.theme];
                return <Card key={g.id} padding={SPACE[3]} tone="surface1" onClick={()=>{
                    sMasterCurrent(g);sMasterPly(0);sMasterMode("replay");sMasterStats({hits:0,misses:0});sMasterGuessFeedback(null);sMasterGuessInput("");
                    try{const ch=new Chess();setGame(ch);sBk(k=>k+1);sLm(null);sSel(null);sVm(new Set());sFlip(g.guessSide==="b")}catch{}
                  }} style={{cursor:"pointer",borderLeft:`4px solid ${themeCol}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:4}}>
                    <span style={{fontSize:14,fontWeight:900,color:CC.text}}>{g.white}</span>
                    <span style={{fontSize:11,color:CC.textDim,fontFamily:"monospace"}}>{g.year}</span>
                  </div>
                  <div style={{fontSize:13,color:CC.textDim,marginBottom:SPACE[1]}}>vs {g.black}</div>
                  <div style={{display:"flex",gap:4,marginBottom:SPACE[2]}}>
                    <Badge tone="accent" size="xs" style={{background:`${themeCol}20`,color:themeCol,borderColor:themeCol}}>{g.theme}</Badge>
                    <Badge tone="info" size="xs">{g.result}</Badge>
                    <Badge tone="brand" size="xs">{Math.ceil(g.moves.length/2)} ходов</Badge>
                  </div>
                  <div style={{fontSize:12,color:CC.text,lineHeight:1.5,minHeight:54,maxHeight:72,overflow:"hidden"}}>{g.blurb}</div>
                </Card>;
              })}
            </div>
          </div>;
        }
        const g=masterCurrent;
        const fens=masterFenLine(g);
        const totalPly=g.moves.length;
        const ply=Math.min(masterPly,totalPly);
        const fenAt=fens[ply]||fens[fens.length-1];
        const sideToMoveAtPly=ply%2===0?"w":"b";
        const isGuessTurn=masterMode==="guess"&&sideToMoveAtPly===g.guessSide&&ply<totalPly&&!masterGuessFeedback;
        const note=g.notes[ply-1]||g.notes[ply];
        const guessRate=masterStats.hits+masterStats.misses>0?Math.round(masterStats.hits/(masterStats.hits+masterStats.misses)*100):0;
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:12,color:CC.textDim,fontWeight:700}}>{g.event} · {g.year}</div>
              <div style={{fontSize:16,fontWeight:900,color:CC.text}}>{g.white} <span style={{color:CC.textDim}}>vs</span> {g.black}</div>
            </div>
            <Btn size="sm" variant="ghost" onClick={()=>sMasterCurrent(null)}>← К списку</Btn>
          </div>
          <div style={{display:"flex",gap:SPACE[2],alignItems:"center",flexWrap:"wrap"}}>
            <UiTabs<"replay"|"guess">
              variant="segment"
              size="sm"
              value={masterMode}
              onChange={m=>{sMasterMode(m);sMasterGuessFeedback(null);sMasterGuessInput("")}}
              tabs={[
                {value:"replay",label:"📖 Replay"},
                {value:"guess",label:"🎯 Угадай ход"},
              ]}
            />
            <button onClick={()=>{
              if(masterVoice&&typeof window!=="undefined"&&window.speechSynthesis)window.speechSynthesis.cancel();
              sMasterVoice(v=>!v);
            }} style={{padding:"4px 10px",borderRadius:RADIUS.sm,border:`1px solid ${masterVoice?"#5eead4":CC.border}`,background:masterVoice?"#ccfbf1":CC.surface1,color:masterVoice?"#115e59":CC.text,fontSize:12,fontWeight:800,cursor:"pointer"}}>
              {masterVoice?"🔊 Voice ON":"🔇 Voice"}
            </button>
            {masterMode==="guess"&&<div style={{display:"flex",alignItems:"center",gap:SPACE[2],fontSize:12,color:CC.textDim}}>
              <span>✓ {masterStats.hits}</span><span>✗ {masterStats.misses}</span>
              {(masterStats.hits+masterStats.misses)>0&&<span style={{fontFamily:"monospace",fontWeight:800,color:guessRate>=60?CC.brand:CC.danger}}>{guessRate}%</span>}
            </div>}
          </div>
          {/* Mini board */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 320px), 1fr))",gap:SPACE[3],alignItems:"start"}}>
            <div>
              {(()=>{
                const ch=new Chess(fenAt);
                const board=ch.board();
                const flipB=g.guessSide==="b";
                const rs=flipB?[...Array(8).keys()].reverse():[...Array(8).keys()];
                const fs=flipB?[...Array(8).keys()].reverse():[...Array(8).keys()];
                return <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",border:`2px solid ${CC.borderStrong}`,borderRadius:RADIUS.md,overflow:"hidden",aspectRatio:"1",maxWidth:480,margin:"0 auto"}}>
                  {rs.flatMap(r=>fs.map(f=>{
                    const cell=board[r][f];
                    const isLight=(r+f)%2===0;
                    return <div key={`mb-${r}-${f}`} style={{aspectRatio:"1",background:isLight?"#fef3c7":"#92400e",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,lineHeight:1}}>
                      {cell&&<div style={{width:"86%",height:"86%",filter:"drop-shadow(0 2px 3px rgba(0,0,0,0.3))"}}><Piece type={cell.type} color={cell.color}/></div>}
                    </div>;
                  }))}
                </div>;
              })()}
              <div style={{display:"flex",gap:4,marginTop:SPACE[2],justifyContent:"center"}}>
                <Btn size="sm" variant="secondary" onClick={()=>{sMasterPly(0);sMasterGuessFeedback(null);sMasterGuessInput("")}}>⏮</Btn>
                <Btn size="sm" variant="secondary" onClick={()=>{sMasterPly(p=>Math.max(0,p-1));sMasterGuessFeedback(null);sMasterGuessInput("")}}>◀</Btn>
                <span style={{padding:"6px 12px",fontSize:12,color:CC.text,fontFamily:"monospace",fontWeight:800,background:CC.surface2,borderRadius:RADIUS.sm}}>
                  {ply}/{totalPly}
                </span>
                <Btn size="sm" variant="secondary" disabled={ply>=totalPly||isGuessTurn} onClick={()=>{sMasterPly(p=>Math.min(totalPly,p+1));sMasterGuessFeedback(null);sMasterGuessInput("")}}>▶</Btn>
                <Btn size="sm" variant="secondary" onClick={()=>{
                  sMasterPly(totalPly);sMasterGuessFeedback(null);sMasterGuessInput("");
                  if(masterStats.hits+masterStats.misses>0){
                    masterRecord(g.id,totalPly,guessRate);
                  }
                }}>⏭</Btn>
              </div>
            </div>
            {/* Side panel */}
            <div style={{display:"flex",flexDirection:"column",gap:SPACE[2]}}>
              {note&&<Card padding={SPACE[2]} tone="surface1" style={{background:"#fffbeb",borderColor:"#fcd34d"}}>
                <div style={{fontSize:10,color:"#92400e",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:4}}>Заметка</div>
                <div style={{fontSize:13,color:CC.text,lineHeight:1.5}}>{note}</div>
              </Card>}
              {masterMode==="guess"&&isGuessTurn&&<Card padding={SPACE[2]} tone="surface1" style={{background:"#ecfdf5",borderColor:"#6ee7b7"}}>
                <div style={{fontSize:11,color:"#047857",fontWeight:800,marginBottom:4}}>Угадай ход {g.guessSide==="w"?"белых":"чёрных"} (SAN, например <code>Nf3</code> или <code>e4</code>):</div>
                <div style={{display:"flex",gap:4}}>
                  <input value={masterGuessInput} onChange={e=>sMasterGuessInput(e.target.value)}
                    onKeyDown={e=>{if(e.key==="Enter"){
                      const actual=g.moves[ply];
                      const result=masterScoreGuess(actual,masterGuessInput.trim());
                      sMasterGuessFeedback(result);
                      if(result.correct){sMasterStats(s=>({...s,hits:s.hits+1}));addChessy(result.reward,`Master guess: ${actual}`)}
                      else sMasterStats(s=>({...s,misses:s.misses+1}));
                    }}}
                    placeholder="Nf3, exd5, O-O…"
                    style={{flex:1,padding:"6px 8px",borderRadius:RADIUS.sm,border:`1px solid ${CC.border}`,fontFamily:"monospace",fontSize:13}}
                    autoFocus/>
                  <Btn size="sm" variant="primary" onClick={()=>{
                    const actual=g.moves[ply];
                    const result=masterScoreGuess(actual,masterGuessInput.trim());
                    sMasterGuessFeedback(result);
                    if(result.correct){sMasterStats(s=>({...s,hits:s.hits+1}));addChessy(result.reward,`Master guess: ${actual}`)}
                    else sMasterStats(s=>({...s,misses:s.misses+1}));
                  }}>✓</Btn>
                </div>
              </Card>}
              {masterMode==="guess"&&masterGuessFeedback&&<Card padding={SPACE[2]} tone="surface1" style={{background:masterGuessFeedback.correct?"#ecfdf5":"#fef2f2",borderColor:masterGuessFeedback.correct?"#6ee7b7":"#fca5a5"}}>
                <div style={{fontSize:13,fontWeight:800,color:masterGuessFeedback.correct?CC.brand:CC.danger,marginBottom:4}}>
                  {masterGuessFeedback.correct?"✓ Точно! +15 Chessy":"✗ Не угадал"}
                </div>
                <div style={{fontSize:12,color:CC.text}}>
                  Мастер сыграл: <b style={{fontFamily:"monospace"}}>{masterGuessFeedback.actual}</b>
                  {!masterGuessFeedback.correct&&masterGuessFeedback.guess&&<> · твой: <span style={{fontFamily:"monospace",color:CC.danger}}>{masterGuessFeedback.guess}</span></>}
                </div>
                <Btn size="sm" variant="primary" full onClick={()=>{
                  sMasterPly(p=>Math.min(totalPly,p+1));
                  sMasterGuessFeedback(null);sMasterGuessInput("");
                }} style={{marginTop:6}}>Дальше →</Btn>
              </Card>}
              {/* Move list */}
              <Card padding={0} tone="surface1">
                <div style={{padding:`${SPACE[2]}px ${SPACE[3]}px`,borderBottom:`1px solid ${CC.border}`,fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const}}>Ходы</div>
                <div style={{maxHeight:220,overflowY:"auto"}}>
                  {Array.from({length:Math.ceil(totalPly/2)}).map((_,i)=>{
                    const wIdx=i*2,bIdx=i*2+1;
                    const wIsCur=ply===wIdx+1;
                    const bIsCur=ply===bIdx+1;
                    return <div key={i} style={{display:"grid",gridTemplateColumns:"34px 1fr 1fr",fontSize:12,fontFamily:"monospace",borderBottom:`1px solid ${CC.border}`}}>
                      <span style={{padding:"4px 0",textAlign:"center",color:CC.textDim,background:CC.surface2,borderRight:`1px solid ${CC.border}`}}>{i+1}</span>
                      <span onClick={()=>{sMasterPly(wIdx+1);sMasterGuessFeedback(null);sMasterGuessInput("")}}
                        style={{padding:"4px 8px",cursor:"pointer",background:wIsCur?"rgba(245,158,11,0.18)":"transparent",fontWeight:wIsCur?900:600,color:masterMode==="guess"&&wIdx>=ply&&g.guessSide==="w"?"transparent":CC.text}}>
                        {masterMode==="guess"&&wIdx>=ply&&g.guessSide==="w"?"???":g.moves[wIdx]||""}
                      </span>
                      <span onClick={()=>{if(g.moves[bIdx]){sMasterPly(bIdx+1);sMasterGuessFeedback(null);sMasterGuessInput("")}}}
                        style={{padding:"4px 8px",cursor:g.moves[bIdx]?"pointer":"default",background:bIsCur?"rgba(245,158,11,0.18)":"transparent",fontWeight:bIsCur?900:600,color:masterMode==="guess"&&bIdx>=ply&&g.guessSide==="b"?"transparent":CC.text}}>
                        {!g.moves[bIdx]?"":(masterMode==="guess"&&bIdx>=ply&&g.guessSide==="b"?"???":g.moves[bIdx])}
                      </span>
                    </div>;
                  })}
                </div>
              </Card>
              {ply>=totalPly&&<Card padding={SPACE[2]} tone="surface1" style={{background:"linear-gradient(135deg,#fef9c3,#fde68a)",borderColor:"#facc15",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:900,color:"#854d0e"}}>★ Партия завершена · {g.result}</div>
                {masterMode==="guess"&&masterStats.hits+masterStats.misses>0&&<div style={{fontSize:12,color:"#854d0e",marginTop:4}}>Точность угадки: <b>{guessRate}%</b> ({masterStats.hits}/{masterStats.hits+masterStats.misses})</div>}
              </Card>}
            </div>
          </div>
        </div>;
      })()}
    </Modal>

    {/* ═══ Insights v2 (killer #16) ═══ */}
    <Modal open={showInsights} onClose={()=>sShowInsights(false)} size="xl"
      title="📊 Insights v2">
      {(()=>{
        if(savedGames.length<3){
          return <Card padding={SPACE[4]} tone="surface1" style={{textAlign:"center"}}>
            <div style={{fontSize:48,marginBottom:SPACE[2]}}>📊</div>
            <div style={{fontSize:16,fontWeight:800,color:CC.text}}>Нужно минимум 3 партии</div>
            <div style={{fontSize:13,color:CC.textDim,marginTop:SPACE[1]}}>Сейчас сыграно: {savedGames.length}</div>
            <div style={{marginTop:SPACE[3]}}>
              <Btn variant="primary" onClick={()=>{sShowInsights(false);sTab("play");sSetup(true)}}>▶ Сыграть</Btn>
            </div>
          </Card>;
        }
        const ins:Insights=computeInsights(savedGames as any);
        const fmt=(wr:Insights["overall"])=>wr.total>0?`${wr.winPct}%·${wr.wins}В/${wr.draws}Н/${wr.losses}П`:"—";
        const formGlyph=(o:"W"|"L"|"D")=>o==="W"?"●":o==="L"?"●":"●";
        const formCol=(o:"W"|"L"|"D")=>o==="W"?CC.brand:o==="L"?CC.danger:CC.textDim;
        return <div style={{display:"flex",flexDirection:"column",gap:SPACE[3]}}>
          {/* Top stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))",gap:SPACE[2]}}>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Всего партий</div>
              <div style={{fontSize:24,fontWeight:900,color:CC.text}}>{ins.total}</div>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Win Rate</div>
              <div style={{fontSize:24,fontWeight:900,color:ins.overall.winPct>=50?CC.brand:CC.danger}}>{ins.overall.winPct}%</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>{ins.overall.wins}В · {ins.overall.draws}Н · {ins.overall.losses}П</div>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Форма</div>
              <div style={{display:"flex",gap:3,marginTop:6}}>
                {ins.recentForm.length===0?<span style={{fontSize:13,color:CC.textDim}}>—</span>:
                  ins.recentForm.map((o,i)=><span key={i} style={{color:formCol(o),fontSize:18,lineHeight:1}}>{formGlyph(o)}</span>)}
              </div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>последние 10</div>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Серия</div>
              <div style={{fontSize:18,fontWeight:900,color:ins.streaks.current.type==="win"?CC.brand:ins.streaks.current.type==="loss"?CC.danger:CC.textDim}}>
                {ins.streaks.current.type==="none"?"—":`${ins.streaks.current.length} ${ins.streaks.current.type==="win"?"побед":ins.streaks.current.type==="loss"?"пораж":"ничьих"}`}
              </div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>лучшая серия побед: {ins.streaks.longestWin}</div>
            </Card>
            <Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>Δ Рейтинг</div>
              <div style={{fontSize:24,fontWeight:900,color:ins.ratingDelta>=0?CC.brand:CC.danger}}>{ins.ratingDelta>=0?"+":""}{ins.ratingDelta}</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>среднее: {ins.avgGameLength} ходов</div>
            </Card>
          </div>

          {/* Color breakdown */}
          <Card padding={SPACE[3]} tone="surface1">
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>По цвету</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2]}}>
              <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:"#f8fafc",border:`1px solid ${CC.border}`}}>
                <div style={{fontSize:13,fontWeight:800,color:CC.text}}>♔ Белыми</div>
                <div style={{fontSize:18,fontWeight:900,color:ins.asWhite.winPct>=50?CC.brand:CC.danger,fontFamily:"ui-monospace, monospace"}}>{fmt(ins.asWhite)}</div>
                <div style={{height:6,borderRadius:RADIUS.full,overflow:"hidden",background:CC.surface3,marginTop:4,display:"flex"}}>
                  {ins.asWhite.total>0&&<><div style={{width:`${ins.asWhite.winPct}%`,background:CC.brand}}/><div style={{width:`${ins.asWhite.drawPct}%`,background:CC.textDim}}/><div style={{width:`${ins.asWhite.lossPct}%`,background:CC.danger}}/></>}
                </div>
              </div>
              <div style={{padding:SPACE[2],borderRadius:RADIUS.sm,background:"#1e293b",border:`1px solid ${CC.borderStrong}`,color:"#f1f5f9"}}>
                <div style={{fontSize:13,fontWeight:800,color:"#f1f5f9"}}>♚ Чёрными</div>
                <div style={{fontSize:18,fontWeight:900,color:ins.asBlack.winPct>=50?"#86efac":"#fca5a5",fontFamily:"ui-monospace, monospace"}}>{fmt(ins.asBlack)}</div>
                <div style={{height:6,borderRadius:RADIUS.full,overflow:"hidden",background:"#334155",marginTop:4,display:"flex"}}>
                  {ins.asBlack.total>0&&<><div style={{width:`${ins.asBlack.winPct}%`,background:"#10b981"}}/><div style={{width:`${ins.asBlack.drawPct}%`,background:"#94a3b8"}}/><div style={{width:`${ins.asBlack.lossPct}%`,background:"#ef4444"}}/></>}
                </div>
              </div>
            </div>
          </Card>

          {/* Best & Kryptonite */}
          {(ins.bestOpening||ins.kryptonite)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2]}}>
            {ins.bestOpening&&<Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#ecfdf5,#d1fae5)",borderColor:"#6ee7b7"}}>
              <div style={{fontSize:10,color:"#047857",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>★ Твоё лучшее</div>
              <div style={{fontSize:15,fontWeight:900,color:CC.text,marginTop:4,lineHeight:1.3}}>{ins.bestOpening.name}</div>
              <div style={{fontSize:13,color:"#047857",fontFamily:"ui-monospace, monospace",marginTop:2}}>{ins.bestOpening.winPct}% · {ins.bestOpening.total} партий</div>
            </Card>}
            {ins.kryptonite&&<Card padding={SPACE[3]} tone="surface1" style={{background:"linear-gradient(135deg,#fef2f2,#fee2e2)",borderColor:"#fca5a5"}}>
              <div style={{fontSize:10,color:"#991b1b",fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>☠ Криптонит</div>
              <div style={{fontSize:15,fontWeight:900,color:CC.text,marginTop:4,lineHeight:1.3}}>{ins.kryptonite.name}</div>
              <div style={{fontSize:13,color:"#991b1b",fontFamily:"ui-monospace, monospace",marginTop:2}}>{ins.kryptonite.winPct}% · {ins.kryptonite.total} партий</div>
            </Card>}
          </div>}

          {/* By format */}
          <Card padding={SPACE[3]} tone="surface1">
            <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const,marginBottom:SPACE[2]}}>По формату</div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(["Bullet","Blitz","Rapid","Classical"] as const).map(cat=>{
                const wr=ins.byCategory[cat];
                if(wr.total===0)return null;
                const catCol={Bullet:"#dc2626",Blitz:"#f59e0b",Rapid:"#10b981",Classical:"#3b82f6"}[cat];
                return <div key={cat} style={{display:"flex",alignItems:"center",gap:SPACE[2]}}>
                  <span style={{minWidth:80,fontSize:12,fontWeight:800,color:catCol}}>{cat}</span>
                  <div style={{flex:1,height:8,borderRadius:RADIUS.full,overflow:"hidden",background:CC.surface3,display:"flex"}}>
                    <div style={{width:`${wr.winPct}%`,background:CC.brand}}/>
                    <div style={{width:`${wr.drawPct}%`,background:CC.textDim}}/>
                    <div style={{width:`${wr.lossPct}%`,background:CC.danger}}/>
                  </div>
                  <span style={{minWidth:120,fontSize:12,fontFamily:"ui-monospace, monospace",color:CC.text,textAlign:"right"}}>{fmt(wr)}</span>
                </div>;
              })}
            </div>
            {ins.timePressure.pctGamesLostOnTime>0&&<div style={{marginTop:SPACE[2],padding:SPACE[2],borderRadius:RADIUS.sm,background:"#fffbeb",border:`1px solid #fcd34d`,fontSize:12,color:"#92400e"}}>
              ⏰ Поражения по времени: <b>{ins.timePressure.pctGamesLostOnTime}%</b> от всех партий
            </div>}
          </Card>

          {/* Openings detail */}
          {ins.openings.length>0&&<Card padding={0} tone="surface1">
            <div style={{padding:`${SPACE[2]}px ${SPACE[3]}px`,borderBottom:`1px solid ${CC.border}`}}>
              <div style={{fontSize:11,fontWeight:900,color:CC.textDim,letterSpacing:1,textTransform:"uppercase" as const}}>Все дебюты ({ins.openings.length})</div>
            </div>
            <div style={{maxHeight:240,overflowY:"auto"}}>
              {ins.openings.map((o,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:SPACE[2],padding:"6px 12px",borderBottom:`1px solid ${CC.border}`,fontSize:12}}>
                  <span style={{flex:1,fontWeight:700,color:CC.text}}>{o.name}</span>
                  <span style={{minWidth:60,textAlign:"right",fontFamily:"ui-monospace, monospace",color:o.winPct>=50?CC.brand:CC.danger,fontWeight:800}}>{o.winPct}%</span>
                  <span style={{minWidth:80,textAlign:"right",fontFamily:"ui-monospace, monospace",color:CC.textDim}}>{o.wins}В/{o.draws}Н/{o.losses}П</span>
                </div>
              ))}
            </div>
          </Card>}

          {/* Highlights */}
          {(ins.longestWin||ins.shortestLoss)&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:SPACE[2]}}>
            {ins.longestWin&&<Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>🏆 Самая длинная победа</div>
              <div style={{fontSize:14,fontWeight:800,color:CC.text,marginTop:2}}>{ins.longestWin.moves} ходов</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>{ins.longestWin.opening}</div>
            </Card>}
            {ins.shortestLoss&&<Card padding={SPACE[2]} tone="surface1">
              <div style={{fontSize:10,color:CC.textDim,fontWeight:800,letterSpacing:1,textTransform:"uppercase" as const}}>💀 Самое быстрое поражение</div>
              <div style={{fontSize:14,fontWeight:800,color:CC.danger,marginTop:2}}>{ins.shortestLoss.moves} ходов</div>
              <div style={{fontSize:11,color:CC.textDim,marginTop:2}}>{ins.shortestLoss.opening}</div>
            </Card>}
          </div>}
        </div>;
      })()}
    </Modal>

    </ProductPageShell>
    <MusicPlayer open={showMusicPlayer} onClose={()=>sShowMusicPlayer(false)}/>
    {/* Drag ghost is now an IMPERATIVE DOM node managed by useBoardInput.
        document.createElement → document.body.appendChild → direct transform on
        pointermove. Bypasses React entirely so the ghost follows the cursor with
        zero render lag (lichess / chess.com architecture). The source-cell hide
        is still driven by the ghostFrom React state below. */}
    <BoardDebugHud boardRef={boardRef} ghostRef={ghostRef} ghostFrom={ghostFrom} dragHover={dragHover}/>
    <WorkspaceDock chessyBalance={chessy.balance} onOpenDailyModal={()=>sTab("puzzles")} onOpenChessyShop={()=>sShowShop(true)}/>

    {/* ─── Move annotation picker (right-click on move in Analysis) ─── */}
    {annotPicker&&<>
      <div style={{position:"fixed",inset:0,zIndex:290}} onClick={()=>sAnnotPicker(null)} onContextMenu={e=>{e.preventDefault();sAnnotPicker(null)}}/>
      <div style={{
        position:"fixed",left:annotPicker.x,top:annotPicker.y,zIndex:291,
        background:"#fff",borderRadius:RADIUS.lg,border:`1px solid ${CC.border}`,
        boxShadow:SHADOW.lg,padding:SPACE[2],
        display:"flex",flexDirection:"column",gap:SPACE[1],minWidth:130,
      }}>
        <div style={{fontSize:9,fontWeight:900,letterSpacing:1,color:CC.textDim,textTransform:"uppercase" as const,padding:"0 4px"}}>Аннотация</div>
        {ANNOT_SYMS.map(a=><button key={a.s} onClick={()=>{
          sMoveAnnotations(prev=>({...prev,[annotPicker.ply]:prev[annotPicker.ply]===a.s?"":a.s}));
          sAnnotPicker(null);
          showToast(`${a.s} — ${a.t}`,"info");
        }} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:RADIUS.sm,border:"none",background:"transparent",cursor:"pointer",fontSize:12,width:"100%",textAlign:"left"}}
          onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=CC.surface2}
          onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}>
          <span style={{fontWeight:900,color:a.c,minWidth:22,fontSize:13}}>{a.s}</span>
          <span style={{color:CC.textDim}}>{a.t}</span>
        </button>)}
        <div style={{borderTop:`1px solid ${CC.border}`,paddingTop:SPACE[1],marginTop:SPACE[1]}}>
          <button onClick={()=>{
            sMoveAnnotations(prev=>{const n={...prev};delete n[annotPicker.ply];return n});
            sAnnotPicker(null);
          }} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:RADIUS.sm,border:"none",background:"transparent",cursor:"pointer",fontSize:11,width:"100%",color:CC.textDim,textAlign:"left"}}
            onMouseEnter={e=>(e.currentTarget as HTMLButtonElement).style.background=CC.surface2}
            onMouseLeave={e=>(e.currentTarget as HTMLButtonElement).style.background="transparent"}>
            ✕ Снять аннотацию
          </button>
        </div>
      </div>
    </>}

    {/* Command palette (Ctrl/Cmd+K) — fuzzy-search any action, exec on Enter. */}
    <CommandPalette open={palOpen} onClose={()=>sPalOpen(false)} commands={(()=>{
      const cmds:PaletteCommand[]=[
        // ── PLAY ──
        {id:"play-quick",   icon:"▶",  group:"Play", label:"Быстрая игра",        hint:"Quick start с текущими настройками",       hotkey:"N", run:()=>{sHotseat(false);sRivalMode(false);sTab("play");newG()}},
        {id:"play-matchme", icon:"⚡", group:"Play", label:"Match Me",             hint:"AI под мой рейтинг",                        run:()=>{const ti=rat<600?0:rat<900?1:rat<1300?2:rat<1700?3:rat<2100?4:5;const c=(chessy.owned.master_ai||isPro)?ti:Math.min(ti,4);sAiI(c);sHotseat(false);sRivalMode(false);sTab("play");setTimeout(()=>newG(),50)}},
        {id:"play-hotseat", icon:"👥", group:"Play", label:"Vs Человек (Hotseat)", hint:"Один экран · два игрока",                   run:()=>{sHotseat(true);sRivalMode(false);sTab("play");setTimeout(()=>newG(),50)}},
        {id:"play-variants",icon:"🎲", group:"Play", label:"Выбрать вариант шахмат",hint:"Fischer 960 / Atomic / Crazyhouse / +9",   run:()=>sShowVariants(true)},
        {id:"play-tournament",icon:"🏆",group:"Play",label:"Турнир",                hint:"Свисс / Round-Robin",                       run:()=>sShowTournament(true)},

        // ── PUZZLES ──
        {id:"pz-random",    icon:"◆", group:"Puzzles", label:"Случайная задача",  hint:`Из ${PUZZLES.length.toLocaleString()} тактических`, run:()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
        {id:"pz-rush",      icon:"⚡",group:"Puzzles", label:"Puzzle Rush",        hint:"Решай как можно больше за время",           run:()=>{sTab("puzzles");sPzMode("rush");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
        {id:"pz-3min",      icon:"⏱", group:"Puzzles", label:"3-минутный режим",  hint:"Реши как можно больше за 3 мин · +3с за каждый верный ответ", run:()=>{sTab("puzzles");sPzMode("timed3");if(PUZZLES.length&&!pzCurrent)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
        {id:"pz-5min",      icon:"⏱", group:"Puzzles", label:"5-минутный режим",  hint:"300 секунд на одну задачу",                 run:()=>{sTab("puzzles");sPzMode("timed5");if(PUZZLES.length&&!pzCurrent)ldPz(Math.floor(Math.random()*PUZZLES.length))}},
        {id:"pz-lichess",   icon:"🌐",group:"Puzzles", label:"Lichess Daily Puzzle",hint:"Задача дня с lichess.org (live)",          run:async()=>{
          if(lichessLoading)return;sLichessLoading(true);showToast("⏳ Загружаю Lichess Daily…","info");
          try{
            const r=await fetch("https://lichess.org/api/puzzle/daily",{headers:{Accept:"application/json"}});
            if(!r.ok)throw new Error(`HTTP ${r.status}`);
            const j=await r.json();
            const ch=new Chess();const pgnTokens=String(j?.game?.pgn||"").trim().split(/\s+/).filter(Boolean);
            const ply=Number(j?.puzzle?.initialPly||0);
            for(let i=0;i<ply&&i<pgnTokens.length;i++){try{ch.move(pgnTokens[i])}catch{break}}
            const sols:string[]=Array.isArray(j?.puzzle?.solution)?j.puzzle.solution:[];
            if(!sols.length)throw new Error("no solution");
            const first=sols[0];const probe=new Chess(ch.fen());
            const mv=probe.move({from:first.slice(0,2),to:first.slice(2,4),promotion:first.slice(4)||undefined});
            if(!mv)throw new Error("solution invalid");
            const fakePz:Puzzle={name:`Lichess Daily · ${j?.puzzle?.id||"?"}`,r:Number(j?.puzzle?.rating)||1500,theme:(j?.puzzle?.themes?.[0]||"tactics") as any,phase:"Middlegame",side:ch.turn() as "w"|"b",goal:"Best move",mateIn:0,fen:ch.fen(),sol:[mv.san]};
            sTab("puzzles");setGame(new Chess(fakePz.fen));sBk(k=>k+1);sPzCurrent(fakePz);sPzAttempt("idle");sLm(null);sSel(null);sVm(new Set());sHist([]);sFenHist([fakePz.fen]);sPCol(fakePz.side as any);sFlip(fakePz.side==="b");sOn(true);
            showToast(`🌐 Lichess Daily · rating ${fakePz.r}`,"success");
          }catch(e:any){showToast(`Lichess недоступен: ${e?.message||"network"}`,"error")}finally{sLichessLoading(false)}
        }},

        // ── COACH / TRAINING ──
        {id:"coach",        icon:"🎓",group:"Coach",   label:"Открыть Coach",      hint:"AI-наставник + база знаний 90+ тем",         run:()=>sTab("coach")},
        {id:"coach-knowledge",icon:"📚",group:"Coach", label:"Coach Knowledge",   hint:"9 категорий · дебюты / тактика / эндшпиль / время / память / roadmap",  run:()=>{sTab("coach");setTimeout(()=>sShowKnowledge(true),50)}},
        {id:"coach-lessons",  icon:"📖",group:"Coach", label:"Coach Lessons (Курс)", hint:"14 уроков beginner→advanced с теорией+позициями+упражнениями", run:()=>{sTab("coach");setTimeout(()=>sShowLessons(true),50)}},
        {id:"coord-trainer",icon:"🎯",group:"Coach",   label:"Координаты",         hint:"Тренировка чтения доски (30 сек)",          run:()=>{sShowCoord(true);sCoordSession(null);sCoordResult(null);sCoordLB(coordLoadLB())}},
        {id:"opening",      icon:"📖",group:"Coach",   label:"Opening Trainer",   hint:"Дрилл дебютов до автоматизма",              run:()=>sShowOpeningTrainer(true)},
        {id:"editor",       icon:"♟",group:"Coach",   label:"Position Editor",   hint:"FEN · ручная расстановка",                  run:()=>{sShowEditor(true);sEditorBoard(edStart());sEditorErrors([])}},

        // ── ANALYSIS ──
        {id:"analysis",     icon:"▲", group:"Analysis", label:"Открыть Анализ",   hint:"Eval bar + Opening Explorer",               run:()=>{sTab("analysis");sShowAnal(true)}},
        {id:"masters",      icon:"★", group:"Analysis", label:"Партии классиков",hint:"Capablanca / Tal / Carlsen · режим «угадай»",run:()=>{sShowMasters(true);sMasterCurrent(null);sMasterMode("replay")}},
        {id:"game-dna",     icon:"🧬",group:"Analysis", label:"Game DNA",         hint:"Стиль игры из последних партий",            run:()=>sShowGameDna(true)},
        {id:"insights",     icon:"🔬",group:"Analysis", label:"Insights",         hint:"Слабости и сильные стороны",                run:()=>sShowInsights(true)},
        {id:"share-fen",    icon:"🔗",group:"Analysis", label:"Поделиться позицией (FEN)",hint:"Скопировать ссылку с текущей позицией",hotkey:"S",run:()=>{
          try{const fen=game.fen();const url=`${window.location.origin}/cyberchess?fen=${encodeURIComponent(fen)}`;
            navigator.clipboard?.writeText(url).then(()=>showToast("📋 Ссылка скопирована","success"),()=>showToast(`FEN: ${fen}`,"info"));
          }catch{showToast("Не удалось","error")}
        }},

        // ── WORKSPACE ──
        {id:"ws-focus",     icon:"◻", group:"Workspace", label:"Focus — только доска",       hotkey:"1", run:()=>{sWsPreset("focus");showToast("Workspace: focus","info")}},
        {id:"ws-standard",  icon:"▦", group:"Workspace", label:"Standard — доска + панель", hotkey:"2", run:()=>{sWsPreset("standard");showToast("Workspace: standard","info")}},
        {id:"ws-stream",    icon:"▶", group:"Workspace", label:"Stream — + YouTube/Twitch", hotkey:"3", run:()=>{sWsPreset("stream");showToast("Workspace: stream","info")}},
        {id:"ws-study",     icon:"✎", group:"Workspace", label:"Study — + multipv",         hotkey:"4", run:()=>{sWsPreset("study");showToast("Workspace: study","info")}},
        {id:"ws-coach",     icon:"🎓",group:"Workspace", label:"Coach — + предсказания AI", hotkey:"5", run:()=>{sWsPreset("coach");showToast("Workspace: coach","info")}},

        // ── BOARD / GAME ──
        {id:"flip",         icon:"⇅", group:"Board", label:"Перевернуть доску",   hotkey:"F", run:()=>sFlip(v=>!v)},
        {id:"mute",         icon:"🔇",group:"Board", label:"Mute / unmute звук", hotkey:"M", run:()=>sMuted(v=>{const nv=!v;showToast(nv?"Muted":"Sound on","info");return nv})},
        {id:"repertoire",   icon:"📚",group:"Board", label:"Репертуар дебютов",  hotkey:"R", run:()=>sRepertoireOpen(v=>!v)},
        {id:"hotkeys",      icon:"⌨", group:"Board", label:"Все горячие клавиши",hotkey:"?", run:()=>sShowHelp(v=>!v)},
        {id:"bookmark-save",icon:"⭐",group:"Board", label:"Сохранить позицию (закладка)",hint:"Текущий FEN в закладки",hotkey:"B", run:()=>{
          try{const fen=game.fen();if(bookmarks.some(b=>b.fen===fen)){showToast("⭐ Уже в закладках","info")}else{const next=addBookmark(bookmarks,fen);sBookmarks(next);showToast(`⭐ Сохранено · всего ${next.length}`,"success")}}catch{showToast("Ошибка","error")}
        }},
        {id:"hint",         icon:"💡",group:"Board", label:"Показать лучший ход",hint:tab==="analysis"?"Free в Анализе · 3-сек ghost-стрелка":"5 Chessy · 3-сек ghost-стрелка",hotkey:"H", run:()=>{
          if(!sfR.current?.ready()){showToast("Stockfish не готов","error");return}
          if(over){showToast("Партия закончена","info");return}
          const charged=tab==="play"&&on&&!over;
          if(charged&&!spendChessy(5,"подсказка хода"))return;
          showToast(charged?"💡 Считаю лучший ход (-5 Chessy)":"💡 Считаю лучший ход","info");
          try{
            sfR.current.go(game.fen(),12,(f,t)=>{
              if(!f||!t){showToast("Не нашёл хода","error");return}
              sArrows([{from:f as Square,to:t as Square,c:"#22c55e"}]);
              window.setTimeout(()=>sArrows(a=>a.filter(x=>!(x.from===f&&x.to===t))),3000);
            });
          }catch{showToast("Ошибка движка","error")}
        }},

        // ── SETTINGS ──
        {id:"shop",         icon:"💰",group:"Settings", label:"Магазин Chessy",       hint:`Баланс: ${chessy.balance}`,    run:()=>sShowShop(true)},
        {id:"streamer",     icon:"📺",group:"Settings", label:"Streamer Mode toggle", hint:"OBS-ready dark UI",            run:()=>{sStreamerMode(v=>!v);showToast(streamerMode?"Обычный режим":"Streamer mode ON","info")}},
        {id:"multi-panel",  icon:"📺",group:"Settings", label:"Multi-Panel split",    hint:"4 окна с YouTube/Twitch",      run:()=>sShowMultiPanel(true)},
      ];
      // ── BOOKMARKS — dynamic per-position commands. Each saved FEN gets its own
      //    "Открыть закладку: <label>" entry. Plus a delete-all utility at the end.
      for(const bm of bookmarks){
        cmds.push({
          id:`bookmark-${bm.id}`,
          icon:"⭐",
          group:"Bookmarks",
          label:`Открыть: ${bm.label}`,
          hint:bm.note||new Date(bm.ts).toLocaleDateString("ru-RU"),
          run:()=>{
            try{
              const ch=new Chess(bm.fen);
              setGame(ch);sBk(k=>k+1);sHist([]);sFenHist([ch.fen()]);sLm(null);sSel(null);sVm(new Set());sOver(null);sOn(false);sSetup(false);sTab("analysis");sBrowseIdx(-1);sPCol(ch.turn());sFlip(ch.turn()==="b");
              showToast(`⭐ ${bm.label}`,"success");
            }catch{showToast("Закладка повреждена","error")}
          },
        });
      }
      if(bookmarks.length>0){
        cmds.push({
          id:"bookmarks-clear",
          icon:"🗑",
          group:"Bookmarks",
          label:"Очистить все закладки",
          hint:`Удалить ${bookmarks.length} сохранённых позиций`,
          run:()=>{
            if(typeof window!=="undefined"&&!window.confirm(`Удалить все ${bookmarks.length} закладок?`))return;
            sBookmarks([]);try{localStorage.removeItem("aevion_chess_bookmarks_v1")}catch{}showToast("Закладки очищены","info");
          },
        });
      }
      return cmds;
    })()}/>
    {/* Live rating-delta chip — appears top-right when rat changes (after a game) */}
    {ratDelta&&<div key={ratDelta.ts} style={{
      position:"fixed",top:80,right:60,
      zIndex:8500,pointerEvents:"none",
      padding:"10px 18px",borderRadius:999,
      background:ratDelta.d>0?"linear-gradient(135deg,#059669,#10b981)":"linear-gradient(135deg,#dc2626,#ef4444)",
      color:"#fff",fontWeight:900,fontSize:16,
      boxShadow:ratDelta.d>0?"0 8px 24px rgba(5,150,105,0.45)":"0 8px 24px rgba(220,38,38,0.45)",
      animation:"fadeInUp 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards",
      display:"inline-flex",alignItems:"center",gap:8,
    }}>
      <span style={{fontSize:18}}>{ratDelta.d>0?"▲":"▼"}</span>
      <span>{ratDelta.d>0?"+":""}{ratDelta.d}</span>
      <span style={{opacity:0.85,fontSize:12,fontWeight:700,paddingLeft:8,borderLeft:"1px solid rgba(255,255,255,0.35)"}}>rating {ratDelta.newRat}</span>
    </div>}
    </main>);
}