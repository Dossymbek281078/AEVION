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
import { GLIF, hodyashchie, kletki, shag, sozdatSostoyanie, svoyaFigura, tseli, resheniyeSan } from "../logikaZadachi";
import { yazykZaprosa } from "../yazykZaprosa";
import { КЛИЕНТ } from "../klientSkript";

export const dynamic = "force-dynamic";

type Syraya = { fen: string; sol: string[]; name?: string; r?: number; theme?: string; razbor?: { ru?: string; en?: string; kk?: string } };
const КЭШ = new Map<string, { t: number; pz: Syraya | null }>();

async function zagruzit(id: string): Promise<Syraya | null> {
  const k = КЭШ.get(id);
  if (k && Date.now() - k.t < 10 * 60_000) return k.pz;
  let pz: Syraya | null = null;
  // «daily» — задача дня: стабильная ссылка для роликов (/cyberchess/p/daily), сама задача меняется в полночь Алматы
  const r = await serverFetch(id === "daily" ? "/api/cyberchess-daily/puzzle" : `/api/cyberchess-puzzles/${encodeURIComponent(id)}`, { timeoutMs: 4000, retries: 1 });
  if (r && r.ok) {
    try {
      const telo = (await r.json()) as { puzzle?: Partial<Syraya> & { rating?: number }; razbor?: Syraya["razbor"] };
      const raw = telo?.puzzle;
      const p = raw && id === "daily" ? { ...raw, r: raw.r ?? raw.rating } : raw;
      // 142: разбор (ru/en/kk) приходит рядом с задачей; его нет — поля нет, страница живёт без него
      if (p?.fen && Array.isArray(p.sol) && p.sol.length > 0) pz = { fen: p.fen, sol: p.sol, name: p.name, r: p.r, theme: p.theme, razbor: telo?.razbor && typeof telo.razbor === "object" ? telo.razbor : undefined };
    } catch { /* тело не JSON — задачи нет */ }
  }
  КЭШ.set(id, { t: Date.now(), pz });
  return pz;
}

/** Следующая лёгкая задача близкого рейтинга (±150), случайная; при отказе бэкенда — полная версия.
 * Повод 13.10: после решения ссылка вела в монолит (900 КБ JS, 7 с на Fast 3G) — серия обрывалась на первой задаче. */
async function sleduyushchiyId(tekId: string, rating: number): Promise<string | null> {
  const q = new URLSearchParams({ shuffle: "1", limit: "3", minRating: String(Math.max(0, rating - 150)), maxRating: String(rating + 150) });
  const r = await serverFetch(`/api/cyberchess-puzzles?${q.toString()}`, { timeoutMs: 2500, retries: 0 });
  if (!r || !r.ok) return null;
  try {
    const list = ((await r.json()) as { puzzles?: Array<{ id?: string }> })?.puzzles ?? [];
    return list.map((x) => String(x?.id ?? "")).find((x) => x && x !== tekId) ?? null;
  } catch { return null; }
}
const adresZadachi = (id: string, keep: URLSearchParams) => `/cyberchess/p/${encodeURIComponent(id)}${keep.toString() ? "?" + keep.toString() : ""}`;
async function sleduyushchayaZadacha(tekId: string, rating: number, keep: URLSearchParams, polnaya: string): Promise<string> {
  const next = await sleduyushchiyId(tekId, rating);
  return next ? adresZadachi(next, keep) : polnaya;
}

/** Параметры, которые едут из задачи в задачу: метка канала, проба, пост. */
function keepIz(url: URL): URLSearchParams {
  const keep = new URLSearchParams();
  for (const k of ["c", "probe", "p"]) { const v = url.searchParams.get(k); if (v) keep.set(k, v); }
  return keep;
}

const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Vid = { id: string; fen: string; zadanie: string; name: string; rating: number; theme: string; locale: PzYazyk; storona: "w" | "b"; polnaya: string; sleduyushchaya: string; daily: boolean; channel: string | null; post: string | null; path: string; title: string; description: string };

/** Клетки доски готовым HTML — один источник для первого экрана (GET) и для «следующей» без перезагрузки (POST akt=next, очередь 14.10 п.1). */
function kletkiRazmetka(fen: string, storona: "w" | "b"): string {
  const ryady = kletki(fen, storona);
  const mogut = new Set(hodyashchie(fen, storona));
  // Координаты как у lichess: буква на нижнем ряду, цифра в левом столбце (в атрибутах — draw() их перерисовывает).
  return ryady.flatMap((ryad, r) => ryad.map((k, c) => {
    const cf = r === 7 ? ` data-cf="${k.sq[0]}"` : "";
    const cr = c === 0 ? ` data-cr="${k.sq[1]}"` : "";
    const koord = (r === 7 ? `<i class="c f">${k.sq[0]}</i>` : "") + (c === 0 ? `<i class="c r">${k.sq[1]}</i>` : "");
    return `<button type="button" data-sq="${k.sq}"${cf}${cr} class="${k.dark ? "d" : "l"}${mogut.has(k.sq) ? " m" : ""}" aria-label="${k.sq}">${k.p ? `<span class="${k.p[0] === "w" ? "w" : "b"}">${GLIF[k.p]}</span>` : ""}${koord}</button>`;
  })).join("");
}

/** Конфигурация инлайн-клиента (#cc-cfg) — та же для GET и для JSON «следующей». */
function konfigKlienta(p: Vid) {
  const t = (k: string) => pzT(p.locale, k);
  return { id: p.id, fen: p.fen, i: 0, storona: p.storona, movable: hodyashchie(p.fen, p.storona), texts: { wrong: t("pz.wrong"), yourMove: t("pz.yourMove"), hint: t("pz.hint"), solved: t("pz.solved").replace("{name}", p.name), hintShown: t("pz.hintShown"), copied: t("pz.copied"), shareTitle: p.title, solution: t("pz.solution") }, ev: { channel: p.channel, post: p.post, path: p.path, rating: p.rating, theme: p.theme, fen: p.fen, daily: p.daily } };
}

/** Всё, что нужно экрану задачи, из сырой задачи бэкенда: задание, имя, адреса «полной» и «следующей», заголовок. */
async function sobratVid(id: string, syraya: Syraya, locale: PzYazyk, url: URL): Promise<Vid> {
  const pz = zadachaDlyaEkrana({ fen: syraya.fen, sol: syraya.sol, name: syraya.name ?? "", r: syraya.r ?? 1200, theme: syraya.theme ?? "" });
  const zadanie = zadanieNadDoskoy(pz, locale);
  const name = imyaPoResheniyu(pz, locale) ?? (syraya.name || "");
  const keep = keepIz(url);
  const daily = id === "daily";
  const polnaya = daily ? `/cyberchess/daily${keep.toString() ? "?" + keep.toString() : ""}` : `/cyberchess?puzzle=${encodeURIComponent(id)}${keep.toString() ? "&" + keep.toString() : ""}`;
  const sleduyushchaya = await sleduyushchayaZadacha(id, pz.r ?? 1200, keep, polnaya);
  const c = url.searchParams.get("c") ?? undefined;
  const title = `${daily ? pzT(locale, "pz.daily") + " · " : ""}${zadanie} · CyberChess`;
  const description = locale === "ru" ? "Реши задачу прямо здесь — без регистрации. Полная версия: тренер, подсказки, 500 000 задач." : locale === "kk" ? "Есепті осы жерде шеш — тіркеусіз. Толық нұсқа: жаттықтырушы, кеңестер, 500 000 есеп." : "Solve it right here — no sign-up. Full version: coach, hints, 500,000 puzzles.";
  return { id, fen: pz.fen, zadanie, name, rating: pz.r ?? 1200, theme: pz.theme ?? "", locale, storona: sozdatSostoyanie(pz.fen, pz.sol).storona, polnaya, sleduyushchaya, daily, channel: channelFrom(c), post: postFrom(c), path: url.pathname + url.search, title, description };
}

/*
 * Разметка лёгкой задачи. Доска — главный объект: её сторона считается от ОКНА ПОЛЬЗОВАТЕЛЯ (слово основателя
 * 13.10: «как lichess/chess.com»), не от фиксированного предела. Телефон: столбец, доска ≈ вся ширина. Desktop (≥1024):
 * доска по высоте окна слева, справа панель задания/статуса 290–360 px — разметка lichess. --zm — ручной масштаб 0,6…1
 * («−/+»), помнится в localStorage. Комментарий здесь, а не в <style>: в en/kk-страницу кириллица не уезжает.
 */
function html(p: Vid): string {
  const t = (k: string) => pzT(p.locale, k);
  const kletkiHtml = kletkiRazmetka(p.fen, p.storona);
  const cfg = konfigKlienta(p);
  return `<!doctype html><html lang="${p.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.description)}"><meta name="robots" content="noindex">
<link rel="canonical" href="https://aevion.app${esc(p.polnaya)}">
<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://aevion.app/cyberchess/p/${esc(p.id)}"><meta property="og:image" content="https://aevion.app/cyberchess/launch/opengraph-image"><meta name="twitter:card" content="summary_large_image">
<style>
:root{color-scheme:dark;--zm:1;--side:min(92vw,100dvh - 150px)}*{box-sizing:border-box}html,body{margin:0;background:#0f172a;color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{min-height:100dvh;display:grid;grid-template-columns:1fr;justify-items:center;align-content:start;gap:10px;padding:10px 12px 20px}
.wd{width:calc(var(--zm)*var(--side))}.hdr{display:flex;justify-content:space-between;align-items:baseline}.hdr b{font-size:15px}.hdr small{opacity:.75}
@media(min-width:1024px){:root{--side:min(100dvh - 120px,100vw - 360px)}main{grid-template-columns:auto 290px;grid-template-rows:repeat(7,min-content) 1fr;justify-content:center;align-items:start;column-gap:20px;padding-top:16px}
.b.wd{grid-column:1;grid-row:1/span 8}.hdr,.z,.s,.hb,.zm,.r,.f{grid-column:2;width:290px}.hdr{grid-row:1}.z{grid-row:2;font-size:18px}.s{grid-row:3}.hb{grid-row:4}.zm{grid-row:5}.r{grid-row:6}.f{grid-row:7}}
@media(min-width:1280px){:root{--side:min(100dvh - 120px,100vw - 440px)}main{grid-template-columns:auto 360px;column-gap:28px}.hdr,.z,.s,.hb,.zm,.r,.f{width:360px}}
.s .rz{font-size:14px;font-weight:500;line-height:1.45;color:#cbd5e1;margin-top:8px}.z{font-size:15px;font-weight:800}.z .dl{color:#fbbf24}.b .m::before{content:"";position:absolute;inset:6%;border-radius:50%;box-shadow:0 0 0 3px rgba(5,150,105,.75) inset}
.b{aspect-ratio:1/1;display:grid;grid-template-columns:repeat(8,1fr);grid-template-rows:repeat(8,1fr);border-radius:8px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,.4);touch-action:none;user-select:none}
.b i.c{position:absolute;font-style:normal;font-weight:800;opacity:.8;pointer-events:none;font-size:calc(var(--zm)*var(--side)/8*.22);line-height:1}.b i.f{right:4%;bottom:3%}.b i.r{left:5%;top:4%}.b .l i.c{color:#b58863}.b .d i.c{color:#f0d9b5}
.ghost{position:fixed;left:0;top:0;pointer-events:none;z-index:9;transform:translate(-50%,-50%);font-size:calc(var(--zm)*var(--side)/8*.9);line-height:1;filter:drop-shadow(0 6px 8px rgba(0,0,0,.5))}.ghost.w{color:#fff;text-shadow:0 0 2px #000}.ghost.b{color:#111}
.b button{position:relative;border:0;padding:0;margin:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:calc(var(--zm)*var(--side)/8*.78);line-height:1}
.hb button{padding:8px 14px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#f1f5f9;font-weight:800;cursor:pointer}.hb button:hover{background:#334155}.hb button[disabled]{opacity:.5;cursor:default}
@keyframes ccHint{0%,100%{box-shadow:inset 0 0 0 3px rgba(245,158,11,.9)}50%{box-shadow:inset 0 0 0 6px rgba(245,158,11,.5)}}.b .h{animation:ccHint 1s ease-in-out infinite}
.zm{display:flex;align-items:center;gap:8px;font-size:13px;color:#cbd5e1}.zm button{width:40px;height:36px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#f1f5f9;font-size:20px;font-weight:900;cursor:pointer;line-height:1}.zm button:hover{background:#334155}.zm span{min-width:44px;text-align:center;font-variant-numeric:tabular-nums}
.b .l{background:#f0d9b5}.b .d{background:#b58863}.b .sel{background:#f6f669!important}.b .last.l{background:#cdd26a}.b .last.d{background:#aaa23a}
.b .w{color:#fff;text-shadow:0 0 2px #000,0 0 1px #000}.b .bk,.b .b{color:#111}
.b .t::after{content:"";position:absolute;width:30%;height:30%;border-radius:50%;background:rgba(20,20,20,.3)}.b .t.p::after{width:86%;height:86%;background:transparent;border:4px solid rgba(20,20,20,.35)}
.s{min-height:24px;font-size:14px;font-weight:700;color:#a7f3d0}.s.err{color:#fca5a5}
.r{display:none;gap:10px;flex-wrap:wrap}.r a{padding:10px 16px;border-radius:8px;background:#059669;color:#fff;font-weight:900;text-decoration:none}.r button{padding:10px 14px;border:1px solid #475569;border-radius:8px;background:#1e293b;color:#f1f5f9;font-weight:800;cursor:pointer}
.f{font-size:13px;color:#93c5fd;text-decoration:underline}
</style></head><body><main data-cc-light-puzzle="${esc(p.id)}">
<div class="wd hdr"><b>♞ CyberChess</b><small>★ ${p.rating} · 🔥 <b data-cc-streak>0</b> ${esc(t("pz.streak"))}</small></div>
<div class="wd z" data-cc-zadanie>${p.daily ? `<span class="dl">☀ ${esc(t("pz.daily"))}</span> · ` : ""}${esc(p.zadanie)}</div>
<div class="wd b" data-cc-board="1" data-cc-puzzle="${esc(p.id)}" role="grid" aria-label="${esc(p.zadanie)}">${kletkiHtml}</div>
<div class="wd s" data-cc-status>${esc(t("pz.yourMove"))}</div>
<div class="wd hb"><button type="button" data-cc-podskazka>${esc(t("pz.hintBtn"))}</button></div>
<div class="wd zm" data-cc-zoom><button type="button" data-zm="-" aria-label="${esc(t("pz.zoomOut"))}" title="${esc(t("pz.zoomOut"))}">−</button><span data-zm-v>100%</span><button type="button" data-zm="+" aria-label="${esc(t("pz.zoomIn"))}" title="${esc(t("pz.zoomIn"))}">+</button><small>${esc(t("pz.zoomLabel"))}</small></div>
<div class="wd r" data-cc-resheno><a data-cc-next href="${esc(p.sleduyushchaya)}">${esc(t("pz.next"))}</a><button type="button" data-cc-share>${esc(t("pz.share"))}</button></div>
<a class="wd f" data-cc-full href="${esc(p.polnaya)}">${esc(t("pz.fullVersion"))}</a>
</main>
<script id="cc-cfg" type="application/json">${JSON.stringify(cfg).replace(/</g, "\\u003c")}</script>
<script>${КЛИЕНТ}</script>
</body></html>`;
}

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
  const body = html(await sobratVid(id, syraya, locale, url));
  return new Response(body, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "Vary": "Accept-Language, Cookie" } });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const syraya = await zagruzit(id);
  if (!syraya) return Response.json({ vid: "wrong", error: "puzzle not found" }, { status: 404 });
  let b: { akt?: string; fen?: string; i?: number; from?: string; to?: string; lang?: string } = {};
  try { b = (await req.json()) as typeof b; } catch { return Response.json({ vid: "wrong", error: "bad json" }, { status: 400 }); }
  if (b.akt === "next") {
    // «Следующая» одним тапом без перезагрузки (очередь 14.10 п.1): клетки и конфиг — те же, что в GET, но JSON-ом;
    // клиент шлёт сюда ?c=/probe из своего адреса, чтобы метка канала ехала дальше по серии. Нет следующей — 404, клиент идёт по ссылке.
    const url = new URL(req.url);
    const locale = yazykZaprosa(req.headers.get("cookie"), typeof b.lang === "string" ? b.lang : url.searchParams.get("lang"), req.headers.get("accept-language"));
    const nextId = await sleduyushchiyId(id, syraya.r ?? 1200);
    const nextSyraya = nextId ? await zagruzit(nextId) : null;
    if (!nextId || !nextSyraya) return Response.json({ vid: "wrong", error: "no next puzzle" }, { status: 404 });
    const nurl = new URL(adresZadachi(nextId, keepIz(url)), url.origin);
    const vid = await sobratVid(nextId, nextSyraya, locale, nurl);
    return Response.json({ id: vid.id, url: nurl.pathname + nurl.search, html: kletkiRazmetka(vid.fen, vid.storona), cfg: konfigKlienta(vid), zadanie: vid.zadanie, title: vid.title, next: vid.sleduyushchaya, polnaya: vid.polnaya });
  }
  const pz = zadachaDlyaEkrana({ fen: syraya.fen, sol: syraya.sol, name: syraya.name ?? "", r: syraya.r ?? 1200, theme: syraya.theme ?? "" });
  const i = Number.isInteger(b.i) && (b.i as number) >= 0 ? (b.i as number) : 0;
  const s = sostoyanieNaShage(pz.fen, pz.sol, i);
  if (b.fen !== s.fen) return Response.json({ vid: "wrong", error: "state mismatch", fen: s.fen, i: s.i }, { status: 409 });
  const from = String(b.from ?? "").slice(0, 2), to = String(b.to ?? "").slice(0, 2);
  if (b.akt === "targets") return Response.json({ targets: svoyaFigura(s, from) ? tseli(s.fen, from) : [] });
  if (b.akt === "hint") return Response.json({ from: s.reshena || s.i >= s.sol.length ? null : s.sol[s.i].slice(0, 2) });
  const r = shag(s, from, to);
  if (r.vid !== "ok") return Response.json({ vid: "wrong" });
  // 142: разбор на языке страницы — только после решения (до него он подсказка, а не разбор)
  const yazyk = yazykZaprosa(req.headers.get("cookie"), new URL(req.url).searchParams.get("lang"), req.headers.get("accept-language"));
  const razbor = r.reshena && syraya.razbor ? (syraya.razbor[yazyk] || syraya.razbor.en || undefined) : undefined;
  // после решения — вся линия в SAN (как «Success» у lichess с разбором): человек видит, что именно сработало
  return Response.json({ vid: "ok", fen: r.sostoyanie.fen, i: r.sostoyanie.i, reshena: r.reshena, otvet: r.otvet, movable: r.reshena ? [] : hodyashchie(r.sostoyanie.fen, s.storona), san: r.reshena ? resheniyeSan(pz.fen, pz.sol) : undefined, razbor });
}
