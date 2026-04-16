"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import Piece from "./Pieces";

const FILES = "abcdefgh";
const PM: Record<string,string> = {wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟"};
type TC = {name:string;ini:number;inc:number};
type AL = {name:string;elo:number;depth:number;color:string;rand:number;thinkMs:number};
type Pre = {from:Square;to:Square;pr?:"q"|"r"|"b"|"n"};

const TCS: TC[] = [{name:"1+0",ini:60,inc:0},{name:"3+0",ini:180,inc:0},{name:"3+2",ini:180,inc:2},{name:"5+0",ini:300,inc:0},{name:"5+3",ini:300,inc:3},{name:"10+0",ini:600,inc:0},{name:"10+5",ini:600,inc:5},{name:"15+10",ini:900,inc:10},{name:"30+0",ini:1800,inc:0},{name:"∞",ini:0,inc:0}];
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

const PUZZLES = [
  {fen:"rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",sol:["d8h4"],name:"Fool's Mate",r:200,theme:"Mate in 1"},
  {fen:"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["h5f7"],name:"Scholar's Mate",r:400,theme:"Mate in 1"},
  {fen:"5rk1/ppp2ppp/8/8/8/8/PPP2PPP/R3R1K1 w - - 0 1",sol:["e1e8"],name:"Back Rank Mate",r:300,theme:"Mate in 1"},
  {fen:"6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",sol:["e1e8"],name:"Simple Back Rank",r:250,theme:"Mate in 1"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["f3f7"],name:"Queen Mate Threat",r:450,theme:"Mate in 1"},
  {fen:"rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3",sol:["g2g3"],name:"Block the Check",r:350,theme:"Defense"},
  {fen:"r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",sol:["d2d4"],name:"Center Control",r:500,theme:"Opening"},
  {fen:"rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",sol:["c4f7"],name:"Italian Trap",r:600,theme:"Tactics"},
  {fen:"r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",sol:["c4f7"],name:"Fork Trick",r:700,theme:"Fork"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",sol:["d2d4"],name:"Open Center",r:800,theme:"Opening"},
  {fen:"r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",sol:["c4f7"],name:"Fried Liver",r:650,theme:"Tactics"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4",sol:["e1g1"],name:"Castle Safety",r:550,theme:"Opening"},
  {fen:"r2qk2r/ppp2ppp/2n1bn2/2b1p3/4P3/1BP2N2/PP1P1PPP/RNBQK2R w KQkq - 6 6",sol:["d1a4"],name:"Pin Attack",r:1000,theme:"Pin"},
  {fen:"r1bqk2r/pppp1Bpp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",sol:["e8f7"],name:"Recapture",r:1100,theme:"Tactics"},
  {fen:"r2qkb1r/ppp2ppp/2n1bn2/3pp3/8/1B3N2/PPPP1PPP/RNBQ1RK1 w kq - 0 6",sol:["b3d5"],name:"Bishop Pin",r:900,theme:"Pin"},
  {fen:"r2qkbnr/ppp2ppp/2n1p3/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 5",sol:["f1b5"],name:"Pin Knight",r:950,theme:"Pin"},
  {fen:"r1b1kb1r/ppppqppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",sol:["b5c6"],name:"Discovery",r:1200,theme:"Discovery"},
  {fen:"r1bqk2r/ppp2ppp/2n2n2/3pp3/1bP5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq d6 0 5",sol:["c4d5"],name:"Center Fork",r:1150,theme:"Fork"},
  {fen:"r1b1kbnr/pppp1ppp/2n5/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",sol:["f3e5"],name:"Knight Fork",r:1100,theme:"Fork"},
  {fen:"r1bqr1k1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 w - - 0 8",sol:["c3d5"],name:"Knight Outpost",r:1400,theme:"Positional"},
  {fen:"r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Catalan Break",r:1250,theme:"Positional"},
  {fen:"r2q1rk1/pp2bppp/2n1pn2/3p4/3P1B2/2N2N2/PPP1BPPP/R2Q1RK1 w - - 0 8",sol:["f3e5"],name:"Outpost Knight",r:1350,theme:"Positional"},
  {fen:"r2q1rk1/pp1n1ppp/2p1pn2/3p1b2/1bPP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7",sol:["a2a3"],name:"Kick Bishop",r:1500,theme:"Positional"},
  {fen:"2rq1rk1/pp1bppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/R4RK1 w - - 0 11",sol:["d4f5"],name:"Sacrifice",r:1600,theme:"Sacrifice"},
  {fen:"r1b2rk1/2q1bppp/p2p1n2/np2p3/3PP3/2N2N1P/PPB2PP1/R1BQR1K1 w - - 0 13",sol:["d4d5"],name:"Space",r:1800,theme:"Strategy"},
  {fen:"r1bq1rk1/pp3ppp/2nbpn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Central Tension",r:1500,theme:"Strategy"},
  {fen:"r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 8",sol:["e1c1"],name:"Opposite Castle",r:1750,theme:"Attack"},
  {fen:"r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",sol:["c3d5"],name:"Domination",r:2000,theme:"Positional"},
  {fen:"r2q1rk1/ppp1ppbp/2np1np1/8/2PPP1b1/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 8",sol:["d4d5"],name:"Pawn Storm",r:2200,theme:"Attack"},
  {fen:"r2qr1k1/pp1bbppp/2n1pn2/3p4/3P1B2/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 9",sol:["f3e5"],name:"Knight Invasion",r:1900,theme:"Attack"},
  {fen:"8/8/4k3/8/8/8/4KP2/8 w - - 0 1",sol:["f2f4"],name:"K+P vs K",r:800,theme:"Endgame"},
  {fen:"8/5pk1/8/8/8/8/R4PK1/8 w - - 0 1",sol:["a2a7"],name:"Rook 7th",r:900,theme:"Endgame"},
  {fen:"8/8/1k6/8/8/1K6/1R6/8 w - - 0 1",sol:["b2a2"],name:"Rook Cutoff",r:1000,theme:"Endgame"},
  {fen:"8/p7/1p6/8/P7/1P2k3/4p3/4K3 w - - 0 1",sol:["a4a5"],name:"Pawn Race",r:1300,theme:"Endgame"},
  {fen:"8/5p2/5k2/5p2/5P2/5K2/5P2/8 w - - 0 1",sol:["f3e3"],name:"Opposition",r:1400,theme:"Endgame"},
  {fen:"6k1/pp3ppp/8/8/8/8/PPP2PPP/R5K1 w - - 0 1",sol:["a1a8"],name:"Back Rank",r:1000,theme:"Mate in 2"},
  {fen:"6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1",sol:["e3e8"],name:"Queen Mate",r:1050,theme:"Mate in 2"},
];
const PZ_TH = [...new Set(PUZZLES.map(p=>p.theme))].sort();

/* ═══ Stockfish ═══ */
class SF{private w:Worker|null=null;private ok=false;private cb:((f:string,t:string,p?:string)=>void)|null=null;private ecb:((cp:number,mate:number)=>void)|null=null;
  init(){if(this.w)return;try{this.w=new Worker("/stockfish.js");this.w.onmessage=e=>{const l=String(e.data||"");
    if(l.startsWith("info")&&l.includes("score")){
      const cpM=l.match(/score cp (-?\d+)/);const mM=l.match(/score mate (-?\d+)/);
      if(this.ecb){if(mM)this.ecb(0,parseInt(mM[1]));else if(cpM)this.ecb(parseInt(cpM[1]),0)}}
    if(l.startsWith("bestmove")){const m=l.split(" ")[1];if(m&&m.length>=4&&this.cb){this.cb(m.slice(0,2),m.slice(2,4),m.length>4?m[4]:undefined);this.cb=null}}
    if(l==="uciok"){this.ok=true;this.w!.postMessage("isready")}};this.w.postMessage("uci")}catch{this.w=null}}
  ready(){return this.ok&&!!this.w}
  go(fen:string,d:number,cb:(f:string,t:string,p?:string)=>void,ecb?:(cp:number,mate:number)=>void){if(!this.w)return cb("","");this.cb=cb;this.ecb=ecb||null;this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}
  eval(fen:string,d:number,ecb:(cp:number,mate:number)=>void,done:()=>void){if(!this.w)return done();this.cb=(f,t,p)=>done();this.ecb=ecb;this.w.postMessage("ucinewgame");this.w.postMessage(`position fen ${fen}`);this.w.postMessage(`go depth ${d}`)}}

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

/* ═══ Sound ═══ */
function snd(t:string){try{const x=new AudioContext(),n=x.currentTime,g=x.createGain(),o=x.createOscillator();
  o.connect(g);g.connect(x.destination);o.type="sine";
  if(t==="move"||t==="premove"||t==="castle"){g.gain.setValueAtTime(t==="premove"?0.06:0.12,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.07);o.frequency.setValueAtTime(880,n);o.frequency.exponentialRampToValueAtTime(440,n+0.05);o.start(n);o.stop(n+0.07)}
  else if(t==="capture"){g.gain.setValueAtTime(0.18,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.1);o.frequency.setValueAtTime(600,n);o.frequency.exponentialRampToValueAtTime(150,n+0.08);o.start(n);o.stop(n+0.1)}
  else if(t==="check"){g.gain.setValueAtTime(0.1,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.18);o.frequency.setValueAtTime(660,n);o.frequency.setValueAtTime(990,n+0.09);o.start(n);o.stop(n+0.18)}
  else{g.gain.setValueAtTime(0.08,n);g.gain.exponentialRampToValueAtTime(0.001,n+0.4);o.frequency.setValueAtTime(440,n);o.frequency.exponentialRampToValueAtTime(220,n+0.35);o.start(n);o.stop(n+0.4)}
}catch{}}

/* ═══ Rating ═══ */
const RK="aevion_chess_rating_v2",SK="aevion_chess_stats_v2";
function ldR(){try{return parseInt(localStorage.getItem(RK)||"800")}catch{return 800}}
function svR(v:number){try{localStorage.setItem(RK,String(Math.round(v)))}catch{}}
function ldS(){try{return JSON.parse(localStorage.getItem(SK)||'{"w":0,"l":0,"d":0}')}catch{return{w:0,l:0,d:0}}}
function svS(v:{w:number;l:number;d:number}){try{localStorage.setItem(SK,JSON.stringify(v))}catch{}}
function gRank(e:number){return[...RANKS].reverse().find(r=>e>=r.min)||RANKS[0]}

/* ═══ Timer ═══ */
function useTimer(ini:number,inc:number,act:boolean,onT:()=>void){const[t,sT]=useState(ini);const r=useRef<any>(null);useEffect(()=>{sT(ini)},[ini]);useEffect(()=>{if(r.current)clearInterval(r.current);if(act&&ini>0){r.current=setInterval(()=>sT(v=>{if(v<=1){clearInterval(r.current);onT();return 0}return v-1}),1000)}return()=>{if(r.current)clearInterval(r.current)}},[act,ini>0]);return{time:t,addInc:useCallback(()=>{if(inc>0)sT(v=>v+inc)},[inc]),reset:useCallback(()=>sT(ini),[ini])}}
function fmt(s:number){return s<=0?"0:00":`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`}
function pc(t:PieceSymbol,c:ChessColor){return PM[`${c}${t}`]||"?"}

/* ═══ Theme ═══ */
const T={bg:"#f3f4f6",surface:"#fff",border:"#e5e7eb",text:"#111827",dim:"#6b7280",accent:"#059669",gold:"#d97706",danger:"#dc2626",blue:"#2563eb",purple:"#7c3aed",bL:"#f0d9b5",bD:"#b58863",sel:"rgba(5,150,105,0.45)",valid:"rgba(5,150,105,0.35)",cap:"rgba(220,38,38,0.35)",last:"rgba(217,119,6,0.25)",chk:"rgba(220,38,38,0.55)",pm:"rgba(37,99,235,0.35)",pmS:"rgba(37,99,235,0.5)"};

/* ═══ Component ═══ */
export default function CyberChessPage(){
  const{showToast}=useToast();
  const[game,setGame]=useState(()=>new Chess());
  const[bk,sBk]=useState(0);
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
  const[pmLim,sPmLim]=useState(5);
  const[aiI,sAiI]=useState(2);
  const[pCol,sPCol]=useState<ChessColor>("w");
  const[tcI,sTcI]=useState(9);
  const[on,sOn]=useState(false);
  const[setup,sSetup]=useState(true);
  const[flip,sFlip]=useState(false);
  const[tab,sTab]=useState<"play"|"puzzles">("play");
  const[pzI,sPzI]=useState(0);
  const[pzF,sPzF]=useState("all");
  const[sfOk,sSfOk]=useState(false);
  const[rat,sRat]=useState(800);
  const[sts,sSts]=useState({w:0,l:0,d:0});
  const[evalCp,sEvalCp]=useState(0); // centipawns from white's POV
  const[evalMate,sEvalMate]=useState(0); // positive = white mates in N, negative = black mates in N
  const[fenHist,sFenHist]=useState<string[]>([new Chess().fen()]); // positions for analysis
  const[analyzing,sAnalyzing]=useState(false);
  const[analysis,sAnalysis]=useState<{move:number;cp:number;mate:number;quality:"great"|"good"|"inacc"|"mistake"|"blunder"}[]>([]);
  const[showAnal,sShowAnal]=useState(false);

  const tc=TCS[tcI],lv=ALS[aiI],rk=gRank(rat);
  const aiC:ChessColor=pCol==="w"?"b":"w",myT=game.turn()===pCol,chk=game.isCheck(),useSF=aiI>=3;
  const pT=useTimer(tc.ini,tc.inc,on&&myT&&!over&&tc.ini>0,()=>{sOver("Time out");snd("x")});
  const aT=useTimer(tc.ini,tc.inc,on&&!myT&&!over&&tc.ini>0,()=>{sOver("AI timed out — you win!");snd("x")});
  const hR=useRef<HTMLDivElement>(null),sfR=useRef<SF|null>(null);
  const fPz=pzF==="all"?PUZZLES:PUZZLES.filter(p=>p.theme===pzF);

  useEffect(()=>{sRat(ldR());sSts(ldS())},[]);
  useEffect(()=>{hR.current?.scrollTo({top:hR.current.scrollHeight,behavior:"smooth"})},[hist]);
  // Always load Stockfish for eval bar (not just for AI play)
  useEffect(()=>{if(!sfR.current){const s=new SF();s.init();sfR.current=s;const c=setInterval(()=>{if(s.ready()){sSfOk(true);clearInterval(c)}},200);const t=setTimeout(()=>clearInterval(c),15000);return()=>{clearInterval(c);clearTimeout(t)}}},[]);
  // Live eval on position change
  useEffect(()=>{
    if(!on||over||!sfR.current?.ready()||setup)return;
    sfR.current.eval(game.fen(),10,(cp,mate)=>{
      // Stockfish returns scores from side-to-move POV; convert to white POV
      const sign=game.turn()==="w"?1:-1;
      sEvalCp(cp*sign);sEvalMate(mate*sign);
    },()=>{});
  },[bk,on,over,setup]);

  const exec=useCallback((from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>{
    const p=game.get(from);if(!p)return false;
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
      sOver(r);snd("x");sOn(false);sPms([])}
    return true},[game,rat,lv.elo,pCol,aiC,pT,aT,showToast,bk,sts]);

  /* ── Premove execution ── */
  const doPremove=useCallback(()=>{
    if(game.turn()!==pCol||over||!pms.length)return;
    const[first,...rest]=pms;
    const mvs=game.moves({verbose:true});
    const ok=mvs.find(m=>m.from===first.from&&m.to===first.to);
    if(ok){sPms(rest);exec(first.from,first.to,first.pr);snd("premove")}
    else sPms(rest); // invalid premove → skip
  },[game,over,pms,pCol,exec]);

  /* ── AI turn + premove trigger ── */
  useEffect(()=>{
    if(over||!on||tab!=="play")return;
    if(game.turn()===pCol){if(pms.length>0){const t=setTimeout(doPremove,30);return()=>clearTimeout(t)}return}
    sThink(true);
    const tcMul=tc.ini<=0?1:tc.ini<=60?0.3:tc.ini<=180?0.5:tc.ini<=300?0.7:tc.ini<=600?1:tc.ini<=900?1.5:2;const delay=lv.thinkMs*tcMul*(0.7+Math.random()*0.6);
    if(useSF&&sfR.current?.ready()){
      const t=setTimeout(()=>sfR.current!.go(game.fen(),SFD[aiI]||10,(f,t2,p)=>{if(f&&t2)exec(f as Square,t2 as Square,(p||undefined) as any);sThink(false)}),Math.max(100,delay*0.4));
      return()=>clearTimeout(t)}
    const t=setTimeout(()=>{const c=new Chess(game.fen());const b=best(c,lv.depth,lv.rand);if(b)exec(b.from as Square,b.to as Square,b.promotion as any);sThink(false)},delay);
    return()=>clearTimeout(t)},[bk,over,on,tab]);

  /* ── Click: normal move OR premove ── */
  const click=useCallback((sq:Square)=>{
    if(over)return;
    const isAiTurn=game.turn()!==pCol;

    // ── PREMOVE MODE (during AI turn OR thinking) ──
    if((isAiTurn||think)&&on){
      const p=game.get(sq);
      if(pmSel){
        if(sq===pmSel){sPmSel(null);return} // deselect
        if(pms.length>=pmLim){showToast(`Max ${pmLim} premoves`,"error");sPmSel(null);return}
        const pp=game.get(pmSel);
        const pre:Pre={from:pmSel,to:sq};
        if(pp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.pr="q";
        sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}
      // Click on premoved square → remove that premove
      const pmIdx=pms.findIndex(p=>p.to===sq||p.from===sq);
      if(pmIdx>=0){sPms(v=>[...v.slice(0,pmIdx),...v.slice(pmIdx+1)]);return}
      if(p?.color===pCol){sPmSel(sq);return}
      sPmSel(null);return}

    // ── NORMAL MODE ──
    if(think)return;
    const p=game.get(sq);
    if(sel){
      if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){sPromo({from:sel,to:sq});return}exec(sel,sq);return}
      if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)));return}
      sSel(null);sVm(new Set());return}
    if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}
  },[game,sel,vm,over,think,pCol,exec,on,pmSel,pms,pmLim,showToast]);

  /* ── Drag ── */
  const dRef=useRef<Square|null>(null);
  const dS=(sq:Square)=>{const p=game.get(sq);if(p?.color===pCol&&!over){dRef.current=sq;if(game.turn()===pCol&&!think){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}else sPmSel(sq)}};
  const dD=(sq:Square)=>{if(!dRef.current)return;const f=dRef.current;dRef.current=null;
    if((game.turn()!==pCol||think)&&on&&!over){if(pms.length>=pmLim)return;const p=game.get(f);const pre:Pre={from:f,to:sq};if(p?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.pr="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}
    if(vm.has(sq)){const mp=game.get(f);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))sPromo({from:f,to:sq});else exec(f,sq)}else{sSel(null);sVm(new Set())}};

  const newG=(c?:ChessColor)=>{const cl=c||pCol;setGame(new Chess());sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([new Chess().fen()]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);sEvalCp(0);sEvalMate(0);sAnalysis([]);sShowAnal(false);pT.reset();aT.reset();showToast(`Playing ${cl==="w"?"White":"Black"}`,"info")};
  const ldPz=(i:number)=>{const pz=fPz[i]||PUZZLES[0];const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(i);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sFenHist([pz.fen]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");sEvalCp(0);sEvalMate(0);showToast(`${pz.name} (${pz.r})`,"info")};

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

  const pmSet=new Set<string>();pms.forEach(p=>{pmSet.add(p.from);pmSet.add(p.to)});
  const bd=game.board(),rws=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cls=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

  const btn=(label:string,onClick:()=>void,bg:string,fg:string,border?:string)=>(<button onClick={onClick} style={{padding:"7px 14px",borderRadius:8,border:border||`1px solid ${T.border}`,background:bg,color:fg,fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>);

  return(<main style={{background:T.bg,minHeight:"100vh"}}>
    <ProductPageShell maxWidth={1060}><Wave1Nav/>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 0 10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"linear-gradient(135deg,#059669,#10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,color:"#fff"}}>♞</div>
          <div><div style={{fontSize:15,fontWeight:900,color:T.text}}>CyberChess</div><div style={{fontSize:10,color:T.dim}}>Stockfish 18 · {PUZZLES.length} puzzles{useSF&&sfOk?" · ⚡":""}</div></div>
        </div>
        <div style={{textAlign:"right"}}><div style={{fontSize:22,fontWeight:900,color:T.gold}}>{rat}</div><div style={{fontSize:10,color:T.dim}}>{rk.i} {rk.t}</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:2,marginBottom:14,background:T.surface,borderRadius:10,padding:3,width:"fit-content",border:`1px solid ${T.border}`}}>
        {(["play","puzzles"] as const).map(t=><button key={t} onClick={()=>{sTab(t);t==="play"?sSetup(true):ldPz(0)}} style={{padding:"7px 18px",border:"none",borderRadius:7,background:tab===t?T.accent:"transparent",color:tab===t?"#fff":T.dim,fontWeight:700,fontSize:12,cursor:"pointer"}}>{t==="play"?"Play":"Puzzles"}</button>)}
      </div>

      {/* Setup */}
      {setup&&tab==="play"&&<div style={{background:T.surface,borderRadius:14,padding:24,marginBottom:18,maxWidth:460,border:`1px solid ${T.border}`}}>
        <div style={{fontWeight:900,fontSize:17,color:T.text,marginBottom:18}}>New Game</div>
        <div style={{marginBottom:16}}><div style={{fontSize:10,color:T.dim,fontWeight:700,marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Color</div>
          <div style={{display:"flex",gap:8}}>{([["w","♔","White"],["b","♚","Black"]] as const).map(([v,ic,l])=><button key={v} onClick={()=>sPCol(v as ChessColor)} style={{flex:1,padding:"12px",borderRadius:10,border:pCol===v?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:pCol===v?"rgba(5,150,105,0.08)":"#fff",color:pCol===v?T.accent:T.dim,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><span style={{fontSize:18}}>{ic}</span>{l}</button>)}</div></div>
        <div style={{marginBottom:16}}><div style={{fontSize:10,color:T.dim,fontWeight:700,marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Time</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>{TCS.map((t,i)=><button key={i} onClick={()=>sTcI(i)} style={{padding:"7px 4px",borderRadius:7,border:tcI===i?`2px solid ${T.accent}`:`1px solid ${T.border}`,background:tcI===i?"rgba(5,150,105,0.08)":"#fff",color:tcI===i?T.accent:T.dim,fontSize:11,fontWeight:tcI===i?800:600,cursor:"pointer"}}>{t.name}</button>)}</div></div>
        <div style={{marginBottom:16}}><div style={{fontSize:10,color:T.dim,fontWeight:700,marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Opponent</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:5}}>{ALS.map((l,i)=><button key={i} onClick={()=>sAiI(i)} style={{padding:"9px 6px",borderRadius:9,border:aiI===i?`2px solid ${l.color}`:`1px solid ${T.border}`,background:aiI===i?`${l.color}12`:"#fff",cursor:"pointer",textAlign:"center"}}><div style={{fontSize:12,fontWeight:800,color:aiI===i?l.color:T.dim}}>{l.name}</div><div style={{fontSize:10,color:T.dim}}>{l.elo}{i>=3?" ⚡":""}</div></button>)}</div></div>
        <div style={{marginBottom:18}}><div style={{fontSize:10,color:T.dim,fontWeight:700,marginBottom:6,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Premove limit</div>
          <div style={{display:"flex",alignItems:"center",gap:10}}><input type="range" min={1} max={20} value={pmLim} onChange={e=>sPmLim(+e.target.value)} style={{flex:1,accentColor:T.accent}}/><span style={{fontSize:14,fontWeight:900,color:T.accent,minWidth:24,textAlign:"center"}}>{pmLim}</span></div>
          <div style={{fontSize:9,color:T.dim,marginTop:3}}>1 = lichess · 20 = chess.com style</div></div>
        <button onClick={()=>newG()} style={{width:"100%",padding:"13px",borderRadius:11,border:"none",background:`linear-gradient(135deg,${T.accent},#10b981)`,color:"#fff",fontWeight:900,fontSize:14,cursor:"pointer"}}>Start Game</button>
      </div>}

      {/* Board + Panel */}
      {(!setup||tab==="puzzles")&&<div style={{display:"flex",gap:14,flexWrap:"wrap",alignItems:"flex-start"}} onContextMenu={e=>{e.preventDefault();sPms([]);sPmSel(null)}}>
        <div style={{flexShrink:0}}>
          {tc.ini>0&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:5,width:"min(440px,calc(100vw - 48px))"}}>
            <div style={{padding:"6px 14px",borderRadius:8,background:game.turn()===aiC&&on&&!over?"#1e293b":T.surface,color:game.turn()===aiC&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:14,fontFamily:"monospace",border:`1px solid ${T.border}`}}>AI {fmt(aT.time)}</div>
            <div style={{padding:"6px 14px",borderRadius:8,background:myT&&on&&!over?T.accent:T.surface,color:myT&&on&&!over?"#fff":T.dim,fontWeight:800,fontSize:14,fontFamily:"monospace",border:`1px solid ${T.border}`}}>You {fmt(pT.time)}</div>
          </div>}

          <div translate="no" style={{display:"flex",width:"min(480px,calc(100vw - 32px))",gap:4}}>
            {/* Eval bar */}
            {sfOk&&on&&!setup&&(()=>{
              const cp=evalMate!==0?(evalMate>0?2000:-2000):Math.max(-1500,Math.min(1500,evalCp));
              const pct=50+cp/30; // -1500..1500 → 0..100
              const wPct=Math.max(2,Math.min(98,pct));
              const label=evalMate!==0?`M${Math.abs(evalMate)}`:(cp/100).toFixed(1);
              const whiteTop=flip;
              return(<div style={{width:18,borderRadius:3,overflow:"hidden",border:"1px solid #888",background:"#262626",position:"relative",display:"flex",flexDirection:"column"}}>
                {whiteTop?<>
                  <div style={{height:`${wPct}%`,background:"#f0f0f0",transition:"height 0.4s"}}/>
                  <div style={{flex:1,background:"#262626"}}/>
                </>:<>
                  <div style={{flex:1,background:"#262626"}}/>
                  <div style={{height:`${wPct}%`,background:"#f0f0f0",transition:"height 0.4s"}}/>
                </>}
                <div style={{position:"absolute",bottom:pct>50?"auto":2,top:pct>50?2:"auto",left:0,right:0,textAlign:"center",fontSize:8,fontWeight:900,color:pct>50?"#262626":"#f0f0f0",fontFamily:"monospace"}}>{label}</div>
              </div>);
            })()}
            <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:5,paddingLeft:2,width:14}}>{rws.map(r=><div key={r} style={{fontSize:9,color:T.dim,fontWeight:700,textAlign:"center"}}>{8-r}</div>)}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",borderRadius:5,overflow:"hidden",border:"2px solid #b58863",boxShadow:"0 4px 20px rgba(0,0,0,0.1)"}}>
              {rws.flatMap(r=>cls.map(c=>{const sq=`${FILES[c]}${8-r}` as Square;const p=bd[r][c];const lt=(r+c)%2===0;
                const iS=sel===sq,iV=vm.has(sq),iCp=iV&&!!p,iL=lm&&(lm.from===sq||lm.to===sq),iCk=chk&&p?.type==="k"&&p.color===game.turn(),iPM=pmSet.has(sq),iPS=pmSel===sq;
                let bg=lt?T.bL:T.bD;
                if(iCk)bg=T.chk;else if(iPS)bg=T.pmS;else if(iPM)bg=T.pm;else if(iS)bg=T.sel;else if(iCp)bg=T.cap;else if(iV)bg=T.valid;else if(iL)bg=T.last;
                return<div key={sq} onClick={()=>click(sq)} onDragStart={()=>dS(sq)} onDragOver={e=>e.preventDefault()} onDrop={()=>dD(sq)} draggable={!!p&&p.color===pCol&&!over}
                  style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(26px,5.2vw,44px)",background:bg,cursor:!over&&p?.color===pCol?"grab":"default",userSelect:"none",position:"relative",lineHeight:1}}>
                  {iV&&!p&&<div style={{width:"26%",height:"26%",borderRadius:"50%",background:"rgba(5,150,105,0.45)",position:"absolute"}}/>}
                  {p&&<div style={{width:"88%",height:"88%",transform:iS||iPS?"scale(1.08)":"none",filter:"drop-shadow(0 1px 2px rgba(0,0,0,0.3))"}}><Piece type={p.type} color={p.color}/></div>}
                </div>}))}
            </div>
          </div>
          <div style={{display:"flex",paddingLeft:21,width:"min(460px,calc(100vw - 32px))"}}><div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,marginTop:3}}>{cls.map(c=><div key={c} style={{textAlign:"center",fontSize:9,color:T.dim,fontWeight:700}}>{FILES[c]}</div>)}</div></div>

          {/* Controls */}
          <div style={{display:"flex",gap:5,marginTop:8,flexWrap:"wrap"}}>
            {btn("⇄ Flip",()=>sFlip(!flip),T.surface,T.dim)}
            {btn("New Game",()=>{sSetup(true);sOn(false);sOver(null);sPms([])},T.accent,"#fff","none")}
            {over&&btn("Rematch",()=>newG(),"#f59e0b","#fff","none")}
            {pms.length>0&&btn(`↩ Undo`,()=>sPms(p=>p.slice(0,-1)),"#eff6ff",T.blue,`1px solid rgba(37,99,235,0.3)`)}
            {pms.length>0&&btn(`✕ Clear (${pms.length})`,()=>{sPms([]);sPmSel(null)},"#fef2f2",T.danger,`1px solid rgba(220,38,38,0.2)`)}
          </div>
          {on&&!over&&!setup&&<div style={{display:"flex",gap:5,marginTop:5}}>
            {btn("🏳 Resign",()=>{if(!confirm("Resign?"))return;const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);const ns={...sts,l:sts.l+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("You resigned");snd("x")},"#fef2f2",T.danger,`1px solid rgba(220,38,38,0.2)`)}
            {btn("½ Draw",()=>{if(!confirm("Offer draw?"))return;if(Math.abs(ev(game))<200){const ns={...sts,d:sts.d+1};sSts(ns);svS(ns);sPms([]);sOn(false);sOver("Draw agreed");snd("x")}else showToast("AI declined","error")},"#fefce8","#92400e",`1px solid rgba(217,119,6,0.2)`)}
            {btn("↩ Take back",()=>{if(hist.length>=2){game.undo();game.undo();sHist(h=>h.slice(0,-2));sFenHist(h=>h.slice(0,-2));sLm(null);sSel(null);sVm(new Set());sBk(k=>k+1)}else showToast("No moves","error")},T.surface,T.dim)}
          </div>}
          {over&&fenHist.length>2&&<div style={{display:"flex",gap:5,marginTop:5}}>
            {btn(analyzing?"⚡ Analyzing...":showAnal?"🔽 Hide analysis":"🔍 Analyze game",runAnalysis,T.purple,"#fff","none")}
          </div>}
        </div>

        {/* Right panel */}
        <div style={{flex:"1 1 220px",minWidth:190,display:"flex",flexDirection:"column",gap:8}}>
          <div style={{padding:"10px 14px",borderRadius:9,background:over?(over.includes("You win")?"#ecfdf5":"#fef2f2"):chk?"#fef2f2":think?"#fffbeb":T.surface,border:`1px solid ${over?(over.includes("You win")?"#a7f3d0":"#fecaca"):chk?"#fecaca":T.border}`}}>
            {over?<><div style={{fontWeight:900,fontSize:14,color:over.includes("You win")?T.accent:T.danger}}>{over}</div><div style={{fontSize:10,color:T.dim,marginTop:3}}>{hist.length} moves · {rat} {rk.i}</div></>:
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              <div style={{width:7,height:7,borderRadius:4,background:chk?T.danger:think?T.gold:myT?T.accent:T.dim,animation:think?"pulse 1s infinite":"none"}}/>
              <span style={{fontWeight:700,fontSize:12,color:T.text}}>{chk?"Check!":think?(useSF?"Stockfish...":"Thinking..."):myT?"Your move":"AI thinking"}</span>
              {pms.length>0&&<span style={{padding:"1px 7px",borderRadius:4,fontSize:9,fontWeight:800,background:"#dbeafe",color:T.blue}}>{pms.length}</span>}
            </div>}
          </div>

          {on&&!setup&&<div style={{padding:"6px 10px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,fontSize:10,color:T.dim}}>
            <span style={{color:useSF?T.purple:T.blue}}>●</span> {useSF?`Stockfish depth ${SFD[aiI]||10}`:`Minimax depth ${lv.depth}`} · {lv.name} {lv.elo}
            {sfOk&&!over&&<span style={{marginLeft:8,color:evalMate!==0?(evalMate>0?T.accent:T.danger):Math.abs(evalCp)<30?T.dim:evalCp>0?T.accent:T.danger,fontWeight:700}}>
              Eval: {evalMate!==0?`M${Math.abs(evalMate)}`:(evalCp/100).toFixed(2)}
            </span>}
          </div>}

          {showAnal&&analysis.length>0&&<div style={{padding:"10px 12px",borderRadius:8,background:T.surface,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,fontWeight:800,color:T.text,marginBottom:6}}>Game Analysis</div>
            <div style={{display:"flex",gap:8,fontSize:10,color:T.dim,marginBottom:8,flexWrap:"wrap"}}>
              <span>🟢 {analysis.filter(a=>a.quality==="great").length} great</span>
              <span>⚪ {analysis.filter(a=>a.quality==="good").length} good</span>
              <span>🟡 {analysis.filter(a=>a.quality==="inacc").length} inacc</span>
              <span>🟠 {analysis.filter(a=>a.quality==="mistake").length} mistake</span>
              <span>🔴 {analysis.filter(a=>a.quality==="blunder").length} blunder</span>
            </div>
            <div style={{maxHeight:140,overflowY:"auto",display:"flex",flexDirection:"column",gap:2}}>
              {analysis.map((a,i)=>{
                const qColor={great:T.accent,good:T.dim,inacc:"#ca8a04",mistake:"#ea580c",blunder:T.danger}[a.quality];
                const qIcon={great:"🟢",good:"⚪",inacc:"🟡",mistake:"🟠",blunder:"🔴"}[a.quality];
                const san=hist[i]||"";const moveNum=Math.floor(i/2)+1;const isWhite=i%2===0;
                const evalStr=a.mate!==0?`M${Math.abs(a.mate)}`:(a.cp/100).toFixed(1);
                return(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 8px",borderRadius:5,background:a.quality==="blunder"?"#fee2e2":a.quality==="mistake"?"#fed7aa":a.quality==="inacc"?"#fef3c7":"transparent",fontSize:11}}>
                  <span style={{fontFamily:"monospace",color:T.text}}>{qIcon} {isWhite?`${moveNum}.`:`${moveNum}...`} {san}</span>
                  <span style={{fontFamily:"monospace",fontWeight:700,color:qColor}}>{evalStr}</span>
                </div>);
              })}
            </div>
          </div>}

          {pms.length>0&&<div style={{padding:"6px 10px",borderRadius:7,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:10,color:T.blue}}>
            Premoves: {pms.map((p,i)=><span key={i} style={{fontFamily:"monospace",marginLeft:3}}>{p.from}{p.to}</span>)}
          </div>}

          {(capB.length>0||capW.length>0)&&<div style={{padding:"6px 10px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`}}>
            {capB.length>0&&<div style={{fontSize:16,letterSpacing:1}} translate="no">{capB.join("")}</div>}
            {capW.length>0&&<div style={{fontSize:16,letterSpacing:1,opacity:0.5}} translate="no">{capW.join("")}</div>}
          </div>}

          <div ref={hR} style={{padding:"8px 10px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,maxHeight:140,overflowY:"auto"}}>
            <div style={{display:"flex",flexWrap:"wrap",gap:2}}>{hist.length?hist.map((m,i)=><span key={i} style={{padding:"1px 4px",borderRadius:3,fontSize:10,fontFamily:"monospace",background:i%2?"rgba(5,150,105,0.06)":"rgba(0,0,0,0.03)",color:i%2?T.accent:T.text,fontWeight:600}}>{i%2===0?`${Math.floor(i/2)+1}.`:""}{m}</span>):<span style={{fontSize:10,color:T.dim}}>No moves</span>}</div>
          </div>

          {tab==="puzzles"&&<div style={{background:T.surface,borderRadius:7,border:`1px solid ${T.border}`,padding:8}}>
            <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:6}}>
              <button onClick={()=>{sPzF("all");sPzI(0)}} style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:pzF==="all"?800:600,border:"none",background:pzF==="all"?T.accent:"transparent",color:pzF==="all"?"#fff":T.dim,cursor:"pointer"}}>All</button>
              {PZ_TH.map(th=><button key={th} onClick={()=>{sPzF(th);sPzI(0)}} style={{padding:"2px 7px",borderRadius:4,fontSize:9,fontWeight:pzF===th?800:600,border:"none",background:pzF===th?T.purple:"transparent",color:pzF===th?"#fff":T.dim,cursor:"pointer"}}>{th}</button>)}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:2,maxHeight:180,overflowY:"auto"}}>
              {fPz.map((pz,i)=><button key={i} onClick={()=>ldPz(i)} style={{padding:"5px 7px",borderRadius:5,border:"none",background:pzI===i?"rgba(124,58,237,0.08)":"transparent",fontSize:11,fontWeight:pzI===i?700:500,cursor:"pointer",color:pzI===i?T.purple:T.text,textAlign:"left",display:"flex",justifyContent:"space-between"}}><span>{pz.name}</span><span style={{fontSize:9,fontWeight:800,color:pz.r<600?T.accent:pz.r<1200?T.blue:pz.r<1800?T.purple:T.danger}}>{pz.r}</span></button>)}
            </div>
          </div>}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5}}>
            {[{v:sts.w,l:"W",c:T.accent},{v:sts.l,l:"L",c:T.danger},{v:sts.d,l:"D",c:T.dim}].map(s=><div key={s.l} style={{padding:"8px",borderRadius:7,background:T.surface,border:`1px solid ${T.border}`,textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:T.dim}}>{s.l}</div></div>)}
          </div>
        </div>
      </div>}

      {promo&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>sPromo(null)}>
        <div style={{background:"#fff",borderRadius:14,padding:20,border:`1px solid ${T.border}`}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:12,fontWeight:800,color:T.text,marginBottom:12,textAlign:"center"}}>Promote</div>
          <div style={{display:"flex",gap:8}}>{(["q","r","b","n"] as const).map(pt=><button key={pt} onClick={()=>{exec(promo.from,promo.to,pt);sPromo(null)}} style={{padding:"8px 12px",borderRadius:10,border:`1px solid ${T.border}`,background:"#fff",cursor:"pointer",width:60,height:60}}><Piece type={pt} color={pCol}/></button>)}</div>
        </div>
      </div>}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </ProductPageShell></main>);
}