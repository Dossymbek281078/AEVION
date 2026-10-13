"use client";
/**
 * Лёгкая задача: доска, условие, ходы, проверка, события воронки и одна ссылка
 * на полную версию. Намеренно НЕ импортирует page.tsx, products, коуча и движок:
 * сторож legkiyMarshrutNeTyanetMonolit держит сумму исходников импортов.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/track";
import { otmetitPervyyHod } from "../pervyyHod";
import { tFor, type CcLocale } from "../i18n";
import { GLIF, kletki, shag, sozdatSostoyanie, svoyaFigura, tseli, type Sostoyanie } from "./logikaZadachi";

export type LegkayaZadachaProps = {
  id: string;
  fen: string;
  sol: string[];
  zadanie: string;
  name: string;
  rating: number;
  theme: string;
  locale: CcLocale;
};

export default function LegkayaZadacha({ id, fen, sol, zadanie, name, rating, theme, locale }: LegkayaZadachaProps) {
  const t = (k: string) => tFor(locale, k);
  const [s, sS] = useState<Sostoyanie>(() => sozdatSostoyanie(fen, sol));
  const [vybor, sVybor] = useState<string | null>(null);
  const [soobshchenie, sSoobshchenie] = useState<"" | "wrong">("");
  const [posledniy, sPosledniy] = useState<{ from: string; to: string } | null>(null);
  const [polnaya, sPolnaya] = useState(`/cyberchess?puzzle=${encodeURIComponent(id)}`);
  const pervyyHodRef = useRef("");
  const soobshchiliRef = useRef(false);

  // Метка гидратации — для честного замера «время до первого ВОЗМОЖНОГО хода»: доска
  // приходит в HTML раньше, чем навешаны обработчики, и без метки прибор мерил бы HTML.
  useEffect(() => {
    try { document.querySelector("[data-cc-light-puzzle]")?.setAttribute("data-hydrated", "1"); } catch { /* нет DOM */ }
  }, []);

  // Воронка: открытие задачи по ссылке — та же ступень и та же форма, что у полной версии.
  useEffect(() => {
    track({ type: "feature_use", source: "cyberchess/link", meta: { feature: "puzzle_link_open", app: "cyberchess", puzzle: id, surface: "light" } });
    try {
      const q = new URLSearchParams(window.location.search);
      const keep = new URLSearchParams();
      for (const k of ["c", "probe", "p"]) { const v = q.get(k); if (v) keep.set(k, v); }
      const hvost = keep.toString();
      sPolnaya(`/cyberchess?puzzle=${encodeURIComponent(id)}${hvost ? "&" + hvost : ""}`);
    } catch { /* адрес недоступен — остаётся ссылка без метки */ }
  }, [id]);

  const ryady = useMemo(() => kletki(s.fen, s.storona), [s.fen, s.storona]);
  const celi = useMemo(() => (vybor ? tseli(s.fen, vybor) : []), [s.fen, vybor]);

  function nazhat(sq: string) {
    if (s.reshena) return;
    if (vybor && celi.includes(sq)) {
      const r = shag(s, vybor, sq);
      sVybor(null);
      if (r.vid === "wrong") { sSoobshchenie("wrong"); return; }
      sSoobshchenie("");
      sPosledniy({ from: vybor, to: sq });
      sS(r.sostoyanie);
      otmetitPervyyHod(pervyyHodRef, "puzzle", id);
      if (r.reshena && !soobshchiliRef.current) {
        soobshchiliRef.current = true;
        track({ type: "puzzle_solved", source: "cyberchess/board", meta: { app: "cyberchess", id, fen, rating, theme, daily: false, surface: "light" } });
      }
      return;
    }
    if (svoyaFigura(s, sq)) { sVybor(sq); sSoobshchenie(""); return; }
    sVybor(null);
  }

  const razmer = "min(92vw, 60vh, 480px)";
  return (
    <main data-cc-light-puzzle={id} style={{ minHeight: "100dvh", background: "#0f172a", color: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 12px 24px", gap: 10, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ width: razmer, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ fontSize: 15 }}>♞ CyberChess</strong>
        <span style={{ fontSize: 12, opacity: 0.75 }}>★ {rating}</span>
      </div>
      <div data-cc-zadanie style={{ width: razmer, fontSize: 15, fontWeight: 800 }}>{zadanie}</div>
      <div data-cc-board="1" data-cc-puzzle={id} role="grid" aria-label={zadanie}
        style={{ width: razmer, aspectRatio: "1 / 1", display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gridTemplateRows: "repeat(8, 1fr)", borderRadius: 8, overflow: "hidden", boxShadow: "0 4px 18px rgba(0,0,0,.4)", touchAction: "manipulation", userSelect: "none" }}>
        {ryady.flat().map((k) => {
          const vybrana = vybor === k.sq;
          const cel = celi.includes(k.sq);
          const byl = posledniy && (posledniy.from === k.sq || posledniy.to === k.sq);
          const fon = vybrana ? "#f6f669" : byl ? (k.dark ? "#aaa23a" : "#cdd26a") : k.dark ? "#b58863" : "#f0d9b5";
          return (
            <button key={k.sq} type="button" data-sq={k.sq} onClick={() => nazhat(k.sq)} aria-label={k.sq}
              style={{ position: "relative", background: fon, border: "none", padding: 0, margin: 0, cursor: s.reshena ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(22px, 7.5vmin, 46px)", lineHeight: 1, color: k.p?.startsWith("w") ? "#fff" : "#111", textShadow: k.p?.startsWith("w") ? "0 0 2px #000, 0 0 1px #000" : "none" }}>
              {k.p ? GLIF[k.p] : ""}
              {cel && <span aria-hidden style={{ position: "absolute", width: k.p ? "86%" : "30%", height: k.p ? "86%" : "30%", borderRadius: "50%", border: k.p ? "4px solid rgba(20,20,20,.35)" : "none", background: k.p ? "transparent" : "rgba(20,20,20,.3)" }} />}
            </button>
          );
        })}
      </div>
      <div data-cc-status style={{ width: razmer, minHeight: 24, fontSize: 14, fontWeight: 700, color: soobshchenie === "wrong" ? "#fca5a5" : "#a7f3d0" }}>
        {s.reshena ? t("pz.solved").replace("{name}", name) : soobshchenie === "wrong" ? t("pz.wrong") : t("pz.yourMove")}
      </div>
      {s.reshena && (
        <div data-cc-resheno="1" role="status" style={{ width: razmer, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a href={polnaya} style={{ padding: "10px 16px", borderRadius: 8, background: "#059669", color: "#fff", fontWeight: 900, textDecoration: "none" }}>{t("pz.next")}</a>
        </div>
      )}
      <a data-cc-full href={polnaya} style={{ width: razmer, fontSize: 13, color: "#93c5fd", textDecoration: "underline" }}>{t("pz.fullVersion")}</a>
    </main>
  );
}
