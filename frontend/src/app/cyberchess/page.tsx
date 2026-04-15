"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Chess, type Square, type PieceSymbol, type Color as ChessColor, type Move } from "chess.js";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";

/* ═══ CONSTANTS ═══ */
const FILES = "abcdefgh";
const PIECE_MAP: Record<string, string> = {
  wk:"♔",wq:"♕",wr:"♖",wb:"♗",wn:"♘",wp:"♙",
  bk:"♚",bq:"♛",br:"♜",bb:"♝",bn:"♞",bp:"♟",
};
type TimeControl = {name:string;initial:number;increment:number;label:string};
type AILevel = {name:string;elo:number;depth:number;label:string;color:string;randomness:number;thinkMs:number};
type Premove = {from:Square;to:Square;promo?:"q"|"r"|"b"|"n"};

const TIME_CONTROLS: TimeControl[] = [
  {name:"1+0",initial:60,increment:0,label:"Bullet"},{name:"3+0",initial:180,increment:0,label:"Blitz"},
  {name:"3+2",initial:180,increment:2,label:"Blitz"},{name:"5+0",initial:300,increment:0,label:"Blitz"},
  {name:"5+3",initial:300,increment:3,label:"Blitz"},{name:"10+0",initial:600,increment:0,label:"Rapid"},
  {name:"10+5",initial:600,increment:5,label:"Rapid"},{name:"15+10",initial:900,increment:10,label:"Rapid"},
  {name:"30+0",initial:1800,increment:0,label:"Classical"},{name:"∞",initial:0,increment:0,label:"Unlimited"},
];
const AI_LEVELS: AILevel[] = [
  {name:"Beginner",elo:400,depth:1,label:"I",color:"#94a3b8",randomness:200,thinkMs:3000},
  {name:"Casual",elo:800,depth:2,label:"II",color:"#10b981",randomness:80,thinkMs:2000},
  {name:"Club",elo:1200,depth:3,label:"III",color:"#3b82f6",randomness:30,thinkMs:1200},
  {name:"Advanced",elo:1600,depth:4,label:"IV",color:"#a78bfa",randomness:12,thinkMs:800},
  {name:"Expert",elo:2000,depth:5,label:"V",color:"#f87171",randomness:5,thinkMs:400},
  {name:"Master",elo:2400,depth:6,label:"VI",color:"#fbbf24",randomness:2,thinkMs:200},
];
const SF_DEPTH: Record<number,number> = {3:8,4:12,5:16};
const RANKS = [
  {min:0,t:"Beginner",i:"●"},{min:600,t:"Novice",i:"◆"},{min:900,t:"Amateur",i:"■"},{min:1200,t:"Club",i:"▲"},
  {min:1500,t:"Tournament",i:"★"},{min:1800,t:"CM",i:"✦"},{min:2000,t:"FM",i:"✧"},{min:2200,t:"IM",i:"✪"},{min:2400,t:"GM",i:"♛"},
];

const PUZZLES = [
  {fen:"rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2",sol:["d8h4"],name:"Fool's Mate",r:200,theme:"Mate in 1"},
  {fen:"r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["h5f7"],name:"Scholar's Mate",r:400,theme:"Mate in 1"},
  {fen:"5rk1/ppp2ppp/8/8/8/8/PPP2PPP/R3R1K1 w - - 0 1",sol:["e1e8"],name:"Back Rank Mate",r:300,theme:"Mate in 1"},
  {fen:"6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1",sol:["e1e8"],name:"Simple Back Rank",r:250,theme:"Mate in 1"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 4 4",sol:["f3f7"],name:"Queen Mate Threat",r:450,theme:"Mate in 1"},
  {fen:"rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3",sol:["g2g3"],name:"Block the Check",r:350,theme:"Defense"},
  {fen:"r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 1 2",sol:["d2d4"],name:"Center Control",r:500,theme:"Opening"},
  {fen:"rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3",sol:["c4f7"],name:"Italian Game Trap",r:600,theme:"Tactics"},
  {fen:"r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 5",sol:["c4f7"],name:"Fork Trick",r:700,theme:"Fork"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",sol:["d2d4"],name:"Open Center",r:800,theme:"Opening"},
  {fen:"r1bqkbnr/ppp2ppp/2np4/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",sol:["c4f7"],name:"Fried Liver Setup",r:650,theme:"Tactics"},
  {fen:"r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 4",sol:["e1g1"],name:"Castle for Safety",r:550,theme:"Opening"},
  {fen:"rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",sol:["d2d4"],name:"Giuoco Piano Break",r:750,theme:"Opening"},
  {fen:"r2qk2r/ppp2ppp/2n1bn2/2b1p3/4P3/1BP2N2/PP1P1PPP/RNBQK2R w KQkq - 6 6",sol:["d1a4"],name:"Pin Attack",r:1000,theme:"Pin"},
  {fen:"r1bqk2r/pppp1Bpp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",sol:["e8f7"],name:"Recapture Decision",r:1100,theme:"Tactics"},
  {fen:"r2qkb1r/ppp2ppp/2n1bn2/3pp3/8/1B3N2/PPPP1PPP/RNBQ1RK1 w kq - 0 6",sol:["b3d5"],name:"Bishop Pin",r:900,theme:"Pin"},
  {fen:"r1bqk2r/ppppbppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 4 4",sol:["d2d4"],name:"Central Break",r:850,theme:"Opening"},
  {fen:"r2qkbnr/ppp2ppp/2n1p3/3pPb2/3P4/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 5",sol:["f1b5"],name:"Pin the Knight",r:950,theme:"Pin"},
  {fen:"r1b1kb1r/ppppqppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",sol:["b5c6"],name:"Discovered Attack",r:1200,theme:"Discovery"},
  {fen:"r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",sol:["f1b5"],name:"Ruy Lopez Pin",r:1050,theme:"Pin"},
  {fen:"r1bqk2r/ppp2ppp/2n2n2/3pp3/1bP5/2N2N2/PP1PPPPP/R1BQKB1R w KQkq d6 0 5",sol:["c4d5"],name:"Center Fork Trick",r:1150,theme:"Fork"},
  {fen:"r2qk2r/ppp1bppp/2n1bn2/3p4/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 6",sol:["e4d5"],name:"Pawn Center",r:1000,theme:"Tactics"},
  {fen:"r1b1kbnr/pppp1ppp/2n5/4p1q1/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",sol:["f3e5"],name:"Knight Fork Threat",r:1100,theme:"Fork"},
  {fen:"r2qk2r/pppb1ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 0 6",sol:["c3a4"],name:"Attack the Bishop",r:1250,theme:"Tactics"},
  {fen:"r1bqr1k1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQR1K1 w - - 0 8",sol:["c3d5"],name:"Knight Outpost",r:1400,theme:"Positional"},
  {fen:"r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Catalan Pawn Break",r:1250,theme:"Positional"},
  {fen:"r1bq1rk1/pp2bppp/2n1pn2/2pp4/4P3/2NP1N2/PPP1BPPP/R1BQ1RK1 w - - 0 7",sol:["e4d5"],name:"IQP Creation",r:1300,theme:"Positional"},
  {fen:"r2q1rk1/pp2bppp/2n1pn2/3p4/3P1B2/2N2N2/PPP1BPPP/R2Q1RK1 w - - 0 8",sol:["f3e5"],name:"Outpost Knight",r:1350,theme:"Positional"},
  {fen:"r1bq1rk1/ppp2ppp/2nb1n2/3pp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 6",sol:["c3a4"],name:"Knight Reposition",r:1200,theme:"Positional"},
  {fen:"r2q1rk1/pp1n1ppp/2p1pn2/3p1b2/1bPP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7",sol:["a2a3"],name:"Kick the Bishop",r:1500,theme:"Positional"},
  {fen:"2rq1rk1/pp1bppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/R4RK1 w - - 0 11",sol:["d4f5"],name:"Sacrifice Attack",r:1600,theme:"Sacrifice"},
  {fen:"r1b2rk1/2q1bppp/p2p1n2/np2p3/3PP3/2N2N1P/PPB2PP1/R1BQR1K1 w - - 0 13",sol:["d4d5"],name:"Space Advantage",r:1800,theme:"Strategy"},
  {fen:"r1bq1rk1/pp3ppp/2nbpn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Central Tension",r:1500,theme:"Strategy"},
  {fen:"r1bqk2r/ppp2ppp/2nb1n2/3pp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w kq - 0 5",sol:["e4d5"],name:"Pawn Break Timing",r:1550,theme:"Tactics"},
  {fen:"r2q1rk1/pppbbppp/2n1pn2/3p4/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Exchange Variation",r:1650,theme:"Strategy"},
  {fen:"r1bq1rk1/ppp2ppp/3bpn2/3p4/2PP1B2/2N2N2/PP2PPPP/R2QKB1R w KQ - 0 6",sol:["c4d5"],name:"Release Tension",r:1700,theme:"Strategy"},
  {fen:"r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R w KQ - 0 8",sol:["e1c1"],name:"Opposite Castling",r:1750,theme:"Attack"},
  {fen:"r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10",sol:["c3d5"],name:"Central Domination",r:2000,theme:"Positional"},
  {fen:"r2q1rk1/ppp1ppbp/2np1np1/8/2PPP1b1/2N2N2/PP2BPPP/R1BQ1RK1 w - - 0 8",sol:["d4d5"],name:"Pawn Storm",r:2200,theme:"Attack"},
  {fen:"r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1 w - - 0 7",sol:["d2d4"],name:"Central Expansion",r:1850,theme:"Strategy"},
  {fen:"r2qr1k1/pp1bbppp/2n1pn2/3p4/3P1B2/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 9",sol:["f3e5"],name:"Knight Invasion",r:1900,theme:"Attack"},
  {fen:"r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2N1PN2/PP2BPPP/R2Q1RK1 w - - 0 7",sol:["d4c5"],name:"Minority Attack Prep",r:1950,theme:"Strategy"},
  {fen:"rn1q1rk1/pp2bppp/2p1pn2/3p4/2PP4/2N1PN2/PP2BPPP/R1BQ1RK1 w - - 0 7",sol:["c4d5"],name:"Slav Exchange",r:2050,theme:"Positional"},
  {fen:"r1bqk2r/pp1nbppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R w KQkq - 0 6",sol:["f1d3"],name:"Development Tempo",r:2100,theme:"Opening"},
  {fen:"r1bq1rk1/pp3ppp/2n1pn2/2bp4/2P5/1PN1PN2/PB2BPPP/R2Q1RK1 w - - 0 8",sol:["c4d5"],name:"Hanging Pawns",r:2150,theme:"Strategy"},
  {fen:"8/8/4k3/8/8/8/4KP2/8 w - - 0 1",sol:["f2f4"],name:"King & Pawn vs King",r:800,theme:"Endgame"},
  {fen:"8/5pk1/8/8/8/8/R4PK1/8 w - - 0 1",sol:["a2a7"],name:"Rook on 7th Rank",r:900,theme:"Endgame"},
  {fen:"8/8/1k6/8/8/1K6/1R6/8 w - - 0 1",sol:["b2a2"],name:"Rook Cutoff",r:1000,theme:"Endgame"},
  {fen:"8/p7/1p6/8/P7/1P2k3/4p3/4K3 w - - 0 1",sol:["a4a5"],name:"Pawn Race",r:1300,theme:"Endgame"},
  {fen:"8/5p2/5k2/5p2/5P2/5K2/5P2/8 w - - 0 1",sol:["f3e3"],name:"Opposition",r:1400,theme:"Endgame"},
  {fen:"8/8/3k4/8/3K4/3P4/8/8 w - - 0 1",sol:["d4e4"],name:"Key Squares",r:1500,theme:"Endgame"},
  {fen:"6k1/pp3ppp/8/8/8/8/PPP2PPP/R5K1 w - - 0 1",sol:["a1a8"],name:"Back Rank Threat",r:1000,theme:"Mate in 2"},
  {fen:"6k1/5ppp/8/8/8/4Q3/5PPP/6K1 w - - 0 1",sol:["e3e8"],name:"Queen Invasion",r:1050,theme:"Mate in 2"},
  {fen:"r5k1/ppp2ppp/8/8/8/2B5/PPP2PPP/6K1 w - - 0 1",sol:["c3h8"],name:"Bishop Mate Pattern",r:1100,theme:"Mate in 2"},
];
const PUZZLE_THEMES = [...new Set(PUZZLES.map(p=>p.theme))].sort();

/* ═══ STOCKFISH ═══ */
class StockfishEngine{private w:Worker|null=null;private r=false;private cb:((f:string,t:string,p?:string)=>void)|null=null;init(){if(this.w)return;try{this.w=new Worker("/stockfish.js");this.w.onmessage=e=>{const l=typeof e.data==="string"?e.data:"";if(l.startsWith("bestmove")){const m=l.split(" ")[1];if(m&&m.length>=4&&this.cb){this.cb(m.slice(0,2),m.slice(2,4),m.length>4?m[4]:undefined);this.cb=null}}if(l==="uciok"){this.r=true;this.s("isready")}};this.s("uci")}catch{this.w=null}}private s(c:string){this.w?.postMessage(c)}isReady(){return this.r&&this.w!==null}findMove(fen:string,d:number,cb:(f:string,t:string,p?:string)=>void){if(!this.w){cb("","");return}this.cb=cb;this.s("ucinewgame");this.s(`position fen ${fen}`);this.s(`go depth ${d}`)}destroy(){this.w?.terminate();this.w=null;this.r=false}}

/* ═══ MINIMAX ═══ */
const PV:Record<PieceSymbol,number>={p:100,n:320,b:330,r:500,q:900,k:0};
const PST_P=[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0];
const PST_N=[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50];
const PST_B=[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20];
const PST_R=[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0];
const PST_Q=[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20];
const PST_K=[20,30,10,0,0,10,30,20,20,20,0,0,0,0,20,20,-10,-20,-20,-20,-20,-20,-20,-10,-20,-30,-30,-40,-40,-30,-30,-20,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30];
const PST:Record<PieceSymbol,number[]>={p:PST_P,n:PST_N,b:PST_B,r:PST_R,q:PST_Q,k:PST_K};
function ev(ch:Chess){let s=0;const b=ch.board();for(let r=0;r<8;r++)for(let c=0;c<8;c++){const q=b[r][c];if(!q)continue;s+=(q.color==="w"?1:-1)*(PV[q.type]+(PST[q.type]?.[(q.color==="w"?r*8+c:(7-r)*8+c)]||0))}return s}
function mm(ch:Chess,d:number,a:number,b:number,mx:boolean):number{if(d===0)return ev(ch);const mv=ch.moves({verbose:true});if(!mv.length)return ch.isCheckmate()?(mx?-1e5:1e5):0;if(mx){let best=-Infinity;for(const m of mv){ch.move(m);best=Math.max(best,mm(ch,d-1,a,b,false));ch.undo();a=Math.max(a,best);if(b<=a)break}return best}else{let best=Infinity;for(const m of mv){ch.move(m);best=Math.min(best,mm(ch,d-1,a,b,true));ch.undo();b=Math.min(b,best);if(b<=a)break}return best}}
function findBest(ch:Chess,depth:number,rand:number):Move|null{const mv=ch.moves({verbose:true});if(!mv.length)return null;const sc=mv.map(m=>{ch.move(m);const s=mm(ch,Math.min(depth,4)-1,-Infinity,Infinity,ch.turn()==="w");ch.undo();return{move:m,score:s+(Math.random()-0.5)*rand}});sc.sort((a,b)=>ch.turn()==="w"?b.score-a.score:a.score-b.score);return sc[0].move}

/* ═══ SOUND ═══ */
function snd(t: "move"|"capture"|"check"|"castle"|"gameover"|"premove"|"resign"|"draw") {
  try {
    const x = new AudioContext(), now = x.currentTime;
    const g = x.createGain(); g.connect(x.destination);
    if (t === "move" || t === "premove" || t === "castle") {
      // Clean soft click
      g.gain.setValueAtTime(t === "premove" ? 0.08 : 0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      const o = x.createOscillator(); o.connect(g); o.type = "sine";
      o.frequency.setValueAtTime(800, now);
      o.frequency.exponentialRampToValueAtTime(400, now + 0.06);
      o.start(now); o.stop(now + 0.08);
    } else if (t === "capture") {
      // Slightly thicker thud
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      const o = x.createOscillator(); o.connect(g); o.type = "sine";
      o.frequency.setValueAtTime(500, now);
      o.frequency.exponentialRampToValueAtTime(200, now + 0.1);
      o.start(now); o.stop(now + 0.12);
    } else if (t === "check") {
      // Two-tone alert
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      const o = x.createOscillator(); o.connect(g); o.type = "sine";
      o.frequency.setValueAtTime(660, now);
      o.frequency.setValueAtTime(880, now + 0.1);
      o.start(now); o.stop(now + 0.2);
    } else if (t === "gameover" || t === "resign") {
      // Gentle descending tone
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      const o = x.createOscillator(); o.connect(g); o.type = "sine";
      o.frequency.setValueAtTime(500, now);
      o.frequency.exponentialRampToValueAtTime(250, now + 0.5);
      o.start(now); o.stop(now + 0.5);
    } else if (t === "draw") {
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      const o = x.createOscillator(); o.connect(g); o.type = "sine";
      o.frequency.value = 440;
      o.start(now); o.stop(now + 0.3);
    }
  } catch {}
}

/* ═══ RATING ═══ */
const RK="aevion_chess_rating_v2",SK="aevion_chess_stats_v2";
function ldR(){try{return parseInt(localStorage.getItem(RK)||"800")}catch{return 800}}
function svR(r:number){try{localStorage.setItem(RK,String(Math.round(r)))}catch{}}
function ldS(){try{return JSON.parse(localStorage.getItem(SK)||'{"w":0,"l":0,"d":0}')}catch{return{w:0,l:0,d:0}}}
function svS(s:{w:number;l:number;d:number}){try{localStorage.setItem(SK,JSON.stringify(s))}catch{}}
function gR(e:number){return[...RANKS].reverse().find(t=>e>=t.min)||RANKS[0]}

/* ═══ TIMER ═══ */
function useTimer(ini:number,inc:number,act:boolean,onT:()=>void){const[t,sT]=useState(ini);const r=useRef<any>(null);useEffect(()=>{sT(ini)},[ini]);useEffect(()=>{if(r.current)clearInterval(r.current);if(act&&ini>0){r.current=setInterval(()=>{sT(v=>{if(v<=1){clearInterval(r.current);onT();return 0}return v-1})},1000)}return()=>{if(r.current)clearInterval(r.current)}},[act,ini>0]);return{time:t,addInc:useCallback(()=>{if(inc>0)sT(v=>v+inc)},[inc]),reset:useCallback(()=>{sT(ini)},[ini])}}
function fmt(s:number){if(s<=0)return"0:00";return`${Math.floor(s/60)}:${(s%60<10?"0":"")+(s%60)}`}
function pc(t:PieceSymbol,c:ChessColor){return PIECE_MAP[`${c}${t}`]||"?"}

/* ═══ STYLES ═══ */
const S = {
  bg: "#1e2433",
  surface: "#283042",
  surfaceHover: "#313b52",
  border: "rgba(255,255,255,0.08)",
  text: "#e8ecf4",
  textDim: "#8b95ab",
  accent: "#10b981",
  accentDim: "rgba(16,185,129,0.15)",
  gold: "#fbbf24",
  danger: "#f87171",
  blue: "#60a5fa",
  purple: "#a78bfa",
  boardLight: "#ecd8b8",
  boardDark: "#ae8a68",
  premove: "rgba(96,165,250,0.4)",
  premoveSel: "rgba(96,165,250,0.6)",
  selected: "rgba(16,185,129,0.5)",
  valid: "rgba(16,185,129,0.4)",
  capture: "rgba(248,113,113,0.4)",
  lastMove: "rgba(251,191,36,0.25)",
  check: "rgba(248,113,113,0.6)",
};

/* ═══ COMPONENT ═══ */
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
  const[pms,sPms]=useState<Premove[]>([]);
  const[pmSel,sPmSel]=useState<Square|null>(null);
  const[pmLimit,sPmLimit]=useState(3);
  const[aiLv,sAiLv]=useState(2);
  const[pCol,sPCol]=useState<ChessColor>("w");
  const[tcI,sTcI]=useState(9);
  const[on,sOn]=useState(false);
  const[setup,sSetup]=useState(true);
  const[flip,sFlip]=useState(false);
  const[tab,sTab]=useState<"play"|"puzzles">("play");
  const[pzI,sPzI]=useState(0);
  const[pzF,sPzF]=useState("all");
  const[sfSt,sSfSt]=useState<"off"|"loading"|"ready">("off");
  const[rat,sRat]=useState(800);
  const[sts,sSts]=useState({w:0,l:0,d:0});

  const tc=TIME_CONTROLS[tcI],lv=AI_LEVELS[aiLv],rk=gR(rat);
  const aiC:ChessColor=pCol==="w"?"b":"w";
  const myTurn=game.turn()===pCol,inChk=game.isCheck(),useSF=aiLv>=3;
  const pT=useTimer(tc.initial,tc.increment,on&&myTurn&&!over&&tc.initial>0,()=>{sOver("Time out — AI wins");snd("gameover")});
  const aT=useTimer(tc.initial,tc.increment,on&&!myTurn&&!over&&tc.initial>0,()=>{sOver("AI timed out — you win!");snd("gameover")});
  const hR=useRef<HTMLDivElement>(null),sfR=useRef<StockfishEngine|null>(null);
  const fPz=pzF==="all"?PUZZLES:PUZZLES.filter(p=>p.theme===pzF);

  useEffect(()=>{sRat(ldR());sSts(ldS())},[]);
  useEffect(()=>{hR.current?.scrollTo({top:hR.current.scrollHeight,behavior:"smooth"})},[hist]);
  useEffect(()=>{if(useSF&&!sfR.current){sSfSt("loading");const sf=new StockfishEngine();sf.init();sfR.current=sf;const c=setInterval(()=>{if(sf.isReady()){sSfSt("ready");clearInterval(c)}},200);const t=setTimeout(()=>{clearInterval(c);if(!sf.isReady())sSfSt("off")},10000);return()=>{clearInterval(c);clearTimeout(t)}}if(!useSF)sSfSt("off")},[useSF]);

  const exec=useCallback((from:Square,to:Square,pr?:"q"|"r"|"b"|"n")=>{const p=game.get(from);if(!p)return false;const mv=game.move({from,to,promotion:pr||"q"});if(!mv)return false;if(mv.captured)snd("capture");else if(mv.san.includes("O-"))snd("castle");else if(game.isCheck())snd("check");else snd("move");if(mv.captured){const cc=pc(mv.captured,mv.color==="w"?"b":"w");if(mv.color===pCol)sCapB(x=>[...x,cc]);else sCapW(x=>[...x,cc])}if(mv.color===pCol)pT.addInc();else aT.addInc();sHist(h=>[...h,mv.san]);sLm({from:mv.from,to:mv.to});sSel(null);sVm(new Set());sBk(k=>k+1);if(game.isGameOver()){let r="";if(game.isCheckmate()){const w=game.turn()===aiC;r=w?"Checkmate! You win! 🏆":"Checkmate — AI wins";if(w){const nr=Math.min(3000,rat+Math.max(5,Math.round((lv.elo-rat)*0.1+15)));sRat(nr);svR(nr);sSts(s=>{const n={...s,w:s.w+1};svS(n);return n});showToast(`+${nr-rat} rating`,"success")}else{const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);sSts(s=>{const n={...s,l:s.l+1};svS(n);return n})}}else if(game.isDraw()){r=game.isStalemate()?"Stalemate":game.isThreefoldRepetition()?"Threefold repetition":game.isInsufficientMaterial()?"Insufficient material":"50-move draw";sSts(s=>{const n={...s,d:s.d+1};svS(n);return n})}sOver(r);snd("gameover");sPms([])}return true},[game,rat,lv.elo,pCol,aiC,pT,aT,showToast,bk]);

  const tryPm=useCallback(()=>{if(game.turn()!==pCol||over||pms.length===0)return;const pm=pms[0];const rest=pms.slice(1);sPms(rest);const mvs=game.moves({verbose:true});const match=mvs.find(m=>m.from===pm.from&&m.to===pm.to);if(match){exec(pm.from,pm.to,pm.promo);snd("premove")}},[game,over,pms,pCol,exec]);

  useEffect(()=>{if(over||!on||tab!=="play")return;if(game.turn()===pCol){if(pms.length>0){const t=setTimeout(()=>tryPm(),30);return()=>clearTimeout(t)}return}
    sThink(true);
    // Think delay: base thinkMs ± 30% random variation to feel human
    const baseDelay = lv.thinkMs;
    const variation = baseDelay * 0.3;
    const delay = Math.max(100, baseDelay + (Math.random() - 0.5) * 2 * variation);

    if(useSF&&sfR.current?.isReady()){
      const sfDelay = Math.max(150, delay * 0.5); // Stockfish gets less artificial delay since it actually computes
      const t=setTimeout(()=>{sfR.current!.findMove(game.fen(),SF_DEPTH[aiLv]||10,(f,t2,p)=>{if(f&&t2)exec(f as Square,t2 as Square,(p||undefined) as any);sThink(false)})},sfDelay);
      return()=>clearTimeout(t);
    }
    const t=setTimeout(()=>{const c=new Chess(game.fen());const b=findBest(c,lv.depth,lv.randomness);if(b)exec(b.from as Square,b.to as Square,b.promotion as any);sThink(false)},delay);
    return()=>clearTimeout(t)},[bk,over,on,tab]);

  const click=useCallback((sq:Square)=>{if(over)return;if(game.turn()!==pCol&&!over&&on){const p=game.get(sq);if(pmSel){if(pms.length>=pmLimit){showToast(`Max ${pmLimit} premoves`,"error");sPmSel(null);return}const pp=game.get(pmSel);const pre:Premove={from:pmSel,to:sq};if(pp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.promo="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}if(p?.color===pCol){sPmSel(sq);return}sPmSel(null);return}if(think)return;const p=game.get(sq);if(sel){if(vm.has(sq)){const mp=game.get(sel);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8")){sPromo({from:sel,to:sq});return}exec(sel,sq);return}if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)));return}sSel(null);sVm(new Set());return}if(p?.color===pCol){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}},[game,sel,vm,over,think,pCol,exec,on,pmSel,pms,pmLimit]);

  const dR=useRef<Square|null>(null);
  const dS=(sq:Square)=>{const p=game.get(sq);if(p?.color===pCol&&!over){dR.current=sq;if(game.turn()===pCol&&!think){sSel(sq);sVm(new Set(game.moves({square:sq,verbose:true}).map(m=>m.to)))}else sPmSel(sq)}};
  const dD=(sq:Square)=>{if(!dR.current)return;const f=dR.current;dR.current=null;if(game.turn()!==pCol&&on&&!over){if(pms.length>=pmLimit){sPmSel(null);return}const p=game.get(f);const pre:Premove={from:f,to:sq};if(p?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))pre.promo="q";sPms(v=>[...v,pre]);sPmSel(null);snd("premove");return}if(vm.has(sq)){const mp=game.get(f);if(mp?.type==="p"&&(sq[1]==="1"||sq[1]==="8"))sPromo({from:f,to:sq});else exec(f,sq)}else{sSel(null);sVm(new Set())}};

  const newG=(c?:ChessColor)=>{const cl=c||pCol;setGame(new Chess());sBk(k=>k+1);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sCapW([]);sCapB([]);sPromo(null);sThink(false);sPms([]);sPmSel(null);sPCol(cl);sFlip(cl==="b");sOn(true);sSetup(false);pT.reset();aT.reset();showToast(`Playing ${cl==="w"?"White":"Black"}`,"info")};
  const ldPz=(i:number)=>{const pz=fPz[i]||PUZZLES[0];const g=new Chess(pz.fen);setGame(g);sBk(k=>k+1);sPzI(i);sSel(null);sVm(new Set());sLm(null);sOver(null);sHist([]);sCapW([]);sCapB([]);sOn(true);sSetup(false);sPms([]);sPmSel(null);sPCol(g.turn());sFlip(g.turn()==="b");showToast(`${pz.name} (${pz.r})`,"info")};

  const pmSet=new Set<string>();for(const p of pms){pmSet.add(p.from);pmSet.add(p.to)}
  const bd=game.board(),rws=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7],cls=flip?[7,6,5,4,3,2,1,0]:[0,1,2,3,4,5,6,7];

  /* ═══ RENDER ═══ */
  const timerBar=(label:string,time:number,active:boolean,isAI:boolean)=>(
    <div style={{padding:"10px 16px",background:active?isAI?S.surface:"rgba(16,185,129,0.12)":S.surface,borderRadius:10,border:`1px solid ${active?isAI?"rgba(248,113,113,0.2)":"rgba(16,185,129,0.3)":S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",transition:"all 0.2s"}}>
      <span style={{fontSize:12,fontWeight:700,color:S.textDim}}>{label}</span>
      <span style={{fontSize:20,fontWeight:900,fontFamily:"'SF Mono',monospace",color:active?isAI?S.danger:S.accent:S.textDim,letterSpacing:"0.05em"}}>{fmt(time)}</span>
    </div>
  );

  return(<main style={{background:S.bg,minHeight:"100vh"}}>
    <ProductPageShell maxWidth={1080}>
      <Wave1Nav/>

      {/* ── Minimal Header ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 0",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>♞</div>
          <div>
            <div style={{fontSize:16,fontWeight:900,color:S.text,letterSpacing:"-0.02em"}}>CyberChess</div>
            <div style={{fontSize:10,color:S.textDim}}>Stockfish 18 · {PUZZLES.length} puzzles{useSF&&sfSt==="ready"?" · ⚡ Engine active":""}</div>
          </div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:24,fontWeight:900,color:S.gold}}>{rat}</div>
          <div style={{fontSize:10,color:S.textDim}}>{rk.i} {rk.t}</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{display:"flex",gap:2,marginBottom:16,background:S.surface,borderRadius:10,padding:3,width:"fit-content"}}>
        {(["play","puzzles"] as const).map(t=>(
          <button key={t} onClick={()=>{sTab(t);if(t==="play")sSetup(true);else ldPz(0)}}
            style={{padding:"8px 20px",border:"none",borderRadius:8,background:tab===t?S.accent:"transparent",color:tab===t?"#fff":S.textDim,fontWeight:700,fontSize:12,cursor:"pointer",transition:"all 0.15s"}}>
            {t==="play"?"Play":"Puzzles"}
          </button>))}
      </div>

      {/* ── Setup ── */}
      {setup&&tab==="play"&&(
        <div style={{background:S.surface,borderRadius:16,padding:28,marginBottom:20,maxWidth:480,border:`1px solid ${S.border}`}}>
          <div style={{fontWeight:900,fontSize:18,color:S.text,marginBottom:20}}>New Game</div>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11,color:S.textDim,fontWeight:700,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Color</div>
            <div style={{display:"flex",gap:8}}>
              {([["w","♔","White"],["b","♚","Black"]] as const).map(([v,icon,l])=>(
                <button key={v} onClick={()=>sPCol(v as ChessColor)} style={{flex:1,padding:"14px",borderRadius:10,border:pCol===v?`2px solid ${S.accent}`:`1px solid ${S.border}`,background:pCol===v?S.accentDim:S.bg,color:pCol===v?S.accent:S.textDim,fontWeight:800,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span style={{fontSize:20}}>{icon}</span>{l}
                </button>))}
            </div>
          </div>
          <div style={{marginBottom:18}}>
            <div style={{fontSize:11,color:S.textDim,fontWeight:700,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Time</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
              {TIME_CONTROLS.map((t,i)=>(
                <button key={i} onClick={()=>sTcI(i)} style={{padding:"8px 4px",borderRadius:8,border:tcI===i?`2px solid ${S.accent}`:`1px solid ${S.border}`,background:tcI===i?S.accentDim:"transparent",color:tcI===i?S.accent:S.textDim,fontSize:11,fontWeight:tcI===i?800:600,cursor:"pointer"}}>{t.name}</button>))}
            </div>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,color:S.textDim,fontWeight:700,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Opponent</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
              {AI_LEVELS.map((l,i)=>(
                <button key={i} onClick={()=>sAiLv(i)} style={{padding:"10px 8px",borderRadius:10,border:aiLv===i?`2px solid ${l.color}`:`1px solid ${S.border}`,background:aiLv===i?`${l.color}18`:"transparent",cursor:"pointer",textAlign:"center"}}>
                  <div style={{fontSize:13,fontWeight:800,color:aiLv===i?l.color:S.textDim}}>{l.name}</div>
                  <div style={{fontSize:10,color:S.textDim}}>{l.elo}{i>=3?" ⚡":""}</div>
                </button>))}
            </div>
          </div>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:11,color:S.textDim,fontWeight:700,marginBottom:8,textTransform:"uppercase" as const,letterSpacing:"0.08em"}}>Premove Limit</div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <input type="range" min={1} max={20} value={pmLimit} onChange={e=>sPmLimit(Number(e.target.value))} style={{flex:1,accentColor:S.accent,cursor:"pointer"}}/>
              <span style={{fontSize:14,fontWeight:900,color:S.accent,minWidth:28,textAlign:"center"}}>{pmLimit}</span>
            </div>
            <div style={{fontSize:10,color:S.textDim,marginTop:4}}>How many moves you can queue during opponent&apos;s turn (1 = lichess style, 20 = chess.com style)</div>
          </div>
          <button onClick={()=>newG()} style={{width:"100%",padding:"14px",borderRadius:12,border:"none",background:`linear-gradient(135deg,${S.accent},#059669)`,color:"#fff",fontWeight:900,fontSize:15,cursor:"pointer",letterSpacing:"0.02em"}}>Start Game</button>
        </div>
      )}

      {/* ── Board + Panel ── */}
      {(!setup||tab==="puzzles")&&(
        <div style={{display:"flex",gap:16,flexWrap:"wrap",alignItems:"flex-start"}} onContextMenu={e=>{e.preventDefault();sPms([]);sPmSel(null)}}>
          <div style={{flexShrink:0}}>
            {/* Top timer (opponent) */}
            {tc.initial>0&&<div style={{marginBottom:6,width:"min(460px,calc(100vw - 48px))"}}>{timerBar("AI",aT.time,game.turn()===aiC&&on&&!over,true)}</div>}
            {/* Board */}
            <div translate="no" style={{display:"flex",width:"min(480px,calc(100vw - 32px))"}}>
              <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",paddingRight:6,width:16}}>
                {rws.map(r=><div key={r} style={{fontSize:9,color:S.textDim,fontWeight:700,textAlign:"center"}}>{8-r}</div>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,aspectRatio:"1",borderRadius:6,overflow:"hidden",border:`2px solid rgba(255,255,255,0.08)`,boxShadow:"0 12px 40px rgba(0,0,0,0.4)",touchAction:"none"}}>
                {rws.flatMap(r=>cls.map(c=>{
                  const sq=`${FILES[c]}${8-r}` as Square;const p=bd[r][c];const lt=(r+c)%2===0;
                  const iS=sel===sq,iV=vm.has(sq),iCap=iV&&p!==null,iL=lm&&(lm.from===sq||lm.to===sq),iCk=inChk&&p?.type==="k"&&p.color===game.turn(),iPM=pmSet.has(sq),iPMS=pmSel===sq;
                  let bg=lt?S.boardLight:S.boardDark;
                  if(iCk)bg=S.check;else if(iPMS)bg=S.premoveSel;else if(iPM)bg=S.premove;else if(iS)bg=S.selected;else if(iCap)bg=S.capture;else if(iV)bg=S.valid;else if(iL)bg=S.lastMove;
                  return(<div key={sq} onClick={()=>click(sq)} onDragStart={()=>dS(sq)} onDragOver={e=>e.preventDefault()} onDrop={()=>dD(sq)} draggable={!!p&&p.color===pCol&&!over}
                    style={{aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(28px,5.5vw,48px)",background:bg,cursor:!over&&p?.color===pCol?"grab":"default",userSelect:"none",position:"relative",lineHeight:1,boxShadow:iCk?"inset 0 0 16px rgba(248,113,113,0.7)":"none"}}>
                    {iV&&!p&&<div style={{width:"28%",height:"28%",borderRadius:"50%",background:"rgba(16,185,129,0.5)",position:"absolute"}}/>}
                    {p&&<span style={{filter:iCk?"drop-shadow(0 0 8px rgba(248,113,113,0.9))":p.color==="w"?"drop-shadow(0 1px 2px rgba(0,0,0,0.4))":"drop-shadow(0 1px 2px rgba(0,0,0,0.3))",transform:iS||iPMS?"scale(1.08)":"none"}}>{pc(p.type,p.color)}</span>}
                  </div>)}))}
              </div>
            </div>
            <div style={{display:"flex",paddingLeft:22,width:"min(480px,calc(100vw - 32px))"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",flex:1,marginTop:4}}>
                {cls.map(c=><div key={c} style={{textAlign:"center",fontSize:9,color:S.textDim,fontWeight:700}}>{FILES[c]}</div>)}
              </div>
            </div>
            {/* Bottom timer (you) */}
            {tc.initial>0&&<div style={{marginTop:6,width:"min(460px,calc(100vw - 48px))"}}>{timerBar("You",pT.time,myTurn&&on&&!over,false)}</div>}
            {/* Controls */}
            <div style={{display:"flex",gap:6,marginTop:10,flexWrap:"wrap"}}>
              <button onClick={()=>sFlip(!flip)} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:S.surface,color:S.textDim,fontSize:11,fontWeight:700,cursor:"pointer"}}>⇄ Flip</button>
              <button onClick={()=>{sSetup(true);sOn(false);sOver(null);sPms([])}} style={{padding:"7px 14px",borderRadius:8,border:"none",background:S.accent,color:"#fff",fontSize:11,fontWeight:800,cursor:"pointer"}}>New Game</button>
              {over&&<button onClick={()=>newG()} style={{padding:"7px 14px",borderRadius:8,border:"none",background:S.gold,color:"#000",fontSize:11,fontWeight:800,cursor:"pointer"}}>Rematch</button>}
              {pms.length>0&&<button onClick={()=>{sPms([]);sPmSel(null)}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid rgba(96,165,250,0.3)`,background:"rgba(96,165,250,0.1)",color:S.blue,fontSize:11,fontWeight:700,cursor:"pointer"}}>Clear premoves ({pms.length})</button>}
            </div>
            {/* Game actions: resign, draw, takeback */}
            {on&&!over&&!setup&&(
              <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                <button onClick={()=>{if(confirm("Resign this game?")){sOver("You resigned");snd("resign");const nr=Math.max(100,rat-Math.max(5,Math.round((rat-lv.elo)*0.1+10)));sRat(nr);svR(nr);sSts(s=>{const n={...s,l:s.l+1};svS(n);return n});sPms([])}}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid rgba(248,113,113,0.3)`,background:"rgba(248,113,113,0.08)",color:S.danger,fontSize:11,fontWeight:700,cursor:"pointer"}}>🏳 Resign</button>
                <button onClick={()=>{if(confirm("Offer draw? (AI will accept if position is roughly equal)")){const score=ev(game);if(Math.abs(score)<150){sOver("Draw by agreement");snd("draw");sSts(s=>{const n={...s,d:s.d+1};svS(n);return n});sPms([])}else{showToast("AI declined the draw","error")}}}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:S.surface,color:S.textDim,fontSize:11,fontWeight:700,cursor:"pointer"}}>½ Draw</button>
                <button onClick={()=>{if(hist.length>=2){game.undo();game.undo();sHist(h=>h.slice(0,-2));sLm(null);sSel(null);sVm(new Set());sBk(k=>k+1);showToast("Took back last move","info")}else{showToast("No moves to take back","error")}}} style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:S.surface,color:S.textDim,fontSize:11,fontWeight:700,cursor:"pointer"}}>↩ Takeback</button>
              </div>
            )}
          </div>

          {/* ── Right Panel ── */}
          <div style={{flex:"1 1 240px",minWidth:200,display:"flex",flexDirection:"column",gap:10}}>
            {/* Status */}
            <div style={{padding:"12px 16px",borderRadius:10,background:over?(over.includes("You win")?"rgba(16,185,129,0.1)":"rgba(248,113,113,0.08)"):inChk?"rgba(248,113,113,0.08)":think?"rgba(251,191,36,0.08)":S.surface,border:`1px solid ${over?(over.includes("You win")?"rgba(16,185,129,0.3)":"rgba(248,113,113,0.2)"):inChk?"rgba(248,113,113,0.2)":S.border}`}}>
              {over?<><div style={{fontWeight:900,fontSize:15,color:over.includes("You win")?S.accent:S.danger}}>{over}</div><div style={{fontSize:11,color:S.textDim,marginTop:4}}>{hist.length} moves · {rat} {rk.i}</div></>:
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:8,height:8,borderRadius:4,background:inChk?S.danger:think?S.gold:myTurn?S.accent:S.textDim,animation:think?"pulse 1s infinite":"none"}}/>
                <span style={{fontWeight:700,fontSize:13,color:S.text}}>{inChk?"Check!":think?(useSF?"Stockfish analyzing...":"Thinking..."):myTurn?"Your move":"Opponent's move"}</span>
                {pms.length>0&&<span style={{padding:"2px 8px",borderRadius:5,fontSize:9,fontWeight:800,background:"rgba(96,165,250,0.15)",color:S.blue}}>{pms.length}</span>}
              </div>}
            </div>

            {/* Engine */}
            {on&&!setup&&<div style={{padding:"8px 12px",borderRadius:8,background:S.bg,border:`1px solid ${S.border}`,fontSize:10,color:S.textDim}}>
              <span style={{color:useSF?S.purple:S.blue}}>●</span> {useSF?`Stockfish 18 · depth ${SF_DEPTH[aiLv]||10}`:`Minimax · depth ${lv.depth}`} · {lv.name} {lv.elo}
            </div>}

            {/* Captured */}
            {(capB.length>0||capW.length>0)&&<div style={{padding:"8px 12px",borderRadius:8,background:S.surface,border:`1px solid ${S.border}`}}>
              {capB.length>0&&<div style={{fontSize:18,letterSpacing:1,marginBottom:capW.length>0?4:0}} translate="no">{capB.join("")}</div>}
              {capW.length>0&&<div style={{fontSize:18,letterSpacing:1,opacity:0.6}} translate="no">{capW.join("")}</div>}
            </div>}

            {/* Moves */}
            <div ref={hR} style={{padding:"10px 12px",borderRadius:8,background:S.surface,border:`1px solid ${S.border}`,maxHeight:160,overflowY:"auto"}}>
              <div style={{display:"flex",flexWrap:"wrap",gap:2}}>
                {hist.length===0&&<span style={{fontSize:11,color:S.textDim}}>No moves yet</span>}
                {hist.map((m,i)=>(
                  <span key={i} style={{padding:"2px 5px",borderRadius:4,fontSize:10,fontFamily:"monospace",background:i%2===0?"rgba(255,255,255,0.04)":"rgba(16,185,129,0.06)",color:i%2===0?S.text:S.accent,fontWeight:600}}>
                    {i%2===0?`${Math.floor(i/2)+1}.`:""}{m}
                  </span>))}
              </div>
            </div>

            {/* Puzzles panel */}
            {tab==="puzzles"&&<div style={{background:S.surface,borderRadius:8,border:`1px solid ${S.border}`,padding:10}}>
              <div style={{display:"flex",gap:3,flexWrap:"wrap",marginBottom:8}}>
                <button onClick={()=>{sPzF("all");sPzI(0)}} style={{padding:"3px 8px",borderRadius:5,fontSize:9,fontWeight:pzF==="all"?800:600,border:"none",background:pzF==="all"?S.accent:"transparent",color:pzF==="all"?"#fff":S.textDim,cursor:"pointer"}}>All</button>
                {PUZZLE_THEMES.map(th=><button key={th} onClick={()=>{sPzF(th);sPzI(0)}} style={{padding:"3px 8px",borderRadius:5,fontSize:9,fontWeight:pzF===th?800:600,border:"none",background:pzF===th?S.purple:"transparent",color:pzF===th?"#fff":S.textDim,cursor:"pointer"}}>{th}</button>)}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:2,maxHeight:200,overflowY:"auto"}}>
                {fPz.map((pz,i)=>(
                  <button key={i} onClick={()=>ldPz(i)} style={{padding:"6px 8px",borderRadius:6,border:"none",background:pzI===i?`${S.purple}20`:"transparent",fontSize:11,fontWeight:pzI===i?700:500,cursor:"pointer",color:pzI===i?S.purple:S.text,textAlign:"left",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>{pz.name}</span>
                    <span style={{fontSize:9,fontWeight:800,color:pz.r<600?S.accent:pz.r<1200?S.blue:pz.r<1800?S.purple:S.danger}}>{pz.r}</span>
                  </button>))}
              </div>
            </div>}

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[{v:sts.w,l:"W",c:S.accent},{v:sts.l,l:"L",c:S.danger},{v:sts.d,l:"D",c:S.textDim}].map(s=>(
                <div key={s.l} style={{padding:"10px",borderRadius:8,background:S.surface,border:`1px solid ${S.border}`,textAlign:"center"}}>
                  <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:9,color:S.textDim,fontWeight:700}}>{s.l}</div>
                </div>))}
            </div>
          </div>
        </div>
      )}

      {/* Promotion */}
      {promo&&<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100}} onClick={()=>sPromo(null)}>
        <div style={{background:S.surface,borderRadius:16,padding:24,border:`1px solid ${S.border}`}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:13,fontWeight:800,color:S.text,marginBottom:14,textAlign:"center"}}>Promote</div>
          <div style={{display:"flex",gap:10}} translate="no">
            {(["q","r","b","n"] as const).map(pt=>(
              <button key={pt} onClick={()=>{exec(promo.from,promo.to,pt);sPromo(null)}} style={{fontSize:40,padding:"10px 14px",borderRadius:12,border:`1px solid ${S.border}`,background:S.bg,cursor:"pointer",lineHeight:1,transition:"transform 0.1s"}} onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.12)"}} onMouseLeave={e=>{e.currentTarget.style.transform="scale(1)"}}>
                {pc(pt,pCol)}
              </button>))}
          </div>
        </div>
      </div>}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </ProductPageShell>
  </main>);
}