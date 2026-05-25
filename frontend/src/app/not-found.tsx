"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";

const NF_TEXT: Record<string, Record<string, string>> = {
  title:     { en: "This node is not on the map", ru: "Такой страницы не существует", kk: "Бұл бет табылмады", de: "Diese Seite existiert nicht", fr: "Cette page n'existe pas", es: "Esta página no existe", zh: "页面不存在", ja: "ページが見つかりません", ar: "هذه الصفحة غير موجودة", pt: "Esta página não existe", tr: "Bu sayfa bulunamadı" },
  subtitle:  { en: "The page you are looking for does not exist. It may have been renamed, moved, or the link is outdated.", ru: "Страница могла быть переименована, перемещена или ссылка устарела.", kk: "Бет атауы өзгертілген, жылжытылған немесе сілтеме ескірген болуы мүмкін.", de: "Die Seite wurde möglicherweise umbenannt, verschoben oder der Link ist veraltet.", fr: "La page a peut-être été renommée, déplacée ou le lien est obsolète.", es: "La página puede haber sido renombrada, movida o el enlace está desactualizado.", zh: "页面可能已被重命名、移动或链接已过期。", ja: "ページが名前変更、移動されたか、リンクが古い可能性があります。", ar: "ربما تمت إعادة تسمية الصفحة أو نقلها أو الرابط قديم.", pt: "A página pode ter sido renomeada, movida ou o link está desatualizado.", tr: "Sayfa yeniden adlandırılmış, taşınmış veya bağlantı eski olabilir." },
  placeholder: { en: "Search the AEVION help center…", ru: "Поиск по справке AEVION…", kk: "AEVION анықтамасынан іздеу…", de: "AEVION-Hilfe durchsuchen…", fr: "Rechercher dans l'aide AEVION…", es: "Buscar en la ayuda de AEVION…", zh: "搜索 AEVION 帮助中心…", ja: "AEVION ヘルプを検索…", ar: "ابحث في مركز مساعدة AEVION…", pt: "Pesquisar na ajuda AEVION…", tr: "AEVION yardım merkezinde ara…" },
  search:    { en: "Search", ru: "Поиск", kk: "Іздеу", de: "Suchen", fr: "Rechercher", es: "Buscar", zh: "搜索", ja: "検索", ar: "بحث", pt: "Pesquisar", tr: "Ara" },
  jump:      { en: "Or jump to a module", ru: "Или перейдите к модулю", kk: "Немесе модульге өтіңіз", de: "Oder zu einem Modul wechseln", fr: "Ou accéder à un module", es: "O ir a un módulo", zh: "或跳转到模块", ja: "またはモジュールへ移動", ar: "أو انتقل إلى وحدة", pt: "Ou ir para um módulo", tr: "Veya bir modüle git" },
};

const LINKS_LABELS: Record<string, Record<string, string>> = {
  globus: { en: "Globus map", ru: "Карта Globus", kk: "Globus картасы", de: "Globus-Karte", fr: "Carte Globus", es: "Mapa Globus", zh: "Globus 地图", ja: "Globusマップ", ar: "خريطة Globus", pt: "Mapa Globus", tr: "Globus haritası" },
  bank:   { en: "Bank", ru: "Банк", kk: "Банк", de: "Bank", fr: "Banque", es: "Banco", zh: "银行", ja: "バンク", ar: "بنك", pt: "Banco", tr: "Banka" },
  awards: { en: "Awards", ru: "Награды", kk: "Марапаттар", de: "Auszeichnungen", fr: "Prix", es: "Premios", zh: "奖项", ja: "アワード", ar: "جوائز", pt: "Prêmios", tr: "Ödüller" },
  bureau: { en: "Bureau", ru: "Бюро", kk: "Бюро", de: "Büro", fr: "Bureau", es: "Oficina", zh: "局", ja: "ビューロー", ar: "مكتب", pt: "Escritório", tr: "Büro" },
  planet: { en: "Planet", ru: "Планета", kk: "Планета", de: "Planet", fr: "Planète", es: "Planeta", zh: "星球", ja: "プラネット", ar: "كوكب", pt: "Planeta", tr: "Gezegen" },
  shield: { en: "Quantum Shield", ru: "Quantum Shield", kk: "Quantum Shield", de: "Quantum Shield", fr: "Quantum Shield", es: "Quantum Shield", zh: "量子盾", ja: "量子シールド", ar: "درع الكم", pt: "Quantum Shield", tr: "Quantum Shield" },
  chess:  { en: "CyberChess", ru: "КиберШахматы", kk: "КиберШахмат", de: "CyberChess", fr: "CyberÉchecs", es: "CyberAjedrez", zh: "网络象棋", ja: "サイバーチェス", ar: "شطرنج إلكتروني", pt: "CyberXadrez", tr: "SiberSatranç" },
  demo:   { en: "Demo", ru: "Демо", kk: "Демо", de: "Demo", fr: "Démo", es: "Demo", zh: "演示", ja: "デモ", ar: "عرض", pt: "Demo", tr: "Demo" },
  pitch:  { en: "Pitch", ru: "Питч", kk: "Питч", de: "Pitch", fr: "Présentation", es: "Presentación", zh: "路演", ja: "ピッチ", ar: "عرض ترويجي", pt: "Pitch", tr: "Sunum" },
};

function tx(map: Record<string, Record<string, string>>, key: string, lang: string): string {
  return (map[key]?.[lang] ?? map[key]?.en ?? key);
}

export default function NotFound() {
  const [query, setQuery] = useState("");
  const { lang } = useI18n();
  const helpHref = query.trim() ? `/help?q=${encodeURIComponent(query.trim())}` : "/help";

  const QUICK_LINKS = [
    { label: tx(LINKS_LABELS, "globus", lang), href: "/",              color: "#0f172a", bg: "#0f172a", invert: true },
    { label: tx(LINKS_LABELS, "bank",   lang), href: "/bank",          color: "#fbbf24" },
    { label: tx(LINKS_LABELS, "awards", lang), href: "/awards",        color: "#a78bfa" },
    { label: "QRight",                          href: "/qright",        color: "#7dd3fc" },
    { label: "QSign",                           href: "/qsign",         color: "#a78bfa" },
    { label: tx(LINKS_LABELS, "bureau", lang), href: "/bureau",        color: "#f472b6" },
    { label: tx(LINKS_LABELS, "planet", lang), href: "/planet",        color: "#86efac" },
    { label: tx(LINKS_LABELS, "shield", lang), href: "/quantum-shield",color: "#5eead4" },
    { label: tx(LINKS_LABELS, "chess",  lang), href: "/cyberchess",    color: "#0d9488" },
    { label: "QTrade",                          href: "/qtrade",        color: "#fb7185" },
    { label: tx(LINKS_LABELS, "demo",   lang), href: "/demo",          color: "#94a3b8" },
    { label: tx(LINKS_LABELS, "pitch",  lang), href: "/pitch",         color: "#0ea5e9" },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 720, width: "100%" }}>
        <div style={{ fontSize: 96, fontWeight: 900, color: "#0d9488", lineHeight: 1, marginBottom: 8, letterSpacing: "-0.05em" }}>
          404
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
          {tx(NF_TEXT, "title", lang)}
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6, marginBottom: 22 }}>
          {tx(NF_TEXT, "subtitle", lang)}
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (typeof window !== "undefined") window.location.href = helpHref; }}
          style={{ display: "flex", gap: 8, marginBottom: 28, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}
        >
          <label htmlFor="nf-search" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
            {tx(NF_TEXT, "search", lang)} AEVION
          </label>
          <input
            id="nf-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx(NF_TEXT, "placeholder", lang)}
            style={{
              flex: 1,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid rgba(15,23,42,0.2)",
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "none",
              background: "#0d9488",
              color: "#fff",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {tx(NF_TEXT, "search", lang)}
          </button>
        </form>

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.18em", color: "#64748b", marginBottom: 14, textTransform: "uppercase" }}>
          {tx(NF_TEXT, "jump", lang)}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          {QUICK_LINKS.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: q.invert ? "none" : `1px solid ${q.color}55`,
                background: q.invert ? q.bg : "rgba(255,255,255,0.7)",
                color: q.invert ? "#fff" : "#0f172a",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 13,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {q.invert ? null : (
                <span style={{ width: 6, height: 6, borderRadius: 6, background: q.color, display: "inline-block" }} />
              )}
              {q.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
