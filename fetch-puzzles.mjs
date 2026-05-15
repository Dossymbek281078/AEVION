#!/usr/bin/env node
/**
 * Fetch puzzles from Lichess /training/batch (CC0, no auth needed).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "./frontend/node_modules/chess.js/dist/esm/chess.js";

const OUT = "./frontend/public/puzzles.json";
const existing = JSON.parse(readFileSync(OUT, "utf8"));
const existingIds = new Set(existing.map(p => p.id).filter(Boolean));
console.log(`Existing puzzles: ${existing.length}`);

const THEME_MAP = {
  fork:"Вилка",pin:"Связка",skewer:"Рентген",discoveredAttack:"Вскрытое нападение",
  doubleCheck:"Двойной шах",deflection:"Отвлечение",decoy:"Завлечение",
  interference:"Перекрытие",zugzwang:"Цугцванг",sacrifice:"Жертва",
  backRankMate:"Мат на последней горизонтали",smotheredMate:"Мат Филидора",
  promotion:"Превращение пешки",trappedPiece:"Поймана фигура",
  exposedKing:"Открытый король",advancedPawn:"Продвинутая пешка",
  kingsideAttack:"Атака на королевском",queensideAttack:"Атака на ферзевом",
  xRayAttack:"Рентген",clearance:"Расчистка",mateIn1:"Мат в 1",
  mateIn2:"Мат в 2",mateIn3:"Мат в 3",mateIn4:"Мат в 4",mateIn5:"Мат в 5+",
  endgame:"Эндшпиль",opening:"Дебютная ловушка",middlegame:"Миттельшпиль",
  hangingPiece:"Висящая фигура",rookEndgame:"Ладейный эндшпиль",
  queenEndgame:"Ферзевый эндшпиль",pawnEndgame:"Пешечный эндшпиль",
  bishopEndgame:"Слоновый эндшпиль",knightEndgame:"Конный эндшпиль",
  attraction:"Завлечение",equality:"Спасение",
};

function getPhase(themes){
  if(themes.some(t=>["endgame","rookEndgame","queenEndgame","pawnEndgame","bishopEndgame","knightEndgame"].includes(t)))return "Endgame";
  if(themes.includes("opening"))return "Opening";
  return "Middlegame";
}
function getMateIn(themes){
  for(const [t,n] of [["mateIn1",1],["mateIn2",2],["mateIn3",3],["mateIn4",4],["mateIn5",5]]){
    if(themes.includes(t))return n;
  }
  return undefined;
}

function convertPuzzle(lp){
  const{puzzle,game}=lp;
  if(!puzzle||!game)return null;
  const id=`li_${puzzle.id}`;
  if(existingIds.has(id))return null;
  const themes=puzzle.themes||[];
  const mateIn=getMateIn(themes);
  const isMate=themes.some(t=>t.startsWith("mate"))||mateIn!==undefined;
  const themeKey=themes.find(t=>THEME_MAP[t]&&!["short","long","oneMove","master","masterVsMaster"].includes(t))||themes[0];
  const theme=THEME_MAP[themeKey]||"Тактика";
  const phase=getPhase(themes);
  const rating=puzzle.rating||1200;
  let name=mateIn?`Мат в ${mateIn}`:theme;
  if(rating<800)name+=" · Новичок";
  else if(rating<1200)name+=" · Лёгкая";
  else if(rating<1600)name+=" · Средняя";
  else if(rating<2000)name+=" · Сложная";
  else name+=" · Мастер";

  try{
    const chess=new Chess();
    // Parse game PGN moves, play to initialPly
    const raw=game.pgn||"";
    // Tokenize: split on spaces, skip move numbers
    const tokens=raw.split(/\s+/).filter(t=>t&&!/^\d+\./.test(t)&&!t.startsWith("{")&&!t.endsWith("}"));
    let ply=0;
    for(const tok of tokens){
      if(ply>=puzzle.initialPly)break;
      try{chess.move(tok);ply++;}catch{/* skip annotation/result tokens */}
    }
    const fen=chess.fen();
    const side=chess.turn();
    return{id,fen,sol:puzzle.solution,name,r:rating,theme,phase,side,goal:isMate?"Mate":"Best move",...(mateIn?{mateIn}:{})};
  }catch{
    return null;
  }
}

const TARGET=400;
let tried=0,added=0;
const newPuzzles=[...existing];

while(tried<TARGET*3&&added<TARGET){
  tried++;
  try{
    const res=await fetch("https://lichess.org/training/batch",{
      headers:{Accept:"application/json","User-Agent":"AEVION-CyberChess/1.0"},
      signal:AbortSignal.timeout(8000),
    });
    if(!res.ok){process.stdout.write("!");await new Promise(r=>setTimeout(r,500));continue;}
    const data=await res.json();
    const converted=convertPuzzle(data);
    if(converted){
      newPuzzles.push(converted);
      existingIds.add(converted.id);
      added++;
      if(added%50===0)process.stdout.write(`\n${added} added`);
      else process.stdout.write(".");
    }else{
      process.stdout.write("-");
    }
    await new Promise(r=>setTimeout(r,150));
  }catch(e){
    process.stdout.write("x");
    await new Promise(r=>setTimeout(r,1000));
  }
}

console.log(`\n\nTotal added: ${added}, New total: ${newPuzzles.length}`);
writeFileSync(OUT,JSON.stringify(newPuzzles),"utf8");
console.log("✓ Written to puzzles.json");
