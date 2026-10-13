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
var streak=0;try{var s0=parseInt(localStorage.getItem("cc_light_streak")||"0",10);if(s0>0&&s0<100000)streak=s0}catch(e){}
function streakShow(){var el=document.querySelector("[data-cc-streak]");if(el)el.textContent=String(streak)}function streakSet(v){streak=v;try{localStorage.setItem("cc_light_streak",String(v))}catch(e){}streakShow()}streakShow();
var hintBtn=document.querySelector("[data-cc-podskazka]"),hintSq=null,hintsUsed=0;
if(hintBtn)hintBtn.addEventListener("click",function(){if(busy||resheno)return;busy=true;post("hint",null,null).then(function(r){busy=false;if(!r||!r.from)return;hintSq=r.from;hintsUsed++;var b=board.querySelector('[data-sq="'+r.from+'"]');if(b)b.classList.add("h");st.textContent=C.texts.hintShown;st.className="wd s";ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"puzzle_hint",app:"cyberchess",id:C.id,hints:hintsUsed,surface:"light"}})}).catch(function(){busy=false})});
function hintClear(){if(!hintSq)return;var b=board.querySelector('[data-sq="'+hintSq+'"]');if(b)b.classList.remove("h");hintSq=null}
var shareBtn=document.querySelector("[data-cc-share]");
if(shareBtn)shareBtn.addEventListener("click",function(){var url=location.origin+location.pathname+"?c=tg-share";var done=function(how){ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"puzzle_share",app:"cyberchess",id:C.id,how:how,surface:"light"}})};if(navigator.share){navigator.share({title:C.texts.shareTitle,url:url}).then(function(){done("share")}).catch(function(){})}else{var p=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(url):Promise.reject();p.then(function(){st.textContent=C.texts.copied;st.className="wd s";done("copy")}).catch(function(){window.prompt(C.texts.copied,url);done("prompt")})}});
var zmV=1;try{var z0=parseFloat(localStorage.getItem("cc_light_zoom"));if(z0>=0.6&&z0<=1)zmV=z0}catch(e){}
function zmApply(){document.documentElement.style.setProperty("--zm",String(zmV));var l=document.querySelector("[data-zm-v]");if(l)l.textContent=Math.round(zmV*100)+"%"}
zmApply();
var zb=document.querySelectorAll("[data-zm]");for(var q=0;q<zb.length;q++){zb[q].addEventListener("click",function(e){var d=e.currentTarget.getAttribute("data-zm");zmV=Math.round((zmV+(d==="+"?0.1:-0.1))*10)/10;if(zmV<0.6)zmV=0.6;if(zmV>1)zmV=1;try{localStorage.setItem("cc_light_zoom",String(zmV))}catch(e){}zmApply();ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"board_zoom",app:"cyberchess",value:zmV,surface:"light"}})})}
ev({type:"feature_use",source:"cyberchess/link",meta:{feature:"puzzle_link_open",app:"cyberchess",puzzle:C.id,surface:"light"}});
var sel=null,targets=[],busy=false,pervyy=false,resheno=false,last=[],movable=C.movable||[],popytok=0,progressPoslan=false,popytkaPoslana=false;
function fenPieces(fen){var rows=fen.split(" ")[0].split("/"),m={};for(var r=0;r<8;r++){var f=0;for(var i=0;i<rows[r].length;i++){var ch=rows[r][i];if(ch>="1"&&ch<="8"){f+=+ch}else{var sq="abcdefgh"[f]+(8-r);m[sq]=(ch===ch.toUpperCase()?"w":"b")+ch.toLowerCase();f++}}}return m}
function draw(){var pcs=fenPieces(C.fen);var bs=board.querySelectorAll("[data-sq]");for(var i=0;i<bs.length;i++){var b=bs[i],sq=b.getAttribute("data-sq"),p=pcs[sq];var cf=b.getAttribute("data-cf"),cr=b.getAttribute("data-cr");b.innerHTML=(p?'<span class="'+(p[0]==="w"?"w":"b")+'">'+G[p]+"</span>":"")+(cf?'<i class="c f">'+cf+"</i>":"")+(cr?'<i class="c r">'+cr+"</i>":"");b.classList.toggle("sel",sel===sq);b.classList.toggle("last",last.indexOf(sq)>=0);var isT=targets.indexOf(sq)>=0;b.classList.toggle("t",isT);b.classList.toggle("p",isT&&!!p);b.classList.toggle("m",!resheno&&movable.indexOf(sq)>=0)}}
function post(akt,from,to){return fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({akt:akt,fen:C.fen,i:C.i,from:from,to:to})}).then(function(r){return r.json()})}
function hod(from,sq){busy=true;post("move",from,sq).then(function(r){busy=false;sel=null;targets=[];if(r.vid!=="ok"){popytok++;streakSet(0);st.textContent=C.texts.wrong;st.className="wd s err";draw();ev({type:"puzzle_wrong_move",source:"cyberchess/puzzle",meta:{app:"cyberchess",id:C.id,fen:C.ev.fen,rating:C.ev.rating,theme:C.ev.theme,"попытка":popytok,surface:"light"}});if(!popytkaPoslana&&!progressPoslan){popytkaPoslana=true;ev({type:"game_progress",source:"cyberchess/board",meta:{app:"cyberchess",plies:1,moves:0,attempts:popytok,"отПопытки":true,mode:"puzzle",surface:"light"}})}return}
C.fen=r.fen;C.i=r.i;hintClear();last=[from,sq];movable=r.movable||[];st.textContent=C.texts.yourMove;st.className="wd s";draw();if(!progressPoslan){progressPoslan=true;ev({type:"game_progress",source:"cyberchess/board",meta:{app:"cyberchess",plies:1,moves:0,attempts:popytok,"отПопытки":false,mode:"puzzle",surface:"light"}})}
if(!pervyy){pervyy=true;ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"first_move",app:"cyberchess",kontekst:"puzzle",surface:"light"}})}
if(r.reshena){resheno=true;streakSet(streak+1);st.textContent=C.texts.solved+(r.san&&r.san.length?" · "+C.texts.solution+": "+r.san.join(" "):"");resh.style.display="flex";ev({type:"puzzle_solved",source:"cyberchess/board",meta:{app:"cyberchess",id:C.id,fen:C.ev.fen,rating:C.ev.rating,theme:C.ev.theme,daily:!!C.ev.daily,streak:streak,hints:hintsUsed,surface:"light"}})}
}).catch(function(){busy=false})}
board.addEventListener("click",function(e){var b=e.target.closest("[data-sq]");if(!b||busy||resheno)return;var sq=b.getAttribute("data-sq");
if(sel&&targets.indexOf(sq)>=0){hod(sel,sq);return}
var pcs=fenPieces(C.fen);if(pcs[sq]&&pcs[sq][0]===C.storona){sel=sq;busy=true;post("targets",sq,null).then(function(r){busy=false;targets=r.targets||[];st.className="wd s";draw()}).catch(function(){busy=false});return}
sel=null;targets=[];draw()});
var dragFrom=null,ghost=null;
board.addEventListener("pointerdown",function(e){var b=e.target.closest("[data-sq]");if(!b||busy||resheno)return;var sq=b.getAttribute("data-sq");var pcs=fenPieces(C.fen);if(!(pcs[sq]&&pcs[sq][0]===C.storona))return;dragFrom=sq;if(sel!==sq){sel=sq;busy=true;post("targets",sq,null).then(function(r){busy=false;targets=r.targets||[];st.className="wd s";draw()}).catch(function(){busy=false})}try{board.setPointerCapture(e.pointerId)}catch(x){}});
board.addEventListener("pointermove",function(e){if(!dragFrom)return;if(!ghost){var pc=fenPieces(C.fen)[dragFrom];ghost=document.createElement("span");ghost.className="ghost "+(pc&&pc[0]==="w"?"w":"b");ghost.textContent=pc?G[pc]:"";document.body.appendChild(ghost)}ghost.style.left=e.clientX+"px";ghost.style.top=e.clientY+"px"});
function dragEnd(e){if(!dragFrom)return;var from=dragFrom;dragFrom=null;if(ghost){ghost.remove();ghost=null}var el=document.elementFromPoint?document.elementFromPoint(e.clientX,e.clientY):null;var b=el&&el.closest?el.closest("[data-sq]"):null;var sq=b?b.getAttribute("data-sq"):null;if(!sq||sq===from||busy)return;if(targets.indexOf(sq)>=0)hod(from,sq)}
board.addEventListener("pointerup",dragEnd);board.addEventListener("pointercancel",function(){dragFrom=null;if(ghost){ghost.remove();ghost=null}});
})();`;

