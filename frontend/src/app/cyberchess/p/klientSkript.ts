import { GLIF } from "./logikaZadachi";

/**
 * Строка инлайн-скрипта для route.ts. Отдельный модуль — чтобы поведенческий сторож
 * исполнял тот же код в jsdom (мутация 13.10 сделала ветку мёртвой, а текстовый сторож
 * этого не увидел).
 */
/* Клиент лёгкой задачи: без React и chess.js. Цели и ходы спрашивает у сервера (POST сюда же). */
export const КЛИЕНТ = `(function(){var C=JSON.parse(document.getElementById("cc-cfg").textContent);var G=${JSON.stringify(GLIF)};
var main=document.querySelector("[data-cc-light-puzzle]");main.setAttribute("data-hydrated","1");
var board=document.querySelector("[data-cc-board]"),st=document.querySelector("[data-cc-status]"),resh=document.querySelector("[data-cc-resheno]");
var sid;try{sid=sessionStorage.getItem("aevion_gtm_sid");if(!sid){sid="s_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);sessionStorage.setItem("aevion_gtm_sid",sid)}}catch(e){sid="s_"+Date.now().toString(36)}
function ev(body){body.sid=sid;body.path=C.ev.path;if(body.meta){if(C.ev.channel)body.meta.channel=C.ev.channel;if(C.ev.post)body.meta.post=C.ev.post}try{if(navigator.webdriver)body.webdriver=true}catch(e){}var d=JSON.stringify(body);try{if(navigator.sendBeacon&&navigator.sendBeacon("/api-backend/api/pricing/events",new Blob([d],{type:"application/json"})))return}catch(e){}try{fetch("/api-backend/api/pricing/events",{method:"POST",headers:{"Content-Type":"application/json"},body:d,keepalive:true})}catch(e){}}
ev({type:"page_view",source:"cyberchess-p",meta:{surface:"light"}});
var zmV=1;try{var z0=parseFloat(localStorage.getItem("cc_light_zoom"));if(z0>=0.6&&z0<=1)zmV=z0}catch(e){}
function zmApply(){document.documentElement.style.setProperty("--zm",String(zmV));var l=document.querySelector("[data-zm-v]");if(l)l.textContent=Math.round(zmV*100)+"%"}
zmApply();
var zb=document.querySelectorAll("[data-zm]");for(var q=0;q<zb.length;q++){zb[q].addEventListener("click",function(e){var d=e.currentTarget.getAttribute("data-zm");zmV=Math.round((zmV+(d==="+"?0.1:-0.1))*10)/10;if(zmV<0.6)zmV=0.6;if(zmV>1)zmV=1;try{localStorage.setItem("cc_light_zoom",String(zmV))}catch(e){}zmApply();ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"board_zoom",app:"cyberchess",value:zmV,surface:"light"}})})}
ev({type:"feature_use",source:"cyberchess/link",meta:{feature:"puzzle_link_open",app:"cyberchess",puzzle:C.id,surface:"light"}});
var sel=null,targets=[],busy=false,pervyy=false,resheno=false,last=[],movable=C.movable||[],popytok=0,progressPoslan=false,popytkaPoslana=false;
function fenPieces(fen){var rows=fen.split(" ")[0].split("/"),m={};for(var r=0;r<8;r++){var f=0;for(var i=0;i<rows[r].length;i++){var ch=rows[r][i];if(ch>="1"&&ch<="8"){f+=+ch}else{var sq="abcdefgh"[f]+(8-r);m[sq]=(ch===ch.toUpperCase()?"w":"b")+ch.toLowerCase();f++}}}return m}
function draw(){var pcs=fenPieces(C.fen);var bs=board.querySelectorAll("[data-sq]");for(var i=0;i<bs.length;i++){var b=bs[i],sq=b.getAttribute("data-sq"),p=pcs[sq];b.innerHTML=p?'<span class="'+(p[0]==="w"?"w":"b")+'">'+G[p]+"</span>":"";b.classList.toggle("sel",sel===sq);b.classList.toggle("last",last.indexOf(sq)>=0);var isT=targets.indexOf(sq)>=0;b.classList.toggle("t",isT);b.classList.toggle("p",isT&&!!p);b.classList.toggle("m",!resheno&&movable.indexOf(sq)>=0)}}
function post(akt,from,to){return fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({akt:akt,fen:C.fen,i:C.i,from:from,to:to})}).then(function(r){return r.json()})}
board.addEventListener("click",function(e){var b=e.target.closest("[data-sq]");if(!b||busy||resheno)return;var sq=b.getAttribute("data-sq");
if(sel&&targets.indexOf(sq)>=0){busy=true;var from=sel;post("move",from,sq).then(function(r){busy=false;sel=null;targets=[];if(r.vid!=="ok"){popytok++;st.textContent=C.texts.wrong;st.className="wd s err";draw();ev({type:"puzzle_wrong_move",source:"cyberchess/puzzle",meta:{app:"cyberchess",id:C.id,fen:C.ev.fen,rating:C.ev.rating,theme:C.ev.theme,"попытка":popytok,surface:"light"}});if(!popytkaPoslana&&!progressPoslan){popytkaPoslana=true;ev({type:"game_progress",source:"cyberchess/board",meta:{app:"cyberchess",plies:1,moves:0,attempts:popytok,"отПопытки":true,mode:"puzzle",surface:"light"}})}return}
C.fen=r.fen;C.i=r.i;last=[from,sq];movable=r.movable||[];st.textContent=C.texts.yourMove;st.className="wd s";draw();if(!progressPoslan){progressPoslan=true;ev({type:"game_progress",source:"cyberchess/board",meta:{app:"cyberchess",plies:1,moves:0,attempts:popytok,"отПопытки":false,mode:"puzzle",surface:"light"}})}
if(!pervyy){pervyy=true;ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"first_move",app:"cyberchess",kontekst:"puzzle",surface:"light"}})}
if(r.reshena){resheno=true;st.textContent=C.texts.solved;resh.style.display="flex";ev({type:"puzzle_solved",source:"cyberchess/board",meta:{app:"cyberchess",id:C.id,fen:C.ev.fen,rating:C.ev.rating,theme:C.ev.theme,daily:false,surface:"light"}})}
}).catch(function(){busy=false});return}
var pcs=fenPieces(C.fen);if(pcs[sq]&&pcs[sq][0]===C.storona){sel=sq;busy=true;post("targets",sq,null).then(function(r){busy=false;targets=r.targets||[];st.className="wd s";draw()}).catch(function(){busy=false});return}
sel=null;targets=[];draw()});
})();`;

