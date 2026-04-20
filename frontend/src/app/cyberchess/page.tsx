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

  const tc:TC=useCustom?{name:`${customMin}+${customInc}`,ini:customMin*60,inc:customInc,cat:customMin<3?"Bullet":customMin<8?"Blitz":customMin<20?"Rapid":"Classical"}:TCS[tcI];
  const lv=ALS[aiI],rk=gRank(rat);
  const aiC:ChessColor=pCol==="w"?"b":"w",myT=game.turn()===pCol,chk=game.isCheck(),useSF=aiI>=3;
  const pT=useTimer(tc.ini,tc.inc,on&&myT&&!over&&tc.ini>0,()=>{sOver("Time out");snd("x")});
  const aT=useTimer(tc.ini,tc.inc,on&&!myT&&!over&&tc.ini>0,()=>{sOver("AI timed out — you win!");snd("x")});
  const hR=useRef<HTMLDivElement>(null),sfR=useRef<SF|null>(null);
  const fPz=PUZZLES.filter(p=>{
    if(pzFilterGoal!=="all"&&p.goal!==pzFilterGoal)return false;
    if(pzFilterMate>0&&p.mateIn!==pzFilterMate)return false;
    if(pzFilterPhase!=="all"&&p.phase!==pzFilterPhase)return false;
    if(pzFilterTheme!=="all"&&p.theme!==pzFilterTheme)return false;
    if(pzFilterSide!=="all"&&p.side!==pzFilterSide)return false;
    if(p.r<pzFilterRating[0]||p.r>pzFilterRating[1])return false;
    return true;
  });

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
    if(setup||over||!sfR.current?.ready())return;
    if(tab!=="analysis"&&tab!=="play"&&tab!=="coach")return;
    // Don't eval during AI thinking (Stockfish busy computing move)
    if(tab!=="analysis"&&think)return;
    sfR.current.eval(game.fen(),10,(cp,mate)=>{
      const sign=game.turn()==="w"?1:-1;
      sEvalCp(cp*sign);sEvalMate(mate*sign);
    },()=>{});
  },[bk,tab,setup,think,over]);

  const exec=useCallback((from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>{
    const p=game.get(from);if(!p)return false;
    // Guess Best Move mode
    if(tab==="analysis"&&guessMode&&guessResult==="idle"&&guessBest){
      const attemptUci=`${from}${to}${pr||""}`;
      const isMatch=attemptUci===guessBest||attemptUci.slice(0,4)===guessBest.slice(0,4);
      if(isMatch){
        sGuessResult("correct");sGuessScore(s=>({right:s.right+1,total:s.total+1}));snd("check");
        showToast(`✓ Лучший ход! ${guessBestSan}`,"success");
        const mv=game.move({from,to,promotion:pr||"q"});
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
        sPzAttempt("correct");sPzSolvedCount(c=>c+1);snd("check");showToast(`✓ Correct! ${pzCurrent.name}`,"success");
        // Execute the move to show it
        const mv=game.move({from,to,promotion:pr||"q"});
        if(mv){sLm({from:mv.from,to:mv.to});sBk(k=>k+1)}
        return true;
      }else{
        sPzAttempt("wrong");sPzFailedCount(c=>c+1);snd("capture");showToast(`✗ Not the best. Try again or see solution`,"error");
        return false;
      }
    }
    const mv=game.move({from,to,promotion:pr||"q"});if(!mv)return false;
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
    const[first,...rest]=pms;
    const mvs=game.moves({verbose:true});
    const ok=mvs.find(m=>m.from===first.from&&m.to===first.to);
    if(ok){sPms(rest);exec(first.from,first.to,first.pr);snd("premove")}
    else sPms(rest); // invalid premove → skip
  },[game,over,pms,pCol,exec]);
  const doPremoveRef=useRef(doPremove);
  useEffect(()=>{doPremoveRef.current=doPremove},[doPremove]);

  /* ── Esc key: clear all premoves ── */
  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){
        if(pms.length>0||pmSel){sPms([]);sPmSel(null)}
      }
    };
    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[pms.length,pmSel]);

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
    if(sel){
      if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){sPromo({from:sel,to:sq});return}exec(sel,sq);return}
      if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)));return}
      sSel(null);sVm(new Set());return;
    }
    if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}
  },[game,sel,vm,over,think,pCol,exec,on,pmLim]);

  /* ── Drag ── */
  const dRef=useRef<Square|null>(null);
  const dS=(sq:Square)=>{const p=game.get(sq);if(p?.color===pCol&&!over){dRef.current=sq;if(game.turn()===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}else sPmSel(sq)}};
  const dD=(sq:Square)=>{if(!dRef.current)return;const f=dRef.current;dRef.current=null;
    if(game.turn()!==pCol&&on&&!over){if(pms.length>=pmLim)return;const p=game.get(f);const pre:Pre={from:f,to:sq};if(p?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.pr="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}
    if(vm.has(sq)){const mp=game.get(f);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))sPromo({from:f,to:sq});else exec(f,sq)}else{sSel(null);sVm(new Set())}};

  const newG=(c?:ChessColor)=>{const cl=c||pCol;setGame(new Chess());sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([new Chess().fen()]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);sCurrentOpening(null);pT.reset();aT.reset();showToast(`Playing ${cl==="w"?"White":"Black"}`,"info")};
  const ldPz=(i:number)=>{if(!PUZZLES.length){showToast("Loading puzzles...","info");return}const pz=fPz[i]||PUZZLES[0];if(!pz){showToast("No puzzles match filter","error");return}const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(i);sPzCurrent(pz);sPzAttempt("idle");sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);
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
        sfR.current!.eval(fen,12,(c,m)=>{const sign=turn==="w"?1:-1;lastCp=c*sign;lastMate=m*sign},()=>res({cp:lastCp,mate:lastMate}));
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
      try{const ch=new Chess(game