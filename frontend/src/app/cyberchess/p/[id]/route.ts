/**
 * /cyberchess/p/<id> — лёгкая задача как Route Handler (волна 123в, 13.10.2026).
 *
 * Почему не страница React: корневой app/layout.tsx общий для всего сайта, и любая
 * страница везёт ClientProviders (словарь сайта 174 КБ, шапка, перевод, док агента —
 * ~420 КБ сжатого JS). Группа маршрутов со своим макетом невозможна, пока есть общий
 * корневой; ветка в нём по заголовку сделала бы динамическим весь сайт. Поэтому HTML
 * собирается здесь, доска приходит готовой, ходы проверяет сервер (POST), на клиенте —
 * инлайн-скрипт без React и без chess.js. Порог: сжатый JS ≤310 КБ, Fast 3G ≤2,8 с.
 *
 * Сохранено из 123: те же события воронки (puzzle_link_open/first_move/puzzle_solved,
 * channel/post из ?c= по той же таблице), язык ru/en/kk из словаря pz.*, ссылка на
 * полную версию с ?c=, og/description для превью.
 */
import { serverFetch } from "@/lib/apiBase";
import { channelFrom, postFrom } from "@/lib/products";
import { pzT, type PzYazyk } from "../pzSlova";
import { zadachaDlyaEkrana, zadanieNadDoskoy, imyaPoResheniyu, type PzLocale } from "../../puzzleNormalize";
import { GLIF, kletki, shag, sozdatSostoyanie, svoyaFigura, tseli } from "../logikaZadachi";
import { yazykZaprosa } from "../yazykZaprosa";

export const dynamic = "force-dynamic";

type Syraya = { fen: string; sol: string[]; name?: string; r?: number; theme?: string };
const КЭШ = new Map<string, { t: number; pz: Syraya | null }>();

async function zagruzit(id: string): Promise<Syraya | null> {
  const k = КЭШ.get(id);
  if (k && Date.now() - k.t < 10 * 60_000) return k.pz;
  let pz: Syraya | null = null;
  const r = await serverFetch(`/api/cyberchess-puzzles/${encodeURIComponent(id)}`, { timeoutMs: 4000, retries: 1 });
  if (r && r.ok) {
    try {
      const p = ((await r.json()) as { puzzle?: Partial<Syraya> })?.puzzle;
      if (p?.fen && Array.isArray(p.sol) && p.sol.length > 0) pz = { fen: p.fen, sol: p.sol, name: p.name, r: p.r, theme: p.theme };
    } catch { /* тело не JSON — задачи нет */ }
  }
  КЭШ.set(id, { t: Date.now(), pz });
  return pz;
}

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function html(p: { id: string; fen: string; zadanie: string; name: string; rating: number; theme: string; locale: PzYazyk; storona: "w" | "b"; polnaya: string; channel: string | null; post: string | null; path: string; title: string; description: string }): string {
  const t = (k: string) => pzT(p.locale, k);
  const ryady = kletki(p.fen, p.storona);
  const kletkiHtml = ryady.flat().map((k) => `<button type="button" data-sq="${k.sq}" class="${k.dark ? "d" : "l"}" aria-label="${k.sq}">${k.p ? `<span class="${k.p[0] === "w" ? "w" : "b"}">${GLIF[k.p]}</span>` : ""}</button>`).join("");
  const cfg = { id: p.id, fen: p.fen, i: 0, storona: p.storona, texts: { wrong: t("pz.wrong"), yourMove: t("pz.yourMove"), solved: t("pz.solved").replace("{name}", p.name) }, ev: { channel: p.channel, post: p.post, path: p.path, rating: p.rating, theme: p.theme, fen: p.fen } };
  return `<!doctype html><html lang="${p.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="noindex">
<link rel="canonical" href="https://aevion.app${esc(p.polnaya)}">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://aevion.app/cyberchess/p/${esc(p.id)}"><meta property="og:image" content="https://aevion.app/cyberchess/launch/opengraph-image"><meta name="twitter:card" content="summary_large_image">
<style>
:root{color-scheme:dark}*{box-sizing:border-box}html,body{margin:0;background:#0f172a;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{min-height:100dvh;display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px 12px 24px}
.wd{width:min(92vw,60vh,480px)}.hdr{display:flex;justify-content:space-between;align-items:baseline}.hdr b{font-size:15px}.hdr small{opacity:.75}
.z{font-size:15px;font-weight:800}
.b{aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:8px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.4);touch-action:manipulation;user-select:none}
.b button{position:relative;border:0;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:clamp(22px,7.5vmin,46px);line-height:1}
.b .l{background:#f0d9b5}.b .d{background:#b58863}.b .sel{background:#f6f669!important}.b .last.l{background:#cdd26a}.b .last.d{background:#aaa23a}
.b .w{color:#fff;text-shadow:0 0 2px #000,0 0 1px #000}.b .bk,.b .b{color:#111}
.b .t::after{content:"";position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,20,20,.3)}.b .t.p::after{width:86%;height:86%;background:transparent;border:4px solid rgba(20,20,20,.35)}
.s{min-height:24px;font-size:14px;font-weight:700;color:#a7f3d0}.s.err{color:#fca5a5}
.r{display:none;gap:10px;flex-wrap:wrap}.r a{padding:10px 16px;border-radius:8px;background:#059669;color:#fff;font-weight:900;text-decoration:none}
.f{font-size:13px;color:#93c5fd;text-decoration:underline}
</style></head><body><main data-cc-light-puzzle="${esc(p.id)}">
<div class="wd hdr"><b>♞ CyberChess</b><small>★ ${p.rating}</small></div>
<div class="wd z" data-cc-zadanie>${esc(p.zadanie)}</div>
<div class="wd b" data-cc-board="1" data-cc-puzzle="${esc(p.id)}" role="grid" aria-label="${esc(p.zadanie)}">${kletkiHtml}</div>
<div class="wd s" data-cc-status>${esc(t("pz.yourMove"))}</div>
<div class="wd r" data-cc-resheno><a href="${esc(p.polnaya)}">${esc(t("pz.next"))}</a></div>
<a class="wd f" data-cc-full href="${esc(p.polnaya)}">${esc(t("pz.fullVersion"))}</a>
</main>
<script id="cc-cfg" type="application/json">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script>
<script>${СКРИПТ}</script>
</body></html>`;
}

/* Клиент: без React и chess.js. Цели и ходы спрашивает у сервера (POST сюда же). */
const СКРИПТ = `(function(){var C=JSON.parse(document.getElementById("cc-cfg").textContent);var G=${JSON.stringify(GLIF)};
var main=document.querySelector("[data-cc-light-puzzle]");main.setAttribute("data-hydrated","1");
var board=document.querySelector("[data-cc-board]"),st=document.querySelector("[data-cc-status]"),resh=document.querySelector("[data-cc-resheno]");
var sid;try{sid=sessionStorage.getItem("aevion_gtm_sid");if(!sid){sid="s_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,10);sessionStorage.setItem("aevion_gtm_sid",sid)}}catch(e){sid="s_"+Date.now().toString(36)}
function ev(body){body.sid=sid;body.path=C.ev.path;if(body.meta){if(C.ev.channel)body.meta.channel=C.ev.channel;if(C.ev.post)body.meta.post=C.ev.post}try{if(navigator.webdriver)body.webdriver=true}catch(e){}var d=JSON.stringify(body);try{if(navigator.sendBeacon&&navigator.sendBeacon("/api-backend/api/pricing/events",new Blob([d],{type:"application/json"})))return}catch(e){}try{fetch("/api-backend/api/pricing/events",{method:"POST",headers:{"Content-Type":"application/json"},body:d,keepalive:true})}catch(e){}}
ev({type:"page_view",source:"cyberchess-p",meta:{}});
ev({type:"feature_use",source:"cyberchess/link",meta:{feature:"puzzle_link_open",app:"cyberchess",puzzle:C.id,surface:"light"}});
var sel=null,targets=[],busy=false,pervyy=false,resheno=false,last=[];
function fenPieces(fen){var rows=fen.split(" ")[0].split("/"),m={};for(var r=0;r<8;r++){var f=0;for(var i=0;i<rows[r].length;i++){var ch=rows[r][i];if(ch>="1"&&ch<="8"){f+=+ch}else{var sq="abcdefgh"[f]+(8-r);m[sq]=(ch===ch.toUpperCase()?"w":"b")+ch.toLowerCase();f++}}}return m}
function draw(){var pcs=fenPieces(C.fen);var bs=board.querySelectorAll("[data-sq]");for(var i=0;i<bs.length;i++){var b=bs[i],sq=b.getAttribute("data-sq"),p=pcs[sq];b.innerHTML=p?'<span class="'+(p[0]==="w"?"w":"b")+'">'+G[p]+"</span>":"";b.classList.toggle("sel",sel===sq);b.classList.toggle("last",last.indexOf(sq)>=0);var isT=targets.indexOf(sq)>=0;b.classList.toggle("t",isT);b.classList.toggle("p",isT&&!!p)}}
function post(akt,from,to){return fetch(location.pathname,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({akt:akt,fen:C.fen,i:C.i,from:from,to:to})}).then(function(r){return r.json()})}
board.addEventListener("click",function(e){var b=e.target.closest("[data-sq]");if(!b||busy||resheno)return;var sq=b.getAttribute("data-sq");
if(sel&&targets.indexOf(sq)>=0){busy=true;var from=sel;post("move",from,sq).then(function(r){busy=false;sel=null;targets=[];if(r.vid!=="ok"){st.textContent=C.texts.wrong;st.className="wd s err";draw();return}
C.fen=r.fen;C.i=r.i;last=[from,sq];st.textContent=C.texts.yourMove;st.className="wd s";draw();
if(!pervyy){pervyy=true;ev({type:"feature_use",source:"cyberchess/board",meta:{feature:"first_move",app:"cyberchess",kontekst:"puzzle"}})}
if(r.reshena){resheno=true;st.textContent=C.texts.solved;resh.style.display="flex";ev({type:"puzzle_solved",source:"cyberchess/board",meta:{app:"cyberchess",id:C.id,fen:C.ev.fen,rating:C.ev.rating,theme:C.ev.theme,daily:false,surface:"light"}})}
}).catch(function(){busy=false});return}
var pcs=fenPieces(C.fen);if(pcs[sq]&&pcs[sq][0]===C.storona){sel=sq;busy=true;post("targets",sq,null).then(function(r){busy=false;targets=r.targets||[];st.className="wd s";draw()}).catch(function(){busy=false});return}
sel=null;targets=[];draw()});
})();`;

/** Позиция после i ходов решения — чтобы не верить клиенту на слово. */
function sostoyanieNaShage(fen: string, sol: string[], i: number) {
  let s = sozdatSostoyanie(fen, sol);
  while (s.i < i && s.i < sol.length) {
    const u = sol[s.i];
    const r = shag(s, u.slice(0, 2), u.slice(2, 4));
    if (r.vid !== "ok") break;
    s = r.sostoyanie;
  }
  return s;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const syraya = await zagruzit(id);
  if (!syraya) return new Response("puzzle not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const locale = yazykZaprosa(req.headers.get("cookie"), url.searchParams.get("lang"), req.headers.get("accept-language"));
  const pz = zadachaDlyaEkrana({ fen: syraya.fen, sol: syraya.sol, name: syraya.name ?? "", r: syraya.r ?? 1200, theme: syraya.theme ?? "" });
  const zadanie = zadanieNadDoskoy(pz, locale);
  const name = imyaPoResheniyu(pz, locale) ?? (syraya.name || "");
  const keep = new URLSearchParams();
  for (const k of ["c", "probe", "p"]) { const v = url.searchParams.get(k); if (v) keep.set(k, v); }
  const polnaya = `/cyberchess?puzzle=${encodeURIComponent(id)}${keep.toString() ? "&" + keep.toString() : ""}`;
  const c = url.searchParams.get("c") ?? undefined;
  const title = `${zadanie} · CyberChess`;
  const description = locale === "ru" ? "Реши задачу прямо здесь — без регистрации. Полная версия: тренер, подсказки, 500 000 задач." : locale === "kk" ? "Есепті осы жерде шеш — тіркеусіз. Толық нұсқа: жаттықтырушы, кеңестер, 500 000 есеп." : "Solve it right here — no sign-up. Full version: coach, hints, 500,000 puzzles.";
  const body = html({ id, fen: pz.fen, zadanie, name, rating: pz.r ?? 1200, theme: pz.theme ?? "", locale, storona: sozdatSostoyanie(pz.fen, pz.sol).storona, polnaya, channel: channelFrom(c), post: postFrom(c), path: url.pathname + url.search, title, description });
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Vary": "Accept-Language, Cookie" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const syraya = await zagruzit(id);
  if (!syraya) return Response.json({ vid: "wrong", error: "puzzle not found" }, { status: 404 });
  let b: { akt?: string; fen?: string; i?: number; from?: string; to?: string } = {};
  try { b = (await req.json()) as typeof b; } catch { return Response.json({ vid: "wrong", error: "bad json" }, { status: 400 }); }
  const pz = zadachaDlyaEkrana({ fen: syraya.fen, sol: syraya.sol, name: syraya.name ?? "", r: syraya.r ?? 1200, theme: syraya.theme ?? "" });
  const i = Number.isInteger(b.i) && (b.i as number) >= 0 ? (b.i as number) : 0;
  const s = sostoyanieNaShage(pz.fen, pz.sol, i);
  if (b.fen !== s.fen) return Response.json({ vid: "wrong", error: "state mismatch", fen: s.fen, i: s.i }, { status: 409 });
  const from = String(b.from ?? "").slice(0, 2), to = String(b.to ?? "").slice(0, 2);
  if (b.akt === "targets") return Response.json({ targets: svoyaFigura(s, from) ? tseli(s.fen, from) : [] });
  const r = shag(s, from, to);
  if (r.vid !== "ok") return Response.json({ vid: "wrong" });
  return Response.json({ vid: "ok", fen: r.sostoyanie.fen, i: r.sostoyanie.i, reshena: r.reshena, otvet: r.otvet });
}
