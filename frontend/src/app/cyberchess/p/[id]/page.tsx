/**
 * /cyberchess/p/<id> — лёгкий маршрут задачи для гостя из Shorts (волна 123, 13.10.2026).
 *
 * Полная /cyberchess?puzzle= везёт ~900 КБ сжатого JS и на Fast 3G даёт доску через ~7 с
 * (замер прода, 3 прогона). Здесь задача берётся на сервере, доска приходит в HTML,
 * клиенту остаются гидратация и chess.js. Порог: сжатый JS маршрута ≤300 КБ,
 * время до первого хода на Fast 3G ≤3,5 с (сторож и замер после выкатки).
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageTracking } from "@/components/PageTracking";
import { serverFetch } from "@/lib/apiBase";
import { getServerLang } from "@/lib/i18n-server";
import { zadachaDlyaEkrana, zadanieNadDoskoy, imyaPoResheniyu, type PzLocale } from "../../puzzleNormalize";
import LegkayaZadacha from "../LegkayaZadacha";

type SyrayaZadacha = { fen?: string; sol?: string[]; name?: string; r?: number; theme?: string; id?: string };

function lokal(l: string): PzLocale { return l === "en" || l === "kk" ? l : l === "ru" ? "ru" : "en"; }

async function zagruzit(id: string): Promise<SyrayaZadacha | null> {
  const r = await serverFetch(`/api/cyberchess-puzzles/${encodeURIComponent(id)}`, { timeoutMs: 4000, retries: 1 });
  if (!r || !r.ok) return null;
  try {
    const telo = (await r.json()) as { puzzle?: SyrayaZadacha };
    const p = telo?.puzzle;
    if (!p?.fen || !Array.isArray(p.sol) || p.sol.length === 0) return null;
    return p;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const l = lokal(await getServerLang());
  const t = l === "ru" ? "Шахматная задача" : l === "kk" ? "Шахмат есебі" : "Chess puzzle";
  return { title: `${t} · CyberChess`, robots: { index: false }, alternates: { canonical: `/cyberchess?puzzle=${encodeURIComponent(id)}` } };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const syraya = await zagruzit(id);
  if (!syraya) notFound();
  const locale = lokal(await getServerLang());
  const pz = zadachaDlyaEkrana({ fen: syraya.fen!, sol: syraya.sol!, name: syraya.name ?? "", r: syraya.r ?? 1200, theme: syraya.theme ?? "" });
  const zadanie = zadanieNadDoskoy(pz, locale);
  const name = imyaPoResheniyu(pz, locale) ?? (syraya.name || "");
  return (
    <>
      <PageTracking page="cyberchess-p" />
      <LegkayaZadacha id={id} fen={pz.fen} sol={pz.sol} zadanie={zadanie} name={name} rating={pz.r ?? 1200} theme={pz.theme ?? ""} locale={locale} />
    </>
  );
}
