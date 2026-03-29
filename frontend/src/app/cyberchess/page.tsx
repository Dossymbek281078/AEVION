"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

/* ═══ TYPES ═══ */
type Color = "w" | "b";
type PT = "K"|"Q"|"R"|"B"|"N"|"P";
type Piece = {type:PT;color:Color}|null;
type Board = Piece[][];
type Sq = [number,number];
type Castle = {K:boolean;Q:boolean;k:boolean;q:boolean};
type GS = {board:Board;turn:Color;castle:Castle;ep:Sq|null;hm:number;fm:number};
type TimeControl = {name:string;initial:number;increment:number;label:string};
type AILv = {name:string;elo:number;depth:number;label:string;color:string};

/* ═══ CONSTANTS ═══ */
const F="abcdefgh";
const U:Record<string,string>={wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};

const TIME_CONTROLS:TimeControl[]=[
  {name:"1+0",initial:60,increment:0,label:"Bullet 1min"},
  {name:"3+0",initial:180,increment:0,label:"Blitz 3min"},
  {name:"3+2",initial:180,increment:2,label:"Blitz 3+2"},
  {name:"5+0",initial:300,increment:0,label:"Blitz 5min"},
  {name:"5+3",initial:300,increment:3,label:"Blitz 5+3"},
  {name:"10+0",initial:600,increment:0,label:"Rapid 10min"},
  {name:"10+5",initial:600,increment:5,label:"Rapid 10+5"},
  {name:"15+10",initial:900,increment:10,label:"Rapid 15+10"},
  {name:"30+0",initial:1800,increment:0,label:"Classical 30min"},
  {name:"∞",initial:0,increment:0,label:"No limit"},
];

const AI_LVS:AILv[]=[
  {name:"Beginner",elo:400,depth:1,label:"Новичок",color:"#94a3b8"},
  {name:"Casual",elo:800,depth:2,label:"Любитель",color:"#0d9488"},
  {name:"Club",elo:1200,depth:3,label:"Клубный",color:"#2563eb"},
  {name:"Advanced",elo:1600,depth:4,label:"Продвинутый",color:"#7c3aed"},
  {name:"Expert",elo:2000,depth:5,label:"Эксперт",color:"#dc2626"},
  {name:"Master",elo:2400,depth:6,label:"Мастер",color:"#b45309"},
];

const RANKS=[{min:0,t:"Beginner",i:"●"},{min:600,t:"Novice",i:"◆"},{min:900,t:"Amateur",i:"■"},{min:1200,t:"Club",i:"▲"},{min:1500,t:"Tournament",i:"★"},{min:1800,t:"CM",i:"✦"},{min:2000,t:"FM",i:"✧"},{min:2200,t:"IM",i:"✪"},{min:2400,t:"GM",i:"♛"}];

const PUZZLES=[
  {fen:"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["h5f7"],name:"Scholar's Mate",r:400},
  {fen:"r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",sol:["c4f7"],name:"Fork Trick",r:800},
  {fen:"r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",sol:["d2d4"],name:"Center Control",r:600},
  {fen:"rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",sol:["d8h4"],name:"Fool's Mate",r:200},
  {fen:"r2qk2r/ppp2ppp/2n1bn2/2b1p3/4P3/1BP2N2/PP1P1PPP/RNBQK2R w KQkq - 6 6",sol:["d1a4"],name:"Pin Attack",r:1000},
];

/* ═══ ENGINE ═══ */
function initB():Board{const b:Board=Array.from({length:8},()=>Array(8).fill(null));const bk:PT[]=["R","N","B","Q","K","B","N","R"];for(let c=0;c<8;c++){b[0][c]={type:bk[c],color:"b"};b[1][c]={type:"P",color:"b"};b[6][c]={type:"P",color:"w"};b[7][c]={type:bk[c],color:"w"}}return b}
function clB(b:Board):Board{return b.map(r=>r.map(p=>p?{...p}:null))}
function inB(r:number,c:number){return r>=0&&r<8&&c>=0&&c<8}

function pseudoMoves(board:Board,r:number,c:number,castle:Castle,ep:Sq|null):Sq[]{
  const p=board[r][c];if(!p)return[];const ms:Sq[]=[];const en=p.color==="w"?"b":"w";
  const add=(nr:number,nc:number):boolean=>{if(!inB(nr,nc))return false;const t=board[nr][nc];if(t&&t.color===p.color)return false;ms.push([nr,nc]);return!t};
  const sl=(dr:number,dc:number)=>{for(let i=1;i<8;i++)if(!add(r+dr*i,c+dc*i))break};
  switch(p.type){
    case"P":{const d=p.color==="w"?-1:1;const s=p.color==="w"?6:1;
      if(inB(r+d,c)&&!board[r+d][c]){ms.push([r+d,c]);if(r===s&&!board[r+d*2][c])ms.push([r+d*2,c])}
      for(const dc of[-1,1]){const nr=r+d,nc=c+dc;if(inB(nr,nc)&&board[nr][nc]?.color===en)ms.push([nr,nc]);if(ep&&ep[0]===nr&&ep[1]===nc)ms.push([nr,nc])}break}
    case"N":for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,c+dc);break;
    case"B":sl(-1,-1);sl(-1,1);sl(1,-1);sl(1,1);break;
    case"R":sl(-1,0);sl(1,0);sl(0,-1);sl(0,1);break;
    case"Q":sl(-1,-1);sl(-1,1);sl(1,-1);sl(1,1);sl(-1,0);sl(1,0);sl(0,-1);sl(0,1);break;
    case"K":{for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc)add(r+dr,c+dc);
      if(p.color==="w"&&r===7&&c===4){if(castle.K&&!board[7][5]&&!board[7][6]&&board[7][7]?.type==="R")ms.push([7,6]);if(castle.Q&&!board[7][3]&&!board[7][2]&&!board[7][1]&&board[7][0]?.type==="R")ms.push([7,2])}
      if(p.color==="b"&&r===0&&c===4){if(castle.k&&!board[0][5]&&!board[0][6]&&board[0][7]?.type==="R")ms.push([0,6]);if(castle.q&&!board[0][3]&&!board[0][2]&&!board[0][1]&&board[0][0]?.type==="R")ms.push([0,2])}break}}
  return ms}

function findK(b:Board,co:Color):Sq{for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(b[r][c]?.type==="K"&&b[r][c]?.color===co)return[r,c];return[0,0]}
function attacked(b:Board,sq:Sq,by:Color):boolean{for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(b[r][c]?.color===by){const m=pseudoMoves(b,r,c,{K:false,Q:false,k:false,q:false},null);if(m.some(([mr,mc])=>mr===sq[0]&&mc===sq[1]))return true}return false}
function inCheck(b:Board,co:Color):boolean{return attacked(b,findK(b,co),co==="w"?"b":"w")}

function doMove(s:GS,from:Sq,to:Sq,promo?:PT):GS{
  const nb=clB(s.board);const p=nb[from[0]][from[1]]!;const cap=nb[to[0]][to[1]];const nc={...s.castle};let ne:Sq|null=null;
  if(p.type==="P"&&s.ep&&to[0]===s.ep[0]&&to[1]===s.ep[1])nb[from[0]][to[1]]=null;
  nb[to[0]][to[1]]=p;nb[from[0]][from[1]]=null;
  if(p.type==="P"&&(to[0]===0||to[0]===7))nb[to[0]][to[1]]={type:promo||"Q",color:p.color};
  if(p.type==="P"&&Math.abs(to[0]-from[0])===2)ne=[(from[0]+to[0])/2,from[1]];
  if(p.type==="K"&&Math.abs(to[1]-from[1])===2){if(to[1]===6){nb[to[0]][5]=nb[to[0]][7];nb[to[0]][7]=null}if(to[1]===2){nb[to[0]][3]=nb[to[0]][0];nb[to[0]][0]=null}}
  if(p.type==="K"){if(p.color==="w"){nc.K=false;nc.Q=false}else{nc.k=false;nc.q=false}}
  if(p.type==="R"){if(from[0]===7&&from[1]===7)nc.K=false;if(from[0]===7&&from[1]===0)nc.Q=false;if(from[0]===0&&from[1]===7)nc.k=false;if(from[0]===0&&from[1]===0)nc.q=false}
  return{board:nb,turn:s.turn==="w"?"b":"w",castle:nc,ep:ne,hm:p.type==="P"||cap?0:s.hm+1,fm:s.turn==="b"?s.fm+1:s.fm}}

function legal(s:GS,r:number,c:number):Sq[]{const p=s.board[r][c];if(!p||p.color!==s.turn)return[];return pseudoMoves(s.board,r,c,s.castle,s.ep).filter(([tr,tc])=>!inCheck(doMove(s,[r,c],[tr,tc]).board,s.turn))}
function hasLegal(s:GS):boolean{for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.board[r][c]?.color===s.turn&&legal(s,r,c).length>0)return true;return false}

function toSAN(s:GS,from:Sq,to:Sq,pr?:PT):string{
  const p=s.board[from[0]][from[1]]!;const cap=s.board[to[0]][to[1]]||(p.type==="P"&&s.ep&&to[0]===s.ep[0]&&to[1]===s.ep[1]);
  if(p.type==="K"&&to[1]-from[1]===2)return"O-O";if(p.type==="K"&&from[1]-to[1]===2)return"O-O-O";
  let san="";if(p.type!=="P")san+=p.type;else if(cap)san+=F[from[1]];if(cap)san+="x";san+=`${F[to[1]]}${8-to[0]}`;if(pr)san+=`=${pr}`;
  const ns=doMove(s,from,to,pr);if(inCheck(ns.board,ns.turn))san+=hasLegal(ns)?"+":"#";return san}

function fenToGS(fen:string):GS{
  const p=fen.split(" ");const rows=p[0].split("/");const b:Board=Array.from({length:8},()=>Array(8).fill(null));
  for(let r=0;r<8;r++){let c=0;for(const ch of rows[r]){if(ch>="1"&&ch<="8"){c+=parseInt(ch);continue}const co:Color=ch===ch.toUpperCase()?"w":"b";const u=ch.toUpperCase();const t:PT=u==="N"?"N":u==="K"?"K":u==="Q"?"Q":u==="R"?"R":u==="B"?"B":"P";b[r][c]={type:t,color:co};c++}}
  const ca:Castle={K:false,Q:false,k:false,q:false};const cs=p[2]||"-";if(cs.includes("K"))ca.K=true;if(cs.includes("Q"))ca.Q=true;if(cs.includes("k"))ca.k=true;if(cs.includes("q"))ca.q=true;
  let ep:Sq|null=null;if(p[3]&&p[3]!=="-"){ep=[8-parseInt(p[3][1]),F.indexOf(p[3][0])]}
  return{board:b,turn:(p[1]||"w")as Color,castle:ca,ep,hm:parseInt(p[4]||"0"),fm:parseInt(p[5]||"1")}}

/* ═══ AI ═══ */
const VALS:Record<PT,number>={P:100,N:320,B:330,R:500,Q:900,K:0};
const PST_P=[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PST_N=[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PST:Record<PT,number[]>={P:PST_P,N:PST_N,B:PST_N.map((_,i)=>[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20][i]),R:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],Q:PST_N.map((_,i)=>[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20][i]),K:[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30]};

function evaluate(b:Board):number{let s=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=b[r][c];if(!p)continue;const idx=p.color==="w"?r*8+c:(7-r)*8+c;s+=(p.color==="w"?1:-1)*(VALS[p.type]+(PST[p.type]?.[idx]||0))}return s}

function aiMove(s:GS,depth:number):{from:Sq;to:Sq}|null{
  const all:{from:Sq;to:Sq;sc:number}[]=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.board[r][c]?.color===s.turn)for(const to of legal(s,r,c)){
    const ns=doMove(s,[r,c],to);
    let sc=minimax(ns,Math.min(depth,4)-1,-Infinity,Infinity,s.turn==="w");
    // Add randomness based on depth (lower depth = more random)
    sc+=(Math.random()-0.5)*(depth<=1?200:depth<=2?80:depth<=3?30:10);
    all.push({from:[r,c],to,sc})}
  if(!all.length)return null;
  all.sort((a,b)=>s.turn==="b"?a.sc-b.sc:b.sc-a.sc);
  return all[0]}

function minimax(s:GS,d:number,a:number,b:number,max:boolean):number{
  if(d===0)return evaluate(s.board);
  const moves:{from:Sq;to:Sq}[]=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(s.board[r][c]?.color===s.turn)for(const to of legal(s,r,c))moves.push({from:[r,c],to});
  if(!moves.length)return inCheck(s.board,s.turn)?(max?-100000:100000):0;
  if(max){let best=-Infinity;for(const m of moves){best=Math.max(best,minimax(doMove(s,m.from,m.to),d-1,a,b,false));a=Math.max(a,best);if(b<=a)break}return best}
  else{let best=Infinity;for(const m of moves){best=Math.min(best,minimax(doMove(s,m.from,m.to),d-1,a,b,true));b=Math.min(b,best);if(b<=a)break}return best}}

/* ═══ SOUND ═══ */
function snd(t:"move"|"capture"|"check"|"castle"){try{const x=new AudioContext();const o=x.createOscillator();const g=x.createGain();o.connect(g);g.connect(x.destination);g.gain.value=0.06;o.frequency.value=t==="capture"?300:t==="check"?800:t==="castle"?500:600;o.type=t==="capture"?"sawtooth":"sine";o.start();o.stop(x.currentTime+0.08)}catch{}}

/* ═══ RATING ═══ */
const RK="aevion_chess_rating_v1";const SK="aevion_chess_stats_v1";
function ldR():number{try{return parseInt(localStorage.getItem(RK)||"800")}catch{return 800}}
function svR(r:number){try{localStorage.setItem(RK,String(Math.round(r)))}catch{}}
function ldS():{w:number;l:number;d:number}{try{const v=JSON.parse(localStorage.getItem(SK)||'{"w":0,"l":0,"d":0}');return{w:v.w||v.wins||0,l:v.l||v.losses||0,d:v.d||v.draws||0}}catch{return{w:0,l:0,d:0}}}
function svS(s:{w:number;l:number;d:number}){try{localStorage.setItem(SK,JSON.stringify(s))}catch{}}
function getRank(e:number){return[...RANKS].reverse().find(t=>e>=t.min)||RANKS[0]}

/* ═══ TIMER HOOK ═══ */
function useTimer(initial:number,increment:number,active:boolean,onTimeout:()=>void){
  const[time,setTime]=useState(initial);const ref=useRef<ReturnType<typeof setInterval>|null>(null);
  useEffect(()=>{setTime(initial)},[initial]);
  useEffect(()=>{if(ref.current)clearInterval(ref.current);
    if(active&&initial>0){ref.current=setInterval(()=>{setTime(t=>{if(t<=1){if(ref.current)clearInterval(ref.current);onTimeout();return 0}return t-1})},1000)}
    return()=>{if(ref.current)clearInterval(ref.current)}},[active,initial>0]);
  const addInc=useCallback(()=>{if(increment>0)setTime(t=>t+increment)},[increment]);
  const reset=useCallback(()=>{setTime(initial)},[initial]);
  return{time,addInc,reset}}

function fmtTime(s:number):string{if(s<=0)return"0:00";const m=Math.floor(s/60);const sec=s%60;return`${m}:${sec<10?"0":""}${sec}`}

/* ═══ COMPONENT ═══ */
export default function CyberChessPage(){
  const{showToast}=useToast();
  const[gs,setGs]=useState<GS>(()=>({board:initB(),turn:"w",castle:{K:true,Q:true,k:true,q:true},ep:null,hm:0,fm:1}));
  const[sel,setSel]=useState<Sq|null>(null);
  const[vm,setVm]=useState<Set<string>>(new Set());
  const[last,setLast]=useState<{from:Sq;to:Sq}|null>(null);
  const[over,setOver]=useState<string|null>(null);
  const[hist,setHist]=useState<string[]>([]);
  const[think,setThink]=useState(false);
  const[capW,setCapW]=useState<string[]>([]);
  const[capB,setCapB]=useState<string[]>([]);
  const[aiLv,setAiLv]=useState(2);
  const[promo,setPromo]=useState<{from:Sq;to:Sq}|null>(null);
  const[rating,setRating]=useState(800);
  const[stats,setStats]=useState({w:0,l:0,d:0});
  const[tab,setTab]=useState<"play"|"puzzles">("play");
  const[pzIdx,setPzIdx]=useState(0);
  const[flip,setFlip]=useState(false);
  const[kb,setKb]=useState("");
  const[playerColor,setPlayerColor]=useState<Color>("w");
  const[tcIdx,setTcIdx]=useState(9); // default: no limit
  const[started,setStarted]=useState(false);
  const[showSetup,setShowSetup]=useState(true);
  const hRef=useRef<HTMLDivElement>(null);
  const bRef=useRef<HTMLDivElement>(null);

  const tc=TIME_CONTROLS[tcIdx];
  const lv=AI_LVS[aiLv];
  const rk=getRank(rating);
  const aiColor:Color=playerColor==="w"?"b":"w";
  const isPlayerTurn=gs.turn===playerColor;
  const chk=inCheck(gs.board,gs.turn);

  const pTimer=useTimer(tc.initial,tc.increment,started&&isPlayerTurn&&!over&&tc.initial>0,()=>{setOver("Time out — AI wins");showToast("Time out!","error")});
  const aTimer=useTimer(tc.initial,tc.increment,started&&!isPlayerTurn&&!over&&tc.initial>0,()=>{setOver("AI ran out of time — you win!");showToast("AI timed out!","success")});

  useEffect(()=>{setRating(ldR());setStats(ldS())},[]);
  useEffect(()=>{hRef.current?.scrollTo({top:hRef.current.scrollHeight,behavior:"smooth"})},[hist]);

  /* ── Execute move ── */
  const exec=useCallback((from:Sq,to:Sq,pr?:PT)=>{
    const p=gs.board[from[0]][from[1]];if(!p)return;
    const cap=gs.board[to[0]][to[1]];const isEp=p.type==="P"&&gs.ep&&to[0]===gs.ep[0]&&to[1]===gs.ep[1];
    const san=toSAN(gs,from,to,pr);const ns=doMove(gs,from,to,pr);
    if(cap){(p.color===playerColor?setCapB:setCapW)(x=>[...x,U[`${(cap).color}${(cap).type}`]]);snd("capture")}
    else if(p.type==="K"&&Math.abs(to[1]-from[1])===2)snd("castle");
    else if(inCheck(ns.board,ns.turn))snd("check");else snd("move");
    if(isEp){const epP=gs.board[from[0]][to[1]];if(epP)(p.color===playerColor?setCapB:setCapW)(x=>[...x,U[`${epP.color}${epP.type}`]])}
    // Add increment
    if(gs.turn===playerColor)pTimer.addInc();else aTimer.addInc();
    setHist(h=>[...h,san]);setLast({from,to});setGs(ns);setSel(null);setVm(new Set());
    if(!hasLegal(ns)){
      if(inCheck(ns.board,ns.turn)){
        const playerWon=ns.turn===aiColor;
        setOver(playerWon?"Checkmate! You win!":"Checkmate. AI wins.");
        if(playerWon){const nr=Math.min(3000,rating+Math.max(5,Math.round((lv.elo-rating)*0.1+15)));setRating(nr);svR(nr);setStats(s=>{const n={...s,w:s.w+1};svS(n);return n});showToast(`Checkmate! +${nr-rating} rating`,"success")}
        else{const nr=Math.max(100,rating-Math.max(5,Math.round((rating-lv.elo)*0.1+10)));setRating(nr);svR(nr);setStats(s=>{const n={...s,l:s.l+1};svS(n);return n});showToast("Checkmate. AI wins.","error")}
      }else{setOver("Stalemate — draw");setStats(s=>{const n={...s,d:s.d+1};svS(n);return n});showToast("Stalemate","info")}}
  },[gs,rating,lv.elo,playerColor,aiColor,pTimer,aTimer,showToast]);

  /* ── AI ── */
  useEffect(()=>{
    if(gs.turn!==aiColor||over||!started||tab!=="play")return;
    setThink(true);
    const t=setTimeout(()=>{
      const m=aiMove(gs,lv.depth);
      if(!m){setThink(false);return}
      exec(m.from,m.to);setThink(false)},50);
    return()=>clearTimeout(t)},[gs.turn,over,started,tab]);

  // AI plays first if player chose black
  useEffect(()=>{if(started&&playerColor==="b"&&gs.turn==="w"&&hist.length===0&&tab==="play"){
    setThink(true);const t=setTimeout(()=>{const m=aiMove(gs,lv.depth);if(m)exec(m.from,m.to);setThink(false)},50);return()=>clearTimeout(t)}},[started,playerColor]);

  /* ── Click ── */
  const click=useCallback((r:number,c:number)=>{
    if(over||think||gs.turn!==playerColor)return;const p=gs.board[r][c];
    if(sel){const k=`${r},${c}`;if(vm.has(k)){const mp=gs.board[sel[0]][sel[1]];if(mp?.type==="P"&&(r===0||r===7)){setPromo({from:sel,to:[r,c]});return}exec(sel,[r,c]);return}
      if(p?.color===playerColor){setSel([r,c]);setVm(new Set(legal(gs,r,c).map(([mr,mc])=>`${mr},${mc}`)));return}setSel(null);setVm(new Set());return}
    if(p?.color===playerColor){setSel([r,c]);setVm(new Set(legal(gs,r,c).map(([mr,mc])=>`${mr},${mc}`)))}},[gs,sel,vm,over,think,playerColor,exec]);

  /* ── Keyboard ── */
  const onKey=useCallback((e:React.KeyboardEvent)=>{
    if(e.key==="Escape"){setKb("");setSel(null);setVm(new Set());return}
    if(e.key==="Backspace"){setKb(p=>p.slice(0,-1));return}
    if(e.key.length!==1)return;const nx=kb+e.key.toLowerCase();setKb(nx);
    if(nx.length===4&&/^[a-h][1-8][a-h][1-8]$/.test(nx)){
      const fc=F.indexOf(nx[0]),fr=8-parseInt(nx[1]),tc2=F.indexOf(nx[2]),tr=8-parseInt(nx[3]);
      const lm=legal(gs,fr,fc);if(lm.some(([mr,mc])=>mr===tr&&mc===tc2)){const p=gs.board[fr][fc];if(p?.type==="P"&&(tr===0||tr===7))setPromo({from:[fr,fc],to:[tr,tc2]});else exec([fr,fc],[tr,tc2])}setKb("")}},[kb,gs,exec]);

  /* ── Drag ── */
  const dragRef=useRef<{r:number;c:number}|null>(null);
  const dStart=(r:number,c:number)=>{if(gs.board[r][c]?.color===playerColor&&gs.turn===playerColor&&!over&&!think){dragRef.current={r,c};setSel([r,c]);setVm(new Set(legal(gs,r,c).map(([mr,mc])=>`${mr},${mc}`)))}};
  const dDrop=(r:number,c:number)=>{if(!dragRef.current)return;const from:Sq=[dragRef.current.r,dragRef.current.c];
    if(vm.has(`${r},${c}`)){const p=gs.board[from[0]][from[1]];if(p?.type==="P"&&(r===0||r===7))setPromo({from,to:[r,c]});else exec(from,[r,c])}else{setSel(null);setVm(new Set())}dragRef.current=null};

  /* ── New game ── */
  const newGame=(color?:Color)=>{
    const c=color||playerColor;
    setGs({board:initB(),turn:"w",castle:{K:true,Q:true,k:true,q:true},ep:null,hm:0,fm:1});
    setSel(null);setVm(new Set());setLast(null);setOver(null);setHist([]);setCapW([]);setCapB([]);setPromo(null);setThink(false);setKb("");
    setPlayerColor(c);setFlip(c==="b");setStarted(true);setShowSetup(false);
    pTimer.reset();aTimer.reset();showToast(`New game — you play ${c==="w"?"white":"black"}`,"info")};

  const rows=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];
  const cols=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

  /* ═══ RENDER ═══ */
  return(
    <main>
      <ProductPageShell maxWidth={1040}>
        <Wave1Nav/>
        <div style={{borderRadius:20,overflow:"hidden",marginBottom:20}}>
          <div style={{background:"linear-gradient(135deg,#1c1917,#292524,#44403c)",padding:"24px 24px 18px",color:"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
              <div>
                <div style={{display:"inline-block",padding:"3px 10px",borderRadius:999,fontSize:10,fontWeight:800,letterSpacing:"0.08em",textTransform:"uppercase" as const,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",marginBottom:8}}>CyberChess by AEVION</div>
                <h1 style={{fontSize:22,fontWeight:900,margin:"0 0 4px",letterSpacing:"-0.03em"}}>Next-gen chess platform</h1>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:12,color:"#94a3b8"}}>Your rating</div>
                <div style={{fontSize:28,fontWeight:900}}>{rating}</div>
                <div style={{fontSize:12,color:lv.color}}>{rk.i} {rk.t}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:"inline-flex",borderRadius:10,border:"1px solid rgba(15,23,42,0.12)",overflow:"hidden",marginBottom:16}}>
          {(["play","puzzles"] as const).map(t=>(
            <button key={t} onClick={()=>{setTab(t);if(t==="play")setShowSetup(true);else{const pz=PUZZLES[pzIdx];setGs(fenToGS(pz.fen));setSel(null);setVm(new Set());setOver(null);setHist([]);setStarted(true);setShowSetup(false);showToast(`Puzzle: ${pz.name}`,"info")}}}
              style={{padding:"8px 18px",border:"none",background:tab===t?"#0f172a":"#fff",color:tab===t?"#fff":"#64748b",fontWeight:tab===t?800:600,fontSize:13,cursor:"pointer"}}>
              {t==="play"?"Play vs AI":"Puzzles"}
            </button>))}
        </div>

        {/* Setup screen */}
        {showSetup&&tab==="play"?(
          <div style={{border:"1px solid rgba(15,23,42,0.1)",borderRadius:16,padding:24,marginBottom:20,maxWidth:500}}>
            <div style={{fontWeight:900,fontSize:16,marginBottom:14}}>Game setup</div>
            
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Play as</div>
              <div style={{display:"flex",gap:6}}>
                {([["w","♔ White"],["b","♚ Black"],["r","⚄ Random"]] as const).map(([v,l])=>(
                  <button key={v} onClick={()=>v==="r"?setPlayerColor(Math.random()<0.5?"w":"b"):setPlayerColor(v as Color)}
                    style={{padding:"8px 16px",borderRadius:8,border:playerColor===v||(v==="r")?"2px solid #0f172a":"1px solid rgba(15,23,42,0.15)",background:playerColor===v?"#0f172a":"#fff",color:playerColor===v?"#fff":"#334155",fontWeight:700,fontSize:13,cursor:"pointer"}}>{l}</button>))}
              </div>
            </div>

            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Time control</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {TIME_CONTROLS.map((t,i)=>(
                  <button key={i} onClick={()=>setTcIdx(i)}
                    style={{padding:"5px 10px",borderRadius:8,border:tcIdx===i?"2px solid #0f172a":"1px solid rgba(15,23,42,0.12)",background:tcIdx===i?"#0f172a":"#fff",color:tcIdx===i?"#fff":"#64748b",fontSize:11,fontWeight:tcIdx===i?800:600,cursor:"pointer"}}>{t.name}</button>))}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>AI opponent</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {AI_LVS.map((l,i)=>(
                  <button key={i} onClick={()=>setAiLv(i)}
                    style={{padding:"5px 10px",borderRadius:8,border:aiLv===i?`2px solid ${l.color}`:"1px solid rgba(15,23,42,0.12)",background:aiLv===i?`${l.color}15`:"#fff",fontSize:11,fontWeight:aiLv===i?800:600,cursor:"pointer",color:aiLv===i?l.color:"#64748b"}}>{l.name} ({l.elo})</button>))}
              </div>
            </div>

            <button onClick={()=>newGame()} style={{padding:"12px 28px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#0d9488,#0ea5e9)",color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",boxShadow:"0 4px 14px rgba(13,148,136,0.35)"}}>
              Start game
            </button>
          </div>
        ):null}

        {/* Board + panel */}
        {(!showSetup||tab==="puzzles")?(
        <div style={{display:"flex",gap:20,flexWrap:"wrap",alignItems:"flex-start",outline:"none"}}>
          <div style={{flexShrink:0,outline:"none"}} ref={bRef} tabIndex={0} onKeyDown={onKey}>
            {/* Timers */}
            {tc.initial>0?(
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,width:"min(460px,calc(100vw - 48px))"}}>
                <div style={{padding:"4px 12px",borderRadius:8,background:gs.turn===aiColor?"#0f172a":"rgba(15,23,42,0.06)",color:gs.turn===aiColor?"#fff":"#64748b",fontWeight:800,fontSize:14,fontFamily:"monospace"}}>
                  AI {fmtTime(aTimer.time)}
                </div>
                <div style={{padding:"4px 12px",borderRadius:8,background:gs.turn===playerColor?"#0d9488":"rgba(15,23,42,0.06)",color:gs.turn===playerColor?"#fff":"#64748b",fontWeight:800,fontSize:14,fontFamily:"monospace"}}>
                  You {fmtTime(pTimer.time)}
                </div>
              </div>
            ):null}

            <div translate="no" style={{display:"grid",gridTemplateColumns:"repeat(8, 1fr)",width:"min(460px,calc(100vw - 48px))",aspectRatio:"1",borderRadius:10,overflow:"hidden",border:"2px solid #292524",touchAction:"none"}}>
              {rows.flatMap(r=>cols.map(c=>{
                const p=gs.board[r][c];const isL=(r+c)%2===0;const isSel=sel?.[0]===r&&sel?.[1]===c;const isV=vm.has(`${r},${c}`);const isCap=isV&&p!==null;
                const isLast=last&&((last.from[0]===r&&last.from[1]===c)||(last.to[0]===r&&last.to[1]===c));
                const isChk=chk&&p?.type==="K"&&p.color===gs.turn;
                let bg=isL?"#e8dcc8":"#a38b6e";
                if(isChk)bg="rgba(220,38,38,0.5)";else if(isSel)bg="rgba(59,130,246,0.45)";else if(isCap)bg="rgba(220,38,38,0.3)";else if(isV)bg=isL?"rgba(16,185,129,0.3)":"rgba(16,185,129,0.35)";else if(isLast)bg=isL?"rgba(245,158,11,0.25)":"rgba(245,158,11,0.3)";
                return(
                  <div key={`${r}-${c}`} onClick={()=>click(r,c)}
                    onDragStart={(e)=>{e.dataTransfer.effectAllowed="move";dStart(r,c)}} onDragOver={e=>e.preventDefault()} onDrop={()=>dDrop(r,c)}
                    draggable={!!p&&p.color===playerColor&&gs.turn===playerColor&&!over&&!think}
                    style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(26px,5vw,44px)",background:bg,cursor:!over&&!think&&isPlayerTurn&&p?.color===playerColor?"grab":"pointer",userSelect:"none",position:"relative",lineHeight:1}}>
                    {isV&&!p?<div style={{width:"24%",height:"24%",borderRadius:"50%",background:"rgba(16,185,129,0.5)",position:"absolute"}}/>:null}
                    {p?U[`${p.color}${p.type}`]:""}
                  </div>)}))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(8, 1fr)",width:"min(460px,calc(100vw - 48px))",marginTop:3}}>
              {cols.map(c=><div key={c} style={{textAlign:"center",fontSize:11,color:"#94a3b8",fontWeight:700}}>{F[c]}</div>)}
            </div>
            {kb?<div style={{marginTop:6,fontSize:13,fontFamily:"monospace",color:"#64748b",textAlign:"center"}}>Keyboard: <strong>{kb}</strong>_</div>:null}
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>setFlip(!flip)} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(15,23,42,0.15)",background:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Flip</button>
              <button onClick={()=>{setShowSetup(true);setStarted(false);setOver(null)}} style={{padding:"6px 12px",borderRadius:8,border:"none",background:"#0f172a",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>New game</button>
            </div>
          </div>

          {/* Side panel */}
          <div style={{flex:"1 1 260px",minWidth:220}}>
            <div style={{padding:"10px 14px",borderRadius:10,marginBottom:12,border:`1px solid ${over?"rgba(220,38,38,0.25)":chk?"rgba(220,38,38,0.35)":think?"rgba(245,158,11,0.3)":"rgba(16,185,129,0.25)"}`,background:over?"rgba(220,38,38,0.06)":chk?"rgba(220,38,38,0.06)":think?"rgba(245,158,11,0.06)":"rgba(16,185,129,0.06)"}}>
              <div style={{fontWeight:800,fontSize:14}}>{over?over:chk?"Check!":think?"AI thinking...":isPlayerTurn?"Your move":`AI's move`}</div>
            </div>

            {tab==="puzzles"?(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,color:"#64748b",fontWeight:700,marginBottom:6}}>Puzzles</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                  {PUZZLES.map((pz,i)=><button key={i} onClick={()=>{setPzIdx(i);setGs(fenToGS(pz.fen));setSel(null);setVm(new Set());setOver(null);setHist([]);showToast(`Puzzle: ${pz.name} (${pz.r})`,"info")}}
                    style={{padding:"5px 10px",borderRadius:8,border:pzIdx===i?"2px solid #7c3aed":"1px solid rgba(15,23,42,0.12)",background:pzIdx===i?"rgba(124,58,237,0.08)":"#fff",fontSize:11,fontWeight:pzIdx===i?800:600,cursor:"pointer",color:pzIdx===i?"#7c3aed":"#64748b"}}>{pz.name} ({pz.r})</button>)}
                </div>
              </div>):null}

            {capB.length>0?<div style={{marginBottom:8}}><div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Captured by you</div><div style={{fontSize:20,letterSpacing:1}} translate="no">{capB.join("")}</div></div>:null}
            {capW.length>0?<div style={{marginBottom:8}}><div style={{fontSize:11,color:"#94a3b8",fontWeight:600}}>Captured by AI</div><div style={{fontSize:20,letterSpacing:1}} translate="no">{capW.join("")}</div></div>:null}

            <div ref={hRef} style={{border:"1px solid rgba(15,23,42,0.1)",borderRadius:10,padding:10,maxHeight:200,overflowY:"auto",marginBottom:12}}>
              <div style={{fontSize:11,color:"#94a3b8",fontWeight:700,marginBottom:4}}>Moves ({hist.length})</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                {hist.map((m,i)=><span key={i} style={{padding:"2px 6px",borderRadius:5,fontSize:11,fontFamily:"monospace",background:i%2===0?"rgba(15,23,42,0.05)":"rgba(124,58,237,0.07)",color:i%2===0?"#334155":"#4c1d95",fontWeight:600}}>{i%2===0?`${Math.floor(i/2)+1}.`:""}{m}</span>)}
              </div>
            </div>

            <div style={{border:"1px solid rgba(15,23,42,0.1)",borderRadius:10,padding:12,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:800,marginBottom:6}}>Your stats</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,fontSize:12,textAlign:"center"}}>
                <div><div style={{fontWeight:900,fontSize:18,color:"#059669"}}>{stats.w}</div><div style={{color:"#94a3b8"}}>Wins</div></div>
                <div><div style={{fontWeight:900,fontSize:18,color:"#dc2626"}}>{stats.l}</div><div style={{color:"#94a3b8"}}>Losses</div></div>
                <div><div style={{fontWeight:900,fontSize:18,color:"#64748b"}}>{stats.d}</div><div style={{color:"#94a3b8"}}>Draws</div></div>
              </div>
              <div style={{marginTop:8,fontSize:12,color:"#64748b",textAlign:"center"}}>Rating: <strong style={{color:"#0f172a"}}>{rating}</strong> · {rk.i} {rk.t}</div>
            </div>

            <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid rgba(15,23,42,0.08)",background:"rgba(15,23,42,0.02)",fontSize:12,color:"#64748b",lineHeight:1.5}}>
              <strong>Controls:</strong> Click, drag, or type moves (e2e4). Works offline. Escape to cancel.
            </div>
          </div>
        </div>):null}

        {/* Promo modal */}
        {promo?<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>setPromo(null)}>
          <div style={{background:"#fff",borderRadius:16,padding:20,textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:14,fontWeight:800,marginBottom:12}}>Promote to:</div>
            <div style={{display:"flex",gap:12,justifyContent:"center"}} translate="no">
              {(["Q","R","B","N"] as PT[]).map(pt=><button key={pt} onClick={()=>{exec(promo.from,promo.to,pt);setPromo(null)}} style={{fontSize:36,padding:"8px 14px",borderRadius:12,border:"1px solid rgba(15,23,42,0.15)",background:"#fff",cursor:"pointer"}}>{U[`${playerColor}${pt}`]}</button>)}
            </div>
          </div>
        </div>:null}
      </ProductPageShell>
    </main>);
}
