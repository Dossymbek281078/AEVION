"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import Piece from "./Pieces";
import AiCoach from "./AiCoach";

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
  go(fen:string,d:number,cb:(f:string,t:string,p?:string)=>void,ecb?:(cp:number,mate:number)=>void){if(!this.w)return cb("","");this.cb=cb;this.ecb=ecb||null;this.mpvCb=null;this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  eval(fen:string,d:number,ecb:(cp:number,mate:number)=>void,done:()=>void){if(!this.w)return done();this.cb=()=>done();this.ecb=ecb;this.mpvCb=null;this.w.postMessage("setoption name MultiPV value 1");this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  multiPV(fen:string,d:number,pvCount:number,cb:(lines:PVLine[])=>void){if(!this.w)return cb([]);this.cb=null;this.ecb=null;this.mpvCb=cb;this.mpvLines=[];this.w.postMessage(`setoption name MultiPV value ${pvCount}`);this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}}

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
function snd(t:string){try{
  const x=new AudioContext(),n=x.currentTime;
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

/* ═══ Timer ═══ */
function useTimer(ini:number,inc:number,act:boolean,onT:()=>void){const[t,sT]=useState(ini);const r=useRef<any>(null);useEffect(()=>{sT(ini)},[ini]);useEffect(()=>{if(r.current)clearInterval(r.current);if(act&&ini>0){r.current=setInterval(()=>sT(v=>{if(v<=1){clearInterval(r.current);onT();return 0}return v-1}),1000)}return()=>{if(r.current)clearInterval(r.current)}},[act,ini>0]);return{time:t,addInc:useCallback(()=>{if(inc>0)sT(v=>v+inc)},[inc]),reset:useCallback(()=>sT(ini),[ini])}}
function fmt(s:number){return s<=0?"0:00":`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}
function pc(t:PieceSymbol,c:ChessColor){return PM[`${c}${t}`]||"?"}

/* ═══ Theme ═══ */
const T={bg:"#f3f4f6",surface:"#fff",border:"#e5e7eb",text:"#111827",dim:"#6b7280",accent:"#059669",gold:"#d97706",danger:"#dc2626",blue:"#2563eb",purple:"#7c3aed",sel:"rgba(5,150,105,0.45)",valid:"rgba(5,150,105,0.35)",cap:"rgba(220,38,38,0.35)",last:"rgba(217,119,6,0.25)",chk:"rgba(220,38,38,0.55)",pm:"rgba(37,99,235,0.35)",pmS:"rgba(37,99,235,0.5)"};

type BoardTheme = {name:string;light:string;dark:string;border:string;icon:string};
const BOARD_THEMES: BoardTheme[] = [
  {name:"Classic",light:"#f0d9b5",dark:"#b58863",border:"#b58863",icon:"♟"},
  {name:"Emerald",light:"#eeeed2",dark:"#769656",border:"#769656",icon:"🌿"},
  {name:"Ocean",light:"#dee3e6",dark:"#5b8baf",border:"#4a7a9b",icon:"🌊"},
  {name:"Purple",light:"#e8dff0",dark:"#9370ab",border:"#7b5e99",icon:"💜"},
  {name:"Wood",light:"#e6c89c",dark:"#a0724a",border:"#8b5e3c",icon:"🪵"},
  {name:"Dark",light:"#b0b0b0",dark:"#555555",border:"#444444",icon:"🌑"},
  {name:"Ice",light:"#e8f4f8",dark:"#7eb8d0",border:"#5a9ab5",icon:"❄️"},
  {name:"Rose",light:"#f5e6e0",dark:"#c47a6c",border:"#b06858",icon:"🌹"},
];

/* ═══ Component ═══ */
export default function CyberChessPage(){
  const{showToast}=useToast();
  const[game,setGame]=useState(()=>new Chess());
  const[bk,sBk]=useState(0);
  const[boardTheme,sBoardTheme]=useState(()=>{try{const v=parseInt(localStorage.getItem("aevion_chess_theme_v1")||"0");return isNaN(v)||v<0||v>=8?0:v}catch{return 0}});
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

  useEffect(()=>{sRat(ldR());sSts(ldS());sSavedGames(loadGames());
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
  // Live eval on position change - for play/coach/analysis tabs
  useEffect(()=>{
    if(setup||!sfR.current?.ready())return;
    if(tab!=="analysis"&&tab!=="play"&&tab!=="coach")return;
    // In play/coach respect over state (game ended), but in analysis keep evaluating
    if(tab!=="analysis"&&over)return;
    // Don't eval during AI thinking (Stockfish busy computing move)
    if(tab!=="analysis"&&think)return;
    sfR.current.eval(game.fen(),15,(cp,mate)=>{
      const sign=game.turn()==="w"?1:-1;
      sEvalCp(cp*sign);sEvalMate(mate*sign);
    },()=>{});
  },[bk,tab,setup,think,over]);

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
                sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");showToast(`✓ Решено! ${pzCurrent.name}`,"success");
              }
            }catch{}
          },100); // fast response, no thinking delay
        }else{
          // Single-move puzzle — solved
          sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");showToast(`✓ Решено! ${pzCurrent.name}`,"success");
        }
        return true;
      }else{
        sPzAttempt("wrong");sPzFailedCount(c=>c+1);snd("capture");showToast(`✗ Not the best. Try again or see solution`,"error");
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
      if(game.isCheckmate()){const w=game.turn()===aiC;r=w?"Checkmate! You win! 🏆":"Checkmate — AI wins";
        if(w){const nr=Math.min(3000,rat+Math.max(5,Math.round((lv.elo-rat)*0.1+15)));sRat(nr);svR(nr);const ns={...sts,w:sts.w+1};sSts(ns);svS(ns);showToast(`+${nr-rat} rating`,"success")}
        else{const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns)}}
      else{r=game.isStalemate()?"Stalemate":game.isThreefoldRepetition()?"Threefold repetition":game.isInsufficientMaterial()?"Insufficient material":"50-move draw";const ns={...sts,d:sts.d+1};sSts(ns);svS(ns)}
      sOver(r);snd("x");sOn(false);sPms([]);
      // Save to history
      const cat=tc.ini<=0?"Classical":tc.ini<=120?"Bullet":tc.ini<=300?"Blitz":tc.ini<=900?"Rapid":"Classical";
      const sg:SavedGame={id:Date.now().toString(36),date:new Date().toISOString(),moves:[...hist,mv.san],result:r,playerColor:pCol,aiLevel:lv.name,rating:rat,tc:`${Math.floor(tc.ini/60)}+${tc.inc}`,category:cat as any,opening:currentOpening?.name};
      saveGame(sg);sSavedGames(loadGames())}
    return true},[game,rat,lv.elo,pCol,aiC,pT,aT,showToast,bk,sts,tab,pzCurrent,pzAttempt,guessMode,guessResult,guessBest,guessBestSan]);

  /* ── Premove execution ── */
  const doPremove=useCallback(()=>{
    if(game.turn()!==pCol||over||!pms.length)return;
    // Skip invalid premoves at the head of the queue until we find a valid one
    const mvs=game.moves({verbose:true});
    let idx=0;
    while(idx<pms.length){
      const pm=pms[idx];
      const ok=mvs.find(m=>m.from===pm.from&&m.to===pm.to);
      if(ok){
        const rest=pms.slice(idx+1);
        sPms(rest);
        exec(pm.from,pm.to,pm.pr);
        snd("premove");
        return;
      }
      idx++;
    }
    // None of the premoves is valid → clear all
    sPms([]);
  },[game,over,pms,pCol,exec]);
  const doPremoveRef=useRef(doPremove);
  useEffect(()=>{doPremoveRef.current=doPremove},[doPremove]);

  /* ── Esc key: clear all premoves ── */
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){
        if(pms.length>0||pmSel){sPms([]);sPmSel(null)}
      }
      // Arrow key navigation through moves (when not typing in input)
      const target=e.target as HTMLElement;
      if(target?.tagName==="INPUT"||target?.tagName==="TEXTAREA"||target?.tagName==="SELECT")return;
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

  /* ── Premove trigger (fires instantly when it's player's turn) ── */
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(game.turn()!==pCol||pms.length===0)return;
    const t=setTimeout(()=>doPremoveRef.current(),20);
    return()=>clearTimeout(t);
  },[bk,over,on,tab,pms.length,pCol]);

  /* ── AI turn trigger ── */
  useEffect(()=>{
    if(over||!on||(tab!=="play"&&tab!=="coach"))return;
    if(game.turn()===pCol)return;
    sThink(true);
    const tcMul=tc.ini<=0?1:tc.ini<=60?0.3:tc.ini<=180?0.5:tc.ini<=300?0.7:tc.ini<=600?1:tc.ini<=900?1.5:2;const delay=lv.thinkMs*tcMul*(0.7+Math.random()*0.6);
    if(useSF&&sfR.current?.ready()){
      const t=setTimeout(()=>sfR.current!.go(game.fen(),SFD[aiI]||10,(f,t2,p)=>{if(f&&t2)exec(f as Square,t2 as Square,(p||undefined) as any);sThink(false)}),Math.max(800,delay));
      return()=>clearTimeout(t);
    }
    const t=setTimeout(()=>{const c=new Chess(game.fen());const b=best(c,lv.depth,lv.rand);if(b)exec(b.from as Square,b.to as Square,b.promotion as any);sThink(false)},delay);
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
    const isAiTurn=game.turn()!==pCol;
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
        if(selPiece?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.pr="q";
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

    // ── NORMAL MODE (your turn) ──
    if(think)return;
    const p=game.get(sq);
    // In analysis tab: play both sides freely (use whoever's turn it is)
    const sideToMove=tab==="analysis"?game.turn():pCol;
    if(sel){
      if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){sPromo({from:sel,to:sq});return}exec(sel,sq);return}
      if(p?.color===sideToMove){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)));return}
      sSel(null);sVm(new Set());return;
    }
    if(p?.color===sideToMove){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}
  },[game,sel,vm,over,think,pCol,exec,on,pmLim,tab,editorMode,editorPiece,editorTurn,showToast]);

  /* ── Drag ── */
  const dRef=useRef<Square|null>(null);
  const dS=(sq:Square)=>{const p=game.get(sq);const side=tab==="analysis"?game.turn():pCol;if(p?.color===side&&!over){dRef.current=sq;if(tab==="analysis"||game.turn()===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}else sPmSel(sq)}};
  const dD=(sq:Square)=>{if(!dRef.current)return;const f=dRef.current;dRef.current=null;
    if(tab!=="analysis"&&game.turn()!==pCol&&on&&!over){if(pms.length>=pmLim)return;const p=game.get(f);const pre:Pre={from:f,to:sq};if(p?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.pr="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}
    if(vm.has(sq)){const mp=game.get(f);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))sPromo({from:f,to:sq});else exec(f,sq)}else{sSel(null);sVm(new Set())}};

  const newG=(c?:ChessColor)=>{const cl=c||pCol;setGame(new Chess());sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([new Chess().fen()]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);sCurrentOpening(null);pT.reset();aT.reset();showToast(`Playing ${cl==="w"?"White":"Black"}`,"info")};
  const ldPz=(i:number)=>{if(!PUZZLES.length){showToast("Loading puzzles...","info");return}const pz=fPz[i]||PUZZLES[0];if(!pz){showToast("No puzzles match filter","error");return}const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(i);sPzCurrent(pz);sPzAttempt("idle");sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);pT.reset();aT.reset();
    // Set timer based on mode
    if(pzMode==="timed3")sPzTimeLeft(180);
    else if(pzMode==="timed5")sPzTimeLeft(300);
    else sPzTimeLeft(0);
    showToast(`${pz.name} · ${pz.theme} · ${pz.r}`,"info")};

  // Next puzzle helper
  const nextPz=useCallback(()=>{const nextIdx=(pzI+1)%Math.max(1,fPz.length);ldPz(nextIdx)},[pzI,fPz.length]);
  const randomPz=useCallback(()=>{if(!fPz.length)return;ldPz(Math.floor(Math.random()*fPz.length))},[fPz.length]);

  // Puzzle timer
  useEffect(()=>{
    if(tab!=="puzzles"||pzMode==="learn"||!pzCurrent||pzAttempt==="correct"||pzTimeLeft<=0)return;
    const t=setInterval(()=>sPzTimeLeft(v=>{
      if(v<=1){sPzFailedCount(c=>c+1);sPzAttempt("wrong");return 0}
      return v-1;
    }),1000);
    return()=>clearInterval(t);
  },[tab,pzMode,pzCurrent,pzAttempt,pzTimeLeft]);

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

  const pmSet=new Set<string>();pms.forEach(p=>{pmSet.add(p.from);pmSet.add(p.to)});
  // Virtual board: apply premoves to show ghost/shadow pieces at destinations
  const virtualGame=(()=>{
    if(pms.length===0)return game;
    try{
      const g=new Chess(game.fen());
      // Force turn to player color so premoves can be played
      for(const pm of pms){
        const fenParts=g.fen().split(" ");
        fenParts[1]=pCol;
        // Reset en passant & castling flags that might block
        try{g.load(fenParts.join(" "));}catch{}
        const from=g.get(pm.from);
        if(!from||from.color!==pCol)continue;
        // Try move, ignore if illegal
        try{g.move({from:pm.from,to:pm.to,promotion:pm.pr||"q"});}catch{}
      }
      return g;
    }catch{return game;}
  })();
  const bd=virtualGame.board(),rws=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cls=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

  const btn=(label:string,onClick:()=>void,bg:string,fg:string,border?:string)=>(<button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,border:border||`1px solid ${T.border}`,background:bg,color:fg,fontSize:13,fontWeight:700,cursor:"pointer"}}>{label}</button>);

  return(<main style={{background:T.bg,minHeight:"100vh"}}>
    <ProductPageShell maxWidth={2000}><Wave1Nav/>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#059669,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#fff"}}>♞</div>
          <div><div style={{fontSize:15,fontWeight:900,color:T.text}}>CyberChess</div><div style={{fontSize:14,color:T.dim}}>Stockfish 18 · {PUZZLES.length} puzzles{useSF&&sfOk?" · ⚡":""}</div></div>
        </div>
        <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:900,color:T.gold}}>{rat}</div><div style={{fontSize:14,color:T.dim}}>{rk.i} {rk.t}</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:14,background:T.surface,borderRadius:10,padding:3,width:"fit-content",border:`1px solid ${T.border}`}}>
        {(["play","puzzles","analysis","coach"] as const).map(t=><button key={t} onClick={()=>{
          const fromPuzzle=tab==="puzzles"&&pzCurrent;
          sTab(t);
          if(t==="play")sSetup(true);
          else if(t==="puzzles"){sOver(null);ldPz(0);}
          else if(t==="coach"){
            // Always start Coach with a fresh starting position — don't inherit from other tabs
            const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sPzCurrent(null);sPzAttempt("idle");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sOver(null);sOn(false);sSetup(false);sPms([]);sPmSel(null);sPCol("w");sFlip(false);
          }
          else if(t==="analysis"&&fromPuzzle){
            // Reset to starting position when coming from puzzle
            const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sPzCurrent(null);sPzAttempt("idle");sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol("w");sFlip(false);
          }
        }} style={{padding:"7px 16px",border:"none",borderRadius:7,background:tab===t?t==="analysis"?T.purple:t==="coach"?T.accent:T.accent:"transparent",color:tab===t?"#fff":T.dim,fontWeight:700,fontSize:14,cursor:"pointer"}}>{t==="play"?"Play":t==="puzzles"?"Puzzles":t==="analysis"?"⚡ Analysis":"🎓 Coach"}</button>)}
      </div>

      {/* LAUNCHPAD DASHBOARD */}
      {setup&&tab==="play"&&<div style={{marginBottom:16}}>
        {/* Category strip */}
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {(["Bullet","Blitz","Rapid"] as const).map(cat=>{
            const catColor={Bullet:"#dc2626",Blitz:"#f59e0b",Rapid:"#10b981",Classical:"#3b82f6"}[cat];
            const catTcs=TCS.map((t,i)=>({t,i})).filter(x=>x.t.cat===cat);
            return(<div key={cat} style={{flex:"1 1 280px",background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:14,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:catColor}}/>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                <div style={{width:8,height:8,borderRadius:4,background:catColor}}/>
                <div style={{fontSize:14,fontWeight:900,color:T.text,letterSpacing:"0.05em"}}>{cat.toUpperCase()}</div>
                <div style={{fontSize:13,color:T.dim,marginLeft:"auto"}}>{cat==="Bullet"?"< 3 min":cat==="Blitz"?"3-8 min":"10-15 min"}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>
                {catTcs.map(({t,i})=><button key={i} onClick={()=>{sTcI(i);sUseCustom(false)}} style={{padding:"10px 4px",borderRadius:8,border:!useCustom&&tcI===i?`2px solid ${catColor}`:`1px solid ${T.border}`,background:!useCustom&&tcI===i?`${catColor}15`:"#fff",color:!useCustom&&tcI===i?catColor:T.text,fontSize:13,fontWeight:!useCustom&&tcI===i?900:700,cursor:"pointer",fontFamily:"monospace"}}>{t.name}</button>)}
              </div>
            </div>);
          })}
          {/* Custom card */}
          <div style={{flex:"1 1 140px",background:T.surface,borderRadius:12,border:`1px solid ${T.border}`,padding:14,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:T.purple}}/>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
              <div style={{width:8,height:8,borderRadius:4,background:T.purple}}/>
              <div style={{fontSize:14,fontWeight:900,color:T.text,letterSpacing:"0.05em"}}>CUSTOM</div>
            </div>
            {showCustom?<div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14,color:T.dim,width:28}}>Min</span>
                <input type="number" min={1} max={60} value={customMin} onChange={e=>sCustomMin(Math.max(1,Math.min(60,+e.target.value||1)))} style={{flex:1,padding:"4px 8px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:14,width:"100%"}}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:14,color:T.dim,width:28}}>Inc</span>
                <input type="number" min={0} max={60} value={customInc} onChange={e=>sCustomInc(Math.max(0,Math.min(60,+e.target.value||0)))} style={{flex:1,padding:"4px 8px",borderRadius:6,border:`1px solid ${T.border}`,fontSize:14,width:"100%"}}/>
              </div>
              <button onClick={()=>{sUseCustom(true);sShowCustom(false)}} style={{padding:"6px",borderRadius:6,border:"none",background:T.purple,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"}}>Use {customMin}+{customInc}</button>
            </div>:<button onClick={()=>sShowCustom(true)} style={{width:"100%",padding:"16px 4px",borderRadius:8,border:useCustom?`2px solid ${T.purple}`:`1px dashed ${T.border}`,background:useCustom?`${T.purple}15`:"#fff",color:useCustom?T.purple:T.dim,fontSize:14,fontWeight:800,cursor:"pointer"}}>{useCustom?`${customMin}+${customInc}`:"⚙ Set..."}</button>}
          </div>
        </div>

        {/* Center preview card */}
        <div style={{background:"linear-gradient(135deg,#fff,#f9fafb)",borderRadius:14,border:`1px solid ${T.border}`,padding:20,marginBottom:12,boxShadow:"0 4px 14px rgba(0,0,0,0.04)"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:20,alignItems:"center"}}>
            {/* Preview left */}
            <div style={{flex:"1 1 220px"}}>
              <div style={{fontSize:13,color:T.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:4}}>FORMAT</div>
              <div style={{fontSize:36,fontWeight:900,color:T.text,fontFamily:"monospace",lineHeight:1,marginBottom:4}}>{tc.name}</div>
              <div style={{fontSize:13,color:T.dim}}>{tc.cat} · ~{Math.round(tc.ini/60*2+tc.inc*0.5)} min estimated</div>
            </div>
            {/* Color selector */}
            <div>
              <div style={{fontSize:13,color:T.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:4}}>COLOR</div>
              <div style={{display:"flex",gap:6}}>
                {([["w","♔"],["b","♚"]] as const).map(([v,ic])=><button key={v} onClick={()=>sPCol(v as ChessColor)} style={{width:44,height:44,borderRadius:10,border:pCol===v?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:pCol===v?"rgba(5,150,105,0.08)":"#fff",fontSize:22,cursor:"pointer",padding:0}}>{ic}</button>)}
                <button onClick={()=>sPCol(Math.random()<0.5?"w":"b")} style={{width:44,height:44,borderRadius:10,border:`1px dashed ${T.border}`,background:"#fff",fontSize:16,cursor:"pointer",color:T.dim}} title="Random">🎲</button>
              </div>
            </div>
            {/* AI opponent */}
            <div style={{flex:"1 1 260px"}}>
              <div style={{fontSize:13,color:T.dim,fontWeight:700,letterSpacing:"0.08em",marginBottom:4}}>OPPONENT · {lv.name} {lv.elo}</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="range" min={0} max={5} value={aiI} onChange={e=>sAiI(+e.target.value)} style={{flex:1,accentColor:lv.color}}/>
                <div style={{fontSize:13,fontWeight:900,color:lv.color,minWidth:70,textAlign:"right"}}>{lv.name}{aiI>=3?" ⚡":""}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>newG()} style={{flex:"2 1 240px",padding:"14px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${T.accent},#10b981)`,color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 4px 12px rgba(5,150,105,0.3)"}}>▶ Quick Start</button>
          <button onClick={()=>{
            // Match Me: pick AI level close to user rating
            const targetIdx=rat<600?0:rat<900?1:rat<1300?2:rat<1700?3:rat<2100?4:5;
            sAiI(targetIdx);
            setTimeout(()=>newG(),50);
          }} style={{flex:"1 1 160px",padding:"14px",borderRadius:12,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontWeight:800,fontSize:13,cursor:"pointer"}}>⚡ Match Me<div style={{fontSize:13,color:T.dim,fontWeight:600,marginTop:2}}>AI ≈ {rat} ELO</div></button>
          <button onClick={()=>sShowCustom(!showCustom)} style={{flex:"1 1 140px",padding:"14px",borderRadius:12,border:`1px solid ${T.border}`,background:T.surface,color:T.text,fontWeight:800,fontSize:13,cursor:"pointer"}}>⚙ Custom Time</button>
        </div>

        {/* Premove Queue — slider 1..20 */}
        <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{fontSize:14,color:T.dim,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>⚡ Premove Queue</div>
          <input type="range" min={1} max={20} value={pmLim} onChange={e=>sPmLim(+e.target.value)} style={{flex:1,minWidth:140,accentColor:T.accent}}/>
          <div style={{fontSize:15,fontWeight:900,color:T.accent,minWidth:32,textAlign:"center"}}>{pmLim}</div>
          <div style={{fontSize:13,color:T.dim,flex:"1 1 180px"}}>{pmLim===1?"1 ход · как Lichess":pmLim>=15?`${pmLim} ходов · как Chess.com`:`${pmLim} ходов в очереди`}</div>
          <div style={{fontSize:13,color:T.dim,flex:"1 1 100%",marginTop:2,fontStyle:"italic"}}>ПКМ — отменить последний · Esc — отменить все</div>
        </div>

        {/* Board Theme Selector */}
        <div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,padding:12}}>
          <div style={{fontSize:14,color:T.dim,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase" as const,marginBottom:8}}>Board Theme</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {BOARD_THEMES.map((th,i)=>(
              <button key={i} onClick={()=>sBoardTheme(i)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:boardTheme===i?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:boardTheme===i?"rgba(5,150,105,0.06)":"#fff",cursor:"pointer"}}>
                <div style={{width:20,height:20,borderRadius:4,overflow:"hidden",display:"flex",flexShrink:0}}>
                  <div style={{width:10,height:20,background:th.light}}/>
                  <div style={{width:10,height:20,background:th.dark}}/>
                </div>
                <span style={{fontSize:14,fontWeight:boardTheme===i?800:600,color:boardTheme===i?T.text:T.dim}}>{th.name}</span>
              </button>))}
          </div>
        </div>

        {/* Dashboard Widgets */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {/* Rating Widget */}
          <div style={{flex:"1 1 160px",background:"linear-gradient(135deg,#fff,#f9fafb)",borderRadius:12,border:`1px solid ${T.border}`,padding:16,textAlign:"center"}}>
            <div style={{fontSize:13,color:T.dim,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Rating</div>
            <div style={{fontSize:32,fontWeight:900,color:T.gold,lineHeight:1}}>{rat}</div>
            <div style={{fontSize:13,color:T.dim,marginTop:2}}>{rk.i} {rk.t}</div>
            <div style={{display:"flex",justifyContent:"center",gap:12,marginTop:8}}>
              <div><span style={{fontSize:14,fontWeight:900,color:T.accent}}>{sts.w}</span><div style={{fontSize:8,color:T.dim}}>W</div></div>
              <div><span style={{fontSize:14,fontWeight:900,color:T.danger}}>{sts.l}</span><div style={{fontSize:8,color:T.dim}}>L</div></div>
              <div><span style={{fontSize:14,fontWeight:900,color:T.dim}}>{sts.d}</span><div style={{fontSize:8,color:T.dim}}>D</div></div>
            </div>
          </div>
          {/* Win Rate Widget */}
          <div style={{flex:"1 1 160px",background:"linear-gradient(135deg,#fff,#f9fafb)",borderRadius:12,border:`1px solid ${T.border}`,padding:16,textAlign:"center"}}>
            <div style={{fontSize:13,color:T.dim,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Win Rate</div>
            {(sts.w+sts.l+sts.d)>0?<>
              <div style={{fontSize:32,fontWeight:900,color:Math.round(sts.w/(sts.w+sts.l+sts.d)*100)>=50?T.accent:T.danger,lineHeight:1}}>{Math.round(sts.w/(sts.w+sts.l+sts.d)*100)}%</div>
              <div style={{fontSize:14,color:T.dim,marginTop:2}}>{sts.w+sts.l+sts.d} games played</div>
              {/* Mini bar */}
              <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",marginTop:8,background:"#f3f4f6"}}>
                <div style={{width:`${sts.w/(sts.w+sts.l+sts.d)*100}%`,background:T.accent}}/>
                <div style={{width:`${sts.d/(sts.w+sts.l+sts.d)*100}%`,background:"#9ca3af"}}/>
                <div style={{width:`${sts.l/(sts.w+sts.l+sts.d)*100}%`,background:T.danger}}/>
              </div>
            </>:<div style={{fontSize:14,color:T.dim,marginTop:8}}>No games yet</div>}
          </div>
          {/* Quick Puzzle Widget */}
          <div style={{flex:"1 1 140px",background:"linear-gradient(135deg,#eff6ff,#f0fdf4)",borderRadius:12,border:"1px solid #bfdbfe",padding:16,textAlign:"center",cursor:"pointer"}} onClick={()=>{sTab("puzzles");if(PUZZLES.length)ldPz(Math.floor(Math.random()*PUZZLES.length))}}>
            <div style={{fontSize:13,color:T.blue,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Задачи</div>
            <div style={{fontSize:28}}>🧩</div>
            <div style={{fontSize:13,color:T.dim,marginTop:4}}>{PUZZLES.length} puzzles</div>
            <div style={{fontSize:14,fontWeight:700,color:T.blue,marginTop:4}}>Решать →</div>
          </div>
          {/* AI Coach Widget */}
          <div style={{flex:"1 1 140px",background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)",borderRadius:12,border:"1px solid #a7f3d0",padding:16,textAlign:"center",cursor:"pointer"}} onClick={()=>sTab("coach")}>
            <div style={{fontSize:13,color:T.accent,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>AI Coach</div>
            <div style={{fontSize:28}}>🎓</div>
            <div style={{fontSize:13,color:T.dim,marginTop:4}}>Разбор партии</div>
            <div style={{fontSize:14,fontWeight:700,color:T.accent,marginTop:4}}>Учиться →</div>
          </div>
          {/* Library Widget */}
          <div style={{flex:"1 1 140px",background:"linear-gradient(135deg,#faf5ff,#f3e8ff)",borderRadius:12,border:"1px solid #d8b4fe",padding:16,textAlign:"center",cursor:"pointer"}} onClick={()=>sTab("analysis")}>
            <div style={{fontSize:13,color:T.purple,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase" as const,marginBottom:4}}>Анализ</div>
            <div style={{fontSize:28}}>⚡</div>
            <div style={{fontSize:13,color:T.dim,marginTop:4}}>MultiPV · Stockfish</div>
            <div style={{fontSize:14,fontWeight:700,color:T.purple,marginTop:4}}>Анализ →</div>
          </div>
        </div>

        {/* Game History */}
        {savedGames.length>0&&<div style={{background:T.surface,borderRadius:10,border:`1px solid ${T.border}`,overflow:"hidden"}}>
          <div style={{padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
            <span style={{fontSize:14,fontWeight:800,color:T.text}}>Мои партии ({savedGames.length})</span>
            <div style={{display:"flex",gap:3}}>
              {["all","Bullet","Blitz","Rapid"].map(f=><button key={f} onClick={()=>sGamesFilter(f)} style={{padding:"3px 8px",borderRadius:5,border:"none",background:gamesFilter===f?T.accent:"#f3f4f6",color:gamesFilter===f?"#fff":T.dim,fontSize:13,fontWeight:700,cursor:"pointer"}}>{f==="all"?"Все":f}</button>)}
            </div>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {savedGames.filter(g=>gamesFilter==="all"||g.category===gamesFilter).slice(0,30).map(g=>{
              const isWin=g.result.includes("You win")||g.result.includes("timed out");
              const isDraw=g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
              return(<button key={g.id} onClick={()=>{
                // Load game into analysis
                sTab("analysis");
                const ch=new Chess();
                for(const san of g.moves)try{ch.move(san)}catch{}
                setGame(ch);sBk(k=>k+1);sHist(g.moves);
                const fens=[new Chess().fen()];const tmp=new Chess();
                for(const san of g.moves){try{tmp.move(san);fens.push(tmp.fen())}catch{}}
                sFenHist(fens);sOver(g.result);sOn(false);sSetup(false);sSel(null);sVm(new Set());sLm(null);
              }} style={{width:"100%",padding:"8px 12px",border:"none",borderBottom:`1px solid ${T.border}`,background:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left",fontSize:13}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:900,color:isWin?T.accent:isDraw?T.dim:T.danger}}>{isWin?"W":isDraw?"D":"L"}</span>
                  <div>
                    <div style={{fontWeight:600,color:T.text}}>{g.opening||"Unknown"}</div>
                    <div style={{fontSize:13,color:T.dim}}>{g.aiLevel} · {g.tc} · {g.moves.length} ходов</div>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontSize:14,fontWeight:700,color:T.dim}}>{g.rating}</div>
                  <span style={{fontSize:8,padding:"1px 5px",borderRadius:3,background:g.category==="Bullet"?"#fecaca":g.category==="Blitz"?"#fef3c7":"#d1fae5",color:g.category==="Bullet"?T.danger:g.category==="Blitz"?"#92400e":T.accent,fontWeight:700}}>{g.category}</span>
                </div>
              </button>)
            })}
          </div>
        </div>}
      </div>}

      {/* Board + Panel */}
      {(!setup||tab==="puzzles"||tab==="analysis"||tab==="coach")&&<div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}} onContextMenu={e=>{e.preventDefault();if(pms.length>0)sPms(p=>p.slice(0,-1));else if(pmSel)sPmSel(null)}}>
        <div style={{flexShrink:0}}>
          {tc.ini>0&&tab!=="analysis"&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:5,width:"min(920px,calc(100vw - 48px))"}}>
            <div style={{padding:"8px 18px",borderRadius:10,background:game.turn()===aiC&&on&&!over?"#1e293b":T.surface,color:game.turn()===aiC&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:16,fontFamily:"monospace",border:`1px solid ${T.border}`,boxShadow:game.turn()===aiC&&on&&!over?"0 2px 8px rgba(30,41,59,0.2)":"none"}}>AI {fmt(aT.time)}</div>
            <div style={{padding:"8px 18px",borderRadius:10,background:myT&&on&&!over?T.accent:T.surface,color:myT&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:16,fontFamily:"monospace",border:`1px solid ${T.border}`,boxShadow:myT&&on&&!over?"0 2px 8px rgba(5,150,105,0.25)":"none"}}>You {fmt(pT.time)}</div>
          </div>}

          <div translate="no" style={{display:"flex",width:"min(920px,calc(100vw - 32px))",gap:4}}>
            {/* Eval bar - shown in play/coach/analysis when Stockfish ready */}
            {sfOk&&(tab==="analysis"||tab==="play"||tab==="coach")&&(()=>{
              const cp=evalMate!==0?(evalMate>0?2000:-2000):Math.max(-1500,Math.min(1500,evalCp));
              const pct=50+cp/30; // -1500..1500 → 0..100
              const wPct=Math.max(2,Math.min(98,pct));
              const label=evalMate!==0?`M${Math.abs(evalMate)}`:(evalCp>=0?"+":"")+(evalCp/100).toFixed(2);
              const whiteTop=flip;
              const isWhiteBetter=evalMate!==0?evalMate>0:evalCp>=0;
              return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                <div style={{fontSize:11,fontWeight:900,color:whiteTop?(isWhiteBetter?T.accent:T.danger):T.dim,fontFamily:"monospace",minHeight:14}}>{whiteTop?label:""}</div>
                <div style={{width:28,flex:1,borderRadius:6,overflow:"hidden",border:"1px solid #475569",background:"#1e293b",position:"relative",display:"flex",flexDirection:"column",boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}}>
                  {whiteTop?<>
                    <div style={{height:`${wPct}%`,background:"#f0f0f0",transition:"height 0.4s"}}/>
                    <div style={{flex:1,background:"#262626"}}/>
                  </>:<>
                    <div style={{flex:1,background:"#262626"}}/>
                    <div style={{height:`${wPct}%`,background:"#f0f0f0",transition:"height 0.4s"}}/>
                  </>}
                </div>
                <div style={{fontSize:11,fontWeight:900,color:!whiteTop?(isWhiteBetter?T.accent:T.danger):T.dim,fontFamily:"monospace",minHeight:14}}>{!whiteTop?label:""}</div>
              </div>);
            })()}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:6,paddingLeft:2,width:16}}>{rws.map(r=><div key={r} style={{fontSize:14,color:T.dim,fontWeight:700,textAlign:"center"}}>{8-r}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",borderRadius:8,overflow:"hidden",border:`2px solid ${bT.border}`,boxShadow:"0 10px 40px rgba(0,0,0,0.18), 0 2px 6px rgba(0,0,0,0.08)"}}>
              {rws.flatMap(r=>cls.map(c=>{const sq=`${FILES[c]}${8-r}` as Square;const p=bd[r][c];const lt=(r+c)%2===0;
                const realP=game.get(sq);
                const isShadow=pms.length>0&&p&&(!realP||realP.type!==p.type||realP.color!==p.color);
                const iS=sel===sq,iV=vm.has(sq),iCp=iV&&!!p,iL=lm&&(lm.from===sq||lm.to===sq),iCk=chk&&p?.type==="k"&&p.color===game.turn(),iPM=pmSet.has(sq),iPS=pmSel===sq;
                let bg=lt?bT.light:bT.dark;
                if(iCk)bg=T.chk;else if(iPS)bg=T.pmS;else if(iPM)bg=T.pm;else if(iS)bg=T.sel;else if(iCp)bg=T.cap;else if(iV)bg=T.valid;else if(iL)bg=T.last;
                return<div key={sq} onClick={()=>click(sq)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();
                  // Find premove at this square (either from or to) and remove it specifically
                  const pmIdx=pms.findIndex(p=>p.from===sq||p.to===sq);
                  if(pmIdx>=0){sPms(p=>p.filter((_,i)=>i!==pmIdx));return}
                  // Otherwise fallback: remove last premove / clear selection
                  if(pms.length>0){sPms(p=>p.slice(0,-1))}else if(pmSel){sPmSel(null)}
                }} onDragStart={()=>dS(sq)} onDragOver={e=>e.preventDefault()} onDrop={()=>dD(sq)} draggable={!!p&&(tab==="analysis"?true:p.color===pCol)&&!over}
                  style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(40px,7.5vw,80px)",background:bg,cursor:!over&&p?.color===pCol?"grab":"default",userSelect:"none",position:"relative",lineHeight:1,transition:"background 0.15s"}}>
                  {iV&&!p&&<div style={{width:"28%",height:"28%",borderRadius:"50%",background:"rgba(5,150,105,0.5)",position:"absolute"}}/>}
                  {p&&<div style={{width:"88%",height:"88%",transform:iS||iPS?"scale(1.08)":"none",filter:isShadow?"drop-shadow(0 2px 3px rgba(0,0,0,0.25))":"drop-shadow(0 2px 3px rgba(0,0,0,0.35))",opacity:isShadow?0.55:1,transition:"transform 0.12s, opacity 0.15s"}}><Piece type={p.type} color={p.color}/></div>}
                </div>}))}
            </div>
          </div>
          <div style={{display:"flex",paddingLeft:23,width:"min(920px,calc(100vw - 32px))"}}><div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,marginTop:4}}>{cls.map(c=><div key={c} style={{textAlign:"center",fontSize:14,color:T.dim,fontWeight:700}}>{FILES[c]}</div>)}</div></div>

          {/* Controls */}
          <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
            {btn("⇄ Flip",()=>sFlip(!flip),T.surface,T.dim)}
            {btn("New Game",()=>{sSetup(true);sOn(false);sOver(null);sPms([])},T.accent,"#fff","none")}
            {(tab==="play"||tab==="coach"||tab==="analysis")&&btn(voiceListening?"🔴 Слушаю...":"🎤 Голос",()=>{
              const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
              if(!SR){showToast("Браузер не поддерживает голосовой ввод","error");return}
              if(voiceListening&&voiceRecRef.current){voiceRecRef.current.stop();return}
              const rec=new SR();rec.lang="ru-RU";rec.interimResults=false;rec.continuous=false;rec.maxAlternatives=3;
              rec.onstart=()=>{sVoiceListening(true);showToast("Говорите: 'е2 е4' или 'конь f3'","info")};
              rec.onend=()=>{sVoiceListening(false);voiceRecRef.current=null};
              rec.onerror=(e:any)=>{sVoiceListening(false);
                if(e.error==="network"){
                  showToast("Голосу нужен интернет (Chrome speech API). Попробуй ввести ход вручную","error");
                }else if(e.error==="not-allowed"){
                  showToast("Разреши доступ к микрофону в браузере","error");
                }else{
                  showToast(`Ошибка: ${e.error}`,"error");
                }
              };
              rec.onresult=(e:any)=>{
                // Try all alternatives
                const alts:string[]=[];
                for(let i=0;i<e.results[0].length;i++)alts.push(e.results[0][i].transcript);
                const parseVoice=(text:string):{from?:string;to?:string;san?:string}=>{
                  let t=text.toLowerCase().trim();
                  // Russian letters to files
                  const rusMap:Record<string,string>={"а":"a","б":"b","в":"c","с":"c","д":"d","е":"e","ф":"f","ж":"g","ге":"g","г":"g","х":"h","аш":"h","эйч":"h"};
                  // Number words
                  const numMap:Record<string,string>={"один":"1","одну":"1","два":"2","две":"2","три":"3","четыре":"4","пять":"5","шесть":"6","семь":"7","восемь":"8"};
                  // Piece words
                  const pieceMap:Record<string,string>={"конь":"N","коня":"N","конём":"N","конем":"N","слон":"B","слона":"B","слоном":"B","ладья":"R","ладью":"R","ладьёй":"R","ферзь":"Q","ферзя":"Q","ферзём":"Q","ферзем":"Q","король":"K","короля":"K","королём":"K","королем":"K"};
                  // Castling
                  if(/короткая\s+рокировка|короткую\s+рокировку|o-?o(?!-?o)/i.test(t))return{san:"O-O"};
                  if(/длинная\s+рокировка|длинную\s+рокировку|o-?o-?o/i.test(t))return{san:"O-O-O"};
                  // Replace Russian words with letters/numbers
                  t=t.replace(/\s+/g," ");
                  for(const[k,v]of Object.entries(rusMap))t=t.replace(new RegExp("\\b"+k+"\\b","g"),v);
                  for(const[k,v]of Object.entries(numMap))t=t.replace(new RegExp("\\b"+k+"\\b","g"),v);
                  // Extract piece if mentioned
                  let piece="";
                  for(const[k,v]of Object.entries(pieceMap))if(t.includes(k)){piece=v;t=t.replace(k,"").trim();break;}
                  // Extract 2 squares like "e2 e4" or "e2e4"
                  const sq=/([a-h])\s*([1-8])/g;const matches:string[]=[];let m;
                  while((m=sq.exec(t))!==null){matches.push(m[1]+m[2]);if(matches.length===2)break}
                  if(matches.length===2)return{from:matches[0],to:matches[1]};
                  if(matches.length===1&&piece)return{san:piece+matches[0]};
                  if(matches.length===1)return{san:matches[0]};
                  return{};
                };
                let matched=false;
                for(const alt of alts){
                  const v=parseVoice(alt);
                  if(v.from&&v.to){
                    try{const mv=game.move({from:v.from as Square,to:v.to as Square,promotion:"q"});if(mv){exec(v.from as Square,v.to as Square);showToast(`✓ ${v.from}→${v.to}`,"success");matched=true;break}}catch{}
                  }else if(v.san){
                    try{const mv=game.move(v.san);if(mv){game.undo();const legal=game.moves({verbose:true}).find(x=>x.san===mv.san);if(legal){exec(legal.from,legal.to);showToast(`✓ ${v.san}`,"success");matched=true;break}}}catch{}
                  }
                }
                if(!matched)showToast(`Не распознал: "${alts[0]}"`,"error");
              };
              voiceRecRef.current=rec;rec.start();
            },voiceListening?"#fee2e2":T.surface,voiceListening?T.danger:T.dim)}
            {(tab==="play"||tab==="coach"||tab==="analysis")&&btn("⌨️ Ход текстом",()=>{
              const input=prompt("Введи ход в алгебраической нотации (например: e4, Nf3, O-O, exd5):");
              if(!input)return;
              const san=input.trim();
              try{
                const mv=game.move(san);
                if(mv){game.undo();const legal=game.moves({verbose:true}).find(x=>x.san===mv.san);if(legal){exec(legal.from,legal.to);showToast(`✓ ${san}`,"success")}}
                else showToast(`Невозможный ход: ${san}`,"error");
              }catch{showToast(`Невозможный ход: ${san}`,"error")}
            },T.surface,T.dim)}
            {over&&btn("Rematch",()=>newG(),"#f59e0b","#fff","none")}
            {pms.length>0&&btn(`↩ Undo`,()=>sPms(p=>p.slice(0,-1)),"#eff6ff",T.blue,`1px solid rgba(37,99,235,0.3)`)}
            {pms.length>0&&btn(`✕ Clear (${pms.length})`,()=>{sPms([]);sPmSel(null)},"#fef2f2",T.danger,`1px solid rgba(220,38,38,0.2)`)}
          </div>
          {on&&!over&&!setup&&<div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
            {btn("🏳 Resign",()=>{if(!confirm("Resign?"))return;const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("You resigned");snd("x")},"#fef2f2",T.danger,`1px solid rgba(220,38,38,0.2)`)}
            {btn("½ Draw",()=>{if(!confirm("Offer draw?"))return;if(Math.abs(ev(game))<200){const ns={...sts,d:sts.d+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("Draw agreed");snd("x")}else showToast("AI declined","error")},"#fefce8","#92400e",`1px solid rgba(217,119,6,0.2)`)}
            {btn("↩ Take back",()=>{if(hist.length>=2){game.undo();game.undo();sHist(h=>h.slice(0,-2));sFenHist(h=>h.slice(0,-2));sLm(null);sSel(null);sVm(new Set());sBk(k=>k+1)}else showToast("No moves","error")},T.surface,T.dim)}
            {savedGames.length>0&&(tab==="play"||tab==="coach")&&btn(`📜 История (${savedGames.length})`,()=>{
              sGamesModalOpen(true);
            },T.surface,T.dim)}
          </div>}
          {over&&fenHist.length>2&&<div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
            {btn("📊 Открыть в Analysis",()=>{
              // Switch to analysis tab, keep current game's history
              sTab("analysis");
              sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
              showToast("Партия открыта в анализе","info");
            },T.purple,"#fff","none")}
            {btn(analyzing?"⚡ Analyzing...":showAnal?"🔽 Hide":"⚡ Quick analyze",runAnalysis,T.accent,"#fff","none")}
            {savedGames.length>0&&btn(`📜 История (${savedGames.length})`,()=>{
              sGamesModalOpen(true);
            },T.surface,T.dim)}
          </div>}
        </div>

        {/* Right panel */}
        <div style={{flex:"1 1 440px",minWidth:380,maxWidth:720,display:"flex",flexDirection:"column",gap:10}}>
          {/* Player block (top = opponent) */}
          {!setup&&(tab==="play"||tab==="coach")&&<div style={{padding:"10px 14px",borderRadius:10,background:T.surface,border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#1e293b,#334155)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14,flexShrink:0}}>🤖</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:T.text,display:"flex",alignItems:"center",gap:6}}>
                {useSF?"Stockfish":"AI"} <span style={{fontSize:12,fontWeight:600,color:T.dim}}>({lv.elo})</span>
                {game.turn()===aiC&&!over&&on&&<span style={{width:6,height:6,borderRadius:3,background:think?T.gold:T.dim,animation:think?"pulse 1s infinite":"none"}}/>}
              </div>
              {capW.length>0&&<div style={{fontSize:16,letterSpacing:1,lineHeight:1,marginTop:2}} translate="no">{capW.join("")}</div>}
            </div>
          </div>}

          {/* Status bar */}
          {(tab==="play"||tab==="coach")&&<div style={{padding:"10px 14px",borderRadius:10,background:over?(over.includes("You win")?"#ecfdf5":"#fef2f2"):chk?"#fef2f2":think&&tab!=="analysis"?"#fffbeb":T.surface,border:`1px solid ${over?(over.includes("You win")?"#a7f3d0":"#fecaca"):chk?"#fecaca":T.border}`}}>
            {over?<><div style={{fontWeight:900,fontSize:15,color:over.includes("You win")?T.accent:T.danger}}>{over}</div><div style={{fontSize:13,color:T.dim,marginTop:3}}>{hist.length} moves · {rat} {rk.i}</div></>:
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:8,height:8,borderRadius:4,background:chk?T.danger:think?T.gold:myT?T.accent:T.dim,animation:think?"pulse 1s infinite":"none"}}/>
              <span style={{fontWeight:700,fontSize:14,color:T.text}}>{chk?"Check!":think?(useSF?"Stockfish…":"Thinking…"):myT?"Your move":"Ход AI"}</span>
              {pms.length>0&&<span style={{padding:"2px 8px",borderRadius:5,fontSize:12,fontWeight:800,background:"#dbeafe",color:T.blue,marginLeft:"auto"}}>{pms.length} premove{pms.length>1?"s":""}</span>}
            </div>}
          </div>}

          {/* My player block (bottom = me) */}
          {!setup&&(tab==="play"||tab==="coach")&&<div style={{padding:"10px 14px",borderRadius:10,background:T.surface,border:`1px solid ${myT&&on&&!over?T.accent:T.border}`,display:"flex",alignItems:"center",gap:10,boxShadow:myT&&on&&!over?"0 0 0 2px rgba(5,150,105,0.15)":"none"}}>
            <div style={{width:36,height:36,borderRadius:"50%",background:"linear-gradient(135deg,#059669,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:14,flexShrink:0}}>👤</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:800,color:T.text,display:"flex",alignItems:"center",gap:6}}>
                You <span style={{fontSize:12,fontWeight:600,color:T.dim}}>({rat})</span>
                {myT&&!over&&on&&<span style={{width:6,height:6,borderRadius:3,background:T.accent,marginLeft:"auto"}}/>}
              </div>
              {capB.length>0&&<div style={{fontSize:16,letterSpacing:1,lineHeight:1,marginTop:2}} translate="no">{capB.join("")}</div>}
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
          {currentOpening&&(on&&!setup||tab==="analysis")&&hist.length>0&&<div style={{padding:"10px 14px",borderRadius:10,background:"linear-gradient(135deg,#f0fdf4,#ecfdf5)",border:"1px solid #a7f3d0",boxShadow:"0 1px 4px rgba(5,150,105,0.08)"}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:900,padding:"2px 7px",borderRadius:4,background:T.accent,color:"#fff",fontFamily:"monospace",letterSpacing:"0.05em"}}>{currentOpening.eco}</span>
              <span style={{fontSize:13,fontWeight:800,color:T.text}}>{currentOpening.name}</span>
            </div>
            <div style={{fontSize:14,color:T.dim,lineHeight:1.4}}>{currentOpening.desc}</div>
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
              {hist.length>0&&<div style={{display:"flex",gap:3}}>
                <button onClick={()=>{const g=new Chess(fenHist[0]);setGame(g);sBk(k=>k+1);sBrowseIdx(0);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="В начало">⏮</button>
                <button onClick={()=>{const ni=Math.max(0,(browseIdx<0?hist.length:browseIdx)-1);const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="Назад">◀</button>
                <button onClick={()=>{const ni=browseIdx<0?hist.length:Math.min(hist.length,browseIdx+1);const g=new Chess(fenHist[ni]);setGame(g);sBk(k=>k+1);sBrowseIdx(ni>=hist.length?-1:ni);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:`1px solid ${T.border}`,background:"#fff",fontSize:11,cursor:"pointer"}} title="Вперёд">▶</button>
                <button onClick={()=>{const g=new Chess(fenHist[fenHist.length-1]);setGame(g);sBk(k=>k+1);sBrowseIdx(-1);sLm(null);sSel(null);sVm(new Set());}} style={{padding:"3px 7px",borderRadius:4,border:browseIdx<0?`1px solid ${T.accent}`:`1px solid ${T.border}`,background:browseIdx<0?"rgba(5,150,105,0.1)":"#fff",fontSize:11,cursor:"pointer"}} title="К последнему">⏭</button>
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
              </div>:<div style={{padding:"14px",textAlign:"center",fontSize:13,color:T.dim,fontStyle:"italic"}}>No moves yet</div>}
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
                    {pzTimeLeft>0&&<span style={{fontSize:14,fontWeight:900,color:pzTimeLeft<30?T.danger:T.text,fontFamily:"monospace",padding:"2px 8px",borderRadius:5,background:pzTimeLeft<30?"#fef2f2":"#f3f4f6"}}>⏱ {fmt(pzTimeLeft)}</span>}
                  </div>
                </div>
                {/* Tags */}
                <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                  {[pzCurrent.phase,pzCurrent.theme].filter(Boolean).map(t=><span key={t} style={{fontSize:11,padding:"3px 9px",borderRadius:10,background:"#f3f4f6",color:T.dim,fontWeight:700}}>{t}</span>)}
                </div>
                {/* Result banner */}
                {pzAttempt==="correct"&&<div style={{fontSize:14,fontWeight:900,color:T.accent,padding:"8px 12px",background:"rgba(5,150,105,0.1)",borderRadius:7,marginBottom:10}}>✓ Отлично! Верный ход</div>}
                {pzAttempt==="wrong"&&<div style={{fontSize:14,fontWeight:900,color:T.danger,padding:"8px 12px",background:"rgba(220,38,38,0.1)",borderRadius:7,marginBottom:10}}>✗ Неверно. Попробуй ещё</div>}
                {pzAttempt==="shown"&&<div style={{fontSize:14,fontWeight:800,color:"#92400e",padding:"8px 12px",background:"#fffbeb",borderRadius:7,marginBottom:10,border:"1px solid #fde68a"}}>💡 Ответ: <span style={{fontFamily:"monospace",background:"#fef3c7",padding:"2px 8px",borderRadius:4}}>{pzCurrent.sol[0]}</span></div>}
                {/* Actions */}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <button onClick={nextPz} style={{flex:"1 1 auto",minWidth:120,padding:"10px 18px",borderRadius:8,border:"none",background:T.accent,color:"#fff",fontSize:14,fontWeight:800,cursor:"pointer"}}>▶ Следующая</button>
                  <button onClick={randomPz} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:T.dim,fontSize:14,fontWeight:700,cursor:"pointer"}} title="Случайная">🎲</button>
                  {pzAttempt==="wrong"&&<button onClick={()=>{const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sPzAttempt("idle");sLm(null)}} style={{padding:"10px 14px",borderRadius:8,border:`1px solid ${T.border}`,background:"#fff",color:T.text,fontSize:13,fontWeight:700,cursor:"pointer"}}>↩ Заново</button>}
                  {pzAttempt!=="correct"&&pzAttempt!=="shown"&&<button onClick={()=>sPzAttempt("shown")} style={{padding:"10px 14px",borderRadius:8,border:`1px solid #fde68a`,background:"#fffbeb",color:"#92400e",fontSize:13,fontWeight:700,cursor:"pointer"}}>💡 Подсказка</button>}
                </div>
              </div>
            </div>:<div style={{padding:"24px",textAlign:"center",color:T.dim,fontSize:14,background:T.surface,borderRadius:10,border:`1px solid ${T.border}`}}>Выбери задачу из списка ниже ↓</div>}

            {/* ── Stats strip ── */}
            <div style={{display:"flex",gap:6}}>
              <div style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,#ecfdf5,#f0fdf4)",textAlign:"center",border:"1px solid #a7f3d0"}}>
                <div style={{fontSize:20,fontWeight:900,color:T.accent,lineHeight:1}}>{pzSolvedCount}</div>
                <div style={{fontSize:10,color:T.dim,fontWeight:700,marginTop:2,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Решено</div>
              </div>
              <div style={{flex:1,padding:"10px",borderRadius:8,background:"linear-gradient(135deg,#fef2f2,#fff1f2)",textAlign:"center",border:"1px solid #fecaca"}}>
                <div style={{fontSize:20,fontWeight:900,color:T.danger,lineHeight:1}}>{pzFailedCount}</div>
                <div style={{fontSize:10,color:T.dim,fontWeight:700,marginTop:2,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>Ошибок</div>
              </div>
              <div style={{flex:1,padding:"10px",borderRadius:8,background:"#f3f4f6",textAlign:"center",border:`1px solid ${T.border}`}}>
                <div style={{fontSize:20,fontWeight:900,color:T.text,lineHeight:1}}>{fPz.length}</div>
                <div style={{fontSize:10,color:T.dim,fontWeight:700,marginTop:2,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>В фильтре</div>
              </div>
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
                  return<button key={cat} onClick={()=>{sPzCategory(cat);sPzI(0);}} style={{padding:"8px 6px",borderRadius:7,border:active?`2px solid ${color}`:`1px solid ${T.border}`,background:active?`${color}15`:"#fff",color:active?color:T.text,fontSize:11,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <span style={{fontSize:13,fontWeight:800}}>{label}</span>
                    <span style={{fontSize:10,color:T.dim,fontWeight:700}}>{cnt}</span>
                  </button>;
                })}
              </div>
            </div>

            {/* ── Mode Selector ── */}
            <div style={{background:T.surface,borderRadius:8,border:`1px solid ${T.border}`,padding:"8px 10px"}}>
              <div style={{fontSize:10,fontWeight:700,color:T.dim,marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase" as const}}>Режим</div>
              <div style={{display:"flex",gap:4}}>
                {([["learn","📚","Обучение"],["timed3","3⏱","3 мин"],["timed5","5⏱","5 мин"],["rush","⚡","Раш"]] as const).map(([m,ic,label])=>
                  <button key={m} onClick={()=>sPzMode(m)} style={{flex:1,padding:"7px 4px",borderRadius:6,border:pzMode===m?`2px solid ${T.purple}`:`1px solid ${T.border}`,background:pzMode===m?"rgba(124,58,237,0.08)":"#fff",color:pzMode===m?T.purple:T.dim,fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                    <span style={{fontSize:16}}>{ic}</span>
                    <span style={{fontSize:10,fontWeight:800}}>{label}</span>
                  </button>)}
              </div>
            </div>

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
                <span style={{fontSize:12,fontWeight:800,color:T.text,letterSpacing:"0.05em",textTransform:"uppercase" as const}}>📋 Список задач ({fPz.length})</span>
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
            {/* Position import for Analysis */}
            <div style={{borderRadius:10,background:"linear-gradient(135deg,#faf5ff,#f5f3ff)",border:"1px solid #ddd6fe",padding:"10px 12px"}}>
              <div style={{fontSize:11,fontWeight:800,color:T.purple,letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8}}>📥 Источник позиции</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>
                <button onClick={()=>{
                  const g=new Chess();setGame(g);sBk(k=>k+1);sHist([]);sFenHist([g.fen()]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol("w");sFlip(false);
                  showToast("Начальная позиция","info");
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>🆕 Начальная</button>

                <button onClick={()=>{
                  if(savedGames.length===0){showToast("Нет сыгранных партий","error");return}
                  const last=savedGames[0];
                  const g=new Chess();const fh:string[]=[g.fen()];const mhist:string[]=[];
                  for(const san of last.moves){try{const mv=g.move(san);if(mv){mhist.push(mv.san);fh.push(g.fen())}}catch{break}}
                  setGame(g);sBk(k=>k+1);sHist(mhist);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(last.result);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(last.playerColor);sFlip(last.playerColor==="b");
                  showToast(`Партия · ${mhist.length} ходов`,"success");
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>📜 Последняя партия</button>

                <button onClick={()=>{
                  if(!pzCurrent){showToast("Нет активного пазла","error");return}
                  const g=new Chess(pzCurrent.fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([pzCurrent.fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");
                  showToast(`Пазл · ${pzCurrent.name}`,"success");
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
                      setGame(g2);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
                      showToast(`PGN · ${mh.length} ходов`,"success");
                    }catch{showToast("Неверный PGN","error")}};
                    r.readAsText(f);e.target.value="";
                  }}/>
                </label>

                <button onClick={()=>{
                  const fen=prompt("Введите FEN позиции:");
                  if(!fen)return;
                  try{const g=new Chess(fen);setGame(g);sBk(k=>k+1);sHist([]);sFenHist([fen]);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);sPCol(g.turn());sFlip(g.turn()==="b");showToast("FEN загружен","success")}catch{showToast("Неверный FEN","error")}
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>🔤 FEN</button>

                <button onClick={()=>{
                  const pgn=prompt("Вставьте PGN:");if(!pgn)return;
                  try{
                    const g=new Chess();g.loadPgn(pgn);
                    const h=g.history();const g2=new Chess();const fh:string[]=[g2.fen()];const mh:string[]=[];
                    for(const san of h){try{const mv=g2.move(san);if(mv){mh.push(mv.san);fh.push(g2.fen())}}catch{break}}
                    setGame(g2);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(null);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
                    showToast(`PGN · ${mh.length} ходов`,"success");
                  }catch{showToast("Неверный PGN","error")}
                }} style={{padding:"8px 10px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",color:T.text,textAlign:"left"}}>📋 PGN текст</button>
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
            {/* Position import */}
            <div style={{borderRadius:10,background:"linear-gradient(135deg,#eff6ff,#f0f9ff)",border:"1px solid #bfdbfe",padding:"10px 12px"}}>
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
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    {/* Games History Modal */}
    {gamesModalOpen&&(()=>{
      const byCategory=(cat:string)=>savedGames.filter(g=>cat==="all"||g.category===cat);
      const[categoryFilter,sCategoryFilter]=[gamesFilter,sGamesFilter];
      const filtered=byCategory(categoryFilter);
      // Rating history: reverse order (oldest first)
      const ratingHistory=[...savedGames].reverse().map((g,i)=>({x:i,y:g.rating}));
      const minR=Math.min(...ratingHistory.map(p=>p.y),rat)-50;
      const maxR=Math.max(...ratingHistory.map(p=>p.y),rat)+50;
      const range=Math.max(100,maxR-minR);
      // Stats by category
      const catStats=(cat:string)=>{
        const games=byCategory(cat);
        const wins=games.filter(g=>g.result.includes("You win")||g.result.includes("win!")).length;
        const losses=games.filter(g=>g.result.includes("AI wins")||g.result.includes("resigned")).length;
        const draws=games.length-wins-losses;
        return{total:games.length,wins,losses,draws};
      };
      return<div onClick={()=>sGamesModalOpen(false)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
        <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:24,maxWidth:900,width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div>
              <div style={{fontSize:22,fontWeight:900,color:T.text}}>📜 Мои партии</div>
              <div style={{fontSize:13,color:T.dim,marginTop:2}}>{savedGames.length} партий · текущий рейтинг {rat}</div>
            </div>
            <button onClick={()=>sGamesModalOpen(false)} style={{padding:"6px 14px",borderRadius:7,border:`1px solid ${T.border}`,background:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",color:T.dim}}>✕ Закрыть</button>
          </div>

          {/* Rating chart */}
          {ratingHistory.length>1&&<div style={{background:"#0f172a",borderRadius:10,padding:"14px 16px",marginBottom:14,border:"1px solid #334155"}}>
            <div style={{fontSize:11,fontWeight:800,color:"#94a3b8",letterSpacing:"0.06em",textTransform:"uppercase" as const,marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span>📈 Прогресс рейтинга</span>
              <span style={{fontSize:10,color:"#64748b"}}>{minR} — {maxR}</span>
            </div>
            <svg viewBox={`0 0 ${Math.max(100,ratingHistory.length*8)} 80`} preserveAspectRatio="none" style={{width:"100%",height:90,background:"linear-gradient(180deg,#1e293b 0%,#0f172a 100%)",borderRadius:6}}>
              <line x1="0" y1="40" x2={ratingHistory.length*8} y2="40" stroke="#475569" strokeWidth="0.3" strokeDasharray="2,2"/>
              <polyline fill="none" stroke="#7c3aed" strokeWidth="1.8" points={ratingHistory.map(p=>`${p.x*8},${80-((p.y-minR)/range)*80}`).join(" ")}/>
              {ratingHistory.map(p=><circle key={p.x} cx={p.x*8} cy={80-((p.y-minR)/range)*80} r="1.8" fill="#a78bfa"/>)}
            </svg>
          </div>}

          {/* Category stats */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {(["all","Bullet","Blitz","Rapid"] as const).map(cat=>{
              const s=catStats(cat);const active=categoryFilter===cat;
              const icon=cat==="Bullet"?"⚡":cat==="Blitz"?"🔥":cat==="Rapid"?"⏱":"🎯";
              const pct=s.total>0?Math.round(s.wins/s.total*100):0;
              return<button key={cat} onClick={()=>sCategoryFilter(cat)} style={{padding:"12px",borderRadius:9,border:active?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:active?"rgba(5,150,105,0.06)":"#fff",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:14,fontWeight:900,color:active?T.accent:T.text,marginBottom:6}}>{icon} {cat==="all"?"Все":cat}</div>
                <div style={{fontSize:22,fontWeight:900,color:T.text,lineHeight:1}}>{s.total}</div>
                <div style={{fontSize:10,color:T.dim,fontWeight:700,marginTop:4,textTransform:"uppercase" as const,letterSpacing:"0.05em"}}>партий</div>
                {s.total>0&&<div style={{marginTop:8,display:"flex",gap:6,fontSize:11,fontWeight:800}}>
                  <span style={{color:T.accent}}>{s.wins}W</span>
                  <span style={{color:T.danger}}>{s.losses}L</span>
                  <span style={{color:T.dim}}>{s.draws}D</span>
                  <span style={{marginLeft:"auto",color:pct>=60?T.accent:pct>=40?T.blue:T.danger}}>{pct}%</span>
                </div>}
              </button>;
            })}
          </div>

          {/* Games list */}
          <div style={{border:`1px solid ${T.border}`,borderRadius:9,overflow:"hidden",maxHeight:400,overflowY:"auto"}}>
            {filtered.length===0?<div style={{padding:"40px",textAlign:"center",color:T.dim,fontSize:14}}>Нет партий в этой категории</div>:
            filtered.map(g=>{
              const isWin=g.result.includes("You win")||g.result.includes("win!");
              const isDraw=g.result.includes("Draw")||g.result.includes("draw")||g.result.includes("Stalemate")||g.result.includes("repetition")||g.result.includes("Insufficient");
              const date=new Date(g.date);
              return<button key={g.id} onClick={()=>{
                sGamesModalOpen(false);sTab("analysis");
                const ch=new Chess();const fh:string[]=[ch.fen()];const mh:string[]=[];
                for(const san of g.moves){try{const mv=ch.move(san);if(mv){mh.push(mv.san);fh.push(ch.fen())}}catch{break}}
                setGame(ch);sBk(k=>k+1);sHist(mh);sFenHist(fh);sLm(null);sSel(null);sVm(new Set());sOver(g.result);sOn(false);sSetup(false);sAnalysis([]);sShowAnal(false);sBrowseIdx(-1);
                showToast(`Партия открыта · ${mh.length} ходов`,"success");
              }} style={{width:"100%",padding:"12px 16px",border:"none",borderBottom:`1px solid ${T.border}`,background:"#fff",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0,flex:1}}>
                  <span style={{fontSize:16,fontWeight:900,color:isWin?T.accent:isDraw?T.dim:T.danger,minWidth:24,textAlign:"center"}}>{isWin?"W":isDraw?"D":"L"}</span>
                  <div style={{minWidth:0,flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:T.text,marginBottom:2}}>{g.opening||"Без дебюта"}</div>
                    <div style={{fontSize:11,color:T.dim,display:"flex",gap:8,flexWrap:"wrap"}}>
                      <span>{g.category||"—"}</span>
                      <span>· {g.aiLevel}</span>
                      <span>· {g.tc}</span>
                      <span>· {g.moves.length} ходов</span>
                      <span>· {g.playerColor==="w"?"⚪":"⚫"}</span>
                    </div>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                  <div style={{fontSize:13,fontWeight:900,color:T.text}}>{g.rating}</div>
                  <div style={{fontSize:10,color:T.dim,marginTop:2}}>{date.toLocaleDateString("ru-RU")}</div>
                </div>
              </button>;
            })}
          </div>
        </div>
      </div>;
    })()}

    </ProductPageShell></main>);
}