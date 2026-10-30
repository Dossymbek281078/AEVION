"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { KeepChannelLink } from "./KeepChannelLink";
import { repoUrl } from "@/lib/repoUrl";
import { FooterWaitlist } from "./FooterWaitlist";
import { useChromeLang } from "./siteChromeI18n";
import { useNavHref } from "./useNavHref";

/**
 * Ссылка подвала. Раньше тот же объект стиля был вписан в каждую из двенадцати
 * ссылок; теперь он один, и вместе с ним задана минимальная площадь касания.
 *
 * Замер 31.08.2026 в браузере на экране 390px: ссылки подвала имели высоту
 * 20px при нижней границе 24px, ниже которой попасть пальцем трудно (WCAG
 * 2.5.8). Трафик воронки идёт с роликов, то есть почти весь с телефонов.
 * Шестнадцать таких ссылок в подвале и двадцать шесть в шапке; шапку правят
 * шесть чужих ветвей, поэтому здесь только подвал, а шапка передана владельцу.
 *
 * Высота задаётся минимумом, а не отступом: отступ раздвинул бы колонку и
 * изменил вид, а min-height добирает площадь касания, оставляя вид прежним.
 */
const footerLink: CSSProperties = {
  color: "#94a3b8",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 24,
};

/** Приглушённый ряд внизу: цвет другой, площадь касания та же. */
const footerLinkMuted: CSSProperties = { ...footerLink, color: "#64748b" };


export function SiteFooter() {
  const year = new Date().getFullYear();
  // 21.10.2026: подписи — из словаря siteChromeI18n (ru/en/kk). translate="no" только при
  // своём словаре: на прочих языках подвал по-прежнему переводит живой переводчик.
  const { t, own } = useChromeLang();
  const nav = useNavHref();
  const tr = own ? ("no" as const) : undefined;
  return (
    <footer
      style={{
        marginTop: "auto",
        borderTop: "1px solid rgba(15,23,42,0.08)",
        background: "#0f172a",
        color: "#94a3b8",
        // Нижний отступ учитывает плавающую кнопку агента: она закреплена
        // в правом нижнем углу и накрывала последнюю строку подвала
        // (замер 02.09.2026: «Помощь» -> /help недостижима на 40 адресах).
        // Задаём здесь, а не в globals.css: строчный стиль сильнее правила
        // из таблицы, и правило молча не сработало бы.
        padding: "40px 20px calc(28px + var(--aevion-agent-h, 0px))",
        fontSize: 13,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 32,
        }}
      >
        {/* Brand */}
        <div>
          <div style={{ fontWeight: 900, fontSize: 18, color: "#f8fafc", marginBottom: 8, letterSpacing: "-0.02em" }}>
            AEVION
          </div>
          <p translate={tr} style={{ margin: 0, lineHeight: 1.6, fontSize: 13, color: "#94a3b8" }}>
            {t("about")}
          </p>
          <div translate={tr} style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
            {t("city")}
          </div>
        </div>

        {/* Products */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }} translate={tr}>
            {t("products")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <KeepChannelLink href={nav("/qright")} style={footerLink}><span translate={tr}>{t("qrightLink")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/qsign")} style={footerLink}><span translate={tr}>{t("qsignLink")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/bureau")} style={footerLink}><span translate={tr}>{t("ipBureau")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/planet")} style={footerLink}><span translate={tr}>{t("planetCompliance")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/awards")} style={footerLink}><span translate={tr}>{t("awards")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/bank")} style={footerLink}><span translate={tr}>{t("aevionBank")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/cyberchess")} style={footerLink}><span translate="no">CyberChess</span></KeepChannelLink>
          </div>
        </div>

        {/* Company */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }} translate={tr}>
            {t("company")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <KeepChannelLink href={nav("/demo")} style={footerLink}><span translate={tr}>{t("demo")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/terms")} style={footerLink}><span translate={tr}>{t("termsOfService")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/privacy")} style={footerLink}><span translate={tr}>{t("privacyPolicy")}</span></KeepChannelLink>
            <KeepChannelLink href={nav("/help")} style={footerLink}><span translate={tr}>{t("helpCenter")}</span></KeepChannelLink>
          </div>
        </div>

        {/* Contact */}
        <div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#e2e8f0", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em" }} translate={tr}>
            {t("contact")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <a href="mailto:data@aevion.app" style={footerLink}>data@aevion.app</a>
            <span translate={tr}>{t("city")}</span>
            <span>+7 702 625 83 77</span>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <a
              href={repoUrl()}
              target="_blank"
              rel="noreferrer"
              style={{ ...footerLinkMuted, fontWeight: 700 }}
            >
              GitHub
            </a>
          </div>
        </div>
      </div>

      {/* Приём адреса — последняя возможность не потерять посетителя: у 12 из 15
          страниц, куда ведут посты, своего поля нет (замер 20.09.2026). Блок сам
          не рисуется там, где приём адреса уже есть, — см. FooterWaitlist. */}
      <div style={{ maxWidth: 1280, margin: "28px auto 0" }}>
        <FooterWaitlist />
      </div>

      {/* Bottom bar */}
      <div
        style={{
          maxWidth: 1280,
          margin: "28px auto 0",
          paddingTop: 20,
          borderTop: "1px solid rgba(148,163,184,0.15)",
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 12,
          color: "#64748b",
        }}
      >
        <div translate={tr}>&copy; {year} AEVION. {t("rights")}</div>
        <div style={{ display: "flex", gap: 16 }}>
          <KeepChannelLink href={nav("/terms")} style={footerLinkMuted}><span translate={tr}>{t("terms")}</span></KeepChannelLink>
          <KeepChannelLink href={nav("/privacy")} style={footerLinkMuted}><span translate={tr}>{t("privacy")}</span></KeepChannelLink>
          <KeepChannelLink href={nav("/help")} style={footerLinkMuted}><span translate={tr}>{t("help")}</span></KeepChannelLink>
        </div>
      </div>
    </footer>
  );
}
