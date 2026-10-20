import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { getApiBase } from "@/lib/apiBase";
import { CopyButton, ShareButton } from "./ClientBits";
import { getServerLang } from "@/lib/i18n-server";
import { tVerify, type VerifyKey } from "./i18n";

export const dynamic = "force-dynamic";

type PublicView = {
  id: string;
  algoVersion: string;
  canonicalization: string;
  createdAt: string | null;
  valid: boolean;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
  payload: unknown;
  payloadCanonical: string;
  payloadHash: string;
  hmac: { kid: string; algo: string; signature: string; valid: boolean };
  ed25519: {
    kid: string;
    algo: string;
    signature: string;
    publicKey: string | null;
    valid: boolean | null;
  } | null;
  dilithium: null;
  issuer: { userId: string | null; email: string | null };
  geo: {
    source: string | null;
    country: string | null;
    city: string | null;
    lat: number | null;
    lng: number | null;
  } | null;
};

/**
 * Три исхода, а не два.
 *
 * Раньше функция возвращала null и когда подписи НЕТ, и когда мы не смогли
 * спросить (5xx, обрыв, таймаут). Страница на оба случая отвечала 200 с
 * текстом «не существует ИЛИ бэкенд недоступен» — то есть выдавала догадку
 * за факт, а поисковик получал «страница есть» на несуществующий id.
 *
 * Разделение нужно именно здесь: отдать 404 при временной аварии бэкенда
 * значит сказать поисковику, что живых страниц не существует, и вылететь
 * из выдачи. Поэтому 404 ставим ТОЛЬКО по авторитетному ответу сервера.
 */
type Loaded =
  | { state: "found"; data: PublicView }
  | { state: "absent" }
  | { state: "unknown" };

async function loadPublic(id: string): Promise<Loaded> {
  try {
    const res = await fetch(
      `${getApiBase()}/api/qsign/v2/${encodeURIComponent(id)}/public`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    );
    // 404 и 410 — сервер ЗНАЕТ, что такой подписи нет. Это факт.
    if (res.status === 404 || res.status === 410) return { state: "absent" };
    // Остальные неуспехи — «спросить не удалось», а не «нет».
    if (!res.ok) return { state: "unknown" };
    return { state: "found", data: (await res.json()) as PublicView };
  } catch {
    // Обрыв, таймаут, недоступность — тоже «не знаю».
    return { state: "unknown" };
  }
}

async function getOrigin(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "";
}

/* ───────── metadata ───────── */

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const lang = await getServerLang();
  const t = (k: VerifyKey, v?: Record<string, string | number>) => tVerify(lang, k, v);
  const fallback: Metadata = {
    title: t("meta.title"),
    description: t("meta.description"),
    openGraph: {
      title: t("meta.title"),
      description: t("meta.ogDescription"),
      type: "article",
    },
  };
  if (!id) return fallback;

  const zagruzka = await loadPublic(id);
  if (zagruzka.state !== "found") return fallback;
  const pub = zagruzka.data;

  const statusText = pub.revoked
    ? t("meta.status.revoked")
    : pub.valid
    ? t("meta.status.valid")
    : t("meta.status.invalid");
  const desc = [
    t("meta.desc", { id: id.slice(0, 8), status: statusText }),
    `${pub.algoVersion} · ${pub.canonicalization}`,
    `hmac=${pub.hmac.kid}`,
    pub.ed25519 ? `ed25519=${pub.ed25519.kid}` : null,
    pub.geo?.country ? `geo=${pub.geo.country}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `QSign ${id.slice(0, 8)} — ${statusText.toUpperCase()}`,
    description: desc,
    openGraph: {
      title: `QSign ${id.slice(0, 8)} — ${statusText.toUpperCase()}`,
      description: desc,
      type: "article",
    },
  };
}

/* ───────── styles ───────── */

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
};
const mono: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  color: "#334155",
};
const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

/* ───────── page ───────── */

export default async function QSignVerifyPage({ params }: Props) {
  const { id } = await params;
  const lang = await getServerLang();
  const t = (k: VerifyKey, v?: Record<string, string | number>) => tVerify(lang, k, v);
  const zagruzka = await loadPublic(id);
  // Подписи НЕТ — честный 404, а не «200 со страницей про отсутствие».
  // Мягкий 404 плодит бесконечный индексируемый мусор: у каждого семейства
  // маршрутов бесконечно много несуществующих id, и все отвечали «есть».
  // При state === "unknown" (бэкенд не ответил) остаётся 200 и объяснение:
  // 404 в этом случае сказал бы поисковику, что живой страницы не существует.
  if (zagruzka.state === "absent") notFound();
  const pub = zagruzka.state === "found" ? zagruzka.data : null;
  const origin = await getOrigin();
  const shareUrl = origin ? `${origin}/qsign/verify/${id}` : `/qsign/verify/${id}`;

  if (!pub) {
    return (
      <main
        style={{
          maxWidth: 720,
          margin: "60px auto",
          padding: "0 20px",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div
          style={{
            ...card,
            textAlign: "center",
            padding: 40,
            background: "linear-gradient(180deg, #fef2f2, #fff)",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: "#b91c1c",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 8,
            }}
          >
            {t("unavailable.kicker")}
          </div>
          <h1 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 900 }}>
            {id}
          </h1>
          <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 20px" }}>
            {t("unavailable.text")}
          </p>
          <Link
            href="/qsign"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              background: "#0f172a",
              color: "#fff",
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("unavailable.back")}
          </Link>
        </div>
      </main>
    );
  }

  const qrSvg = await QRCode.toString(shareUrl, {
    type: "svg",
    margin: 1,
    width: 180,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  // ───── status computation ─────
  const bannerBg = pub.revoked
    ? "linear-gradient(135deg, #b45309, #78350f)"
    : pub.valid
    ? "linear-gradient(135deg, #065f46, #064e3b)"
    : "linear-gradient(135deg, #991b1b, #7f1d1d)";
  const bannerTitle = pub.revoked
    ? t("banner.revoked")
    : pub.valid
    ? t("banner.valid")
    : t("banner.invalid");
  const bannerCaption = pub.revoked
    ? t("banner.revokedCaption")
    : pub.valid
    ? t("banner.validCaption")
    : t("banner.invalidCaption");

  const payloadPretty = (() => {
    try {
      return JSON.stringify(pub.payload, null, 2);
    } catch {
      return pub.payloadCanonical;
    }
  })();

  return (
    <main
      style={{
        maxWidth: 880,
        margin: "40px auto 80px",
        padding: "0 20px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* breadcrumbs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <Link
          href="/qsign"
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#475569",
            textDecoration: "none",
          }}
        >
          {t("nav.studio")}
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <ShareButton url={shareUrl} />
          <Link
            href="/planet"
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid #0f766e",
              color: "#0f766e",
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("nav.planet")}
          </Link>
        </div>
      </div>

      {/* status banner */}
      <div
        style={{
          borderRadius: 20,
          overflow: "hidden",
          marginBottom: 22,
          background: bannerBg,
          color: "#fff",
          padding: "26px 26px 22px",
          /*
           * 🔴 19.10.2026: было grid «minmax(0,1fr) auto» — на 390×844 QR (180px)
           * оставлял заголовку 98px, и «ДЕЙСТВИТЕЛЬНАЯ ПОДПИСЬ» рвалось посреди
           * слов (ДЕЙС/ТВИТЕ/ЛЬНА/Я). Теперь flex с переносом: текст не уже 240px,
           * QR уходит под него, когда вдвоём не помещаются.
           */
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              opacity: 0.85,
              marginBottom: 6,
            }}
          >
            QSign {pub.algoVersion}
          </div>
          <h1
            style={{
              fontSize: "clamp(22px, 7vw, 30px)",
              fontWeight: 900,
              margin: "0 0 8px",
              letterSpacing: "-0.02em",
              overflowWrap: "normal",
            }}
          >
            {bannerTitle}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              opacity: 0.88,
              lineHeight: 1.5,
              maxWidth: 480,
            }}
          >
            {bannerCaption}
          </p>
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              fontSize: 11,
              opacity: 0.85,
            }}
          >
            <span>id: <code style={{ fontFamily: "monospace" }}>{pub.id}</code></span>
            {pub.createdAt ? (
              <span>
                {t("banner.signed", { t: new Date(pub.createdAt).toISOString().replace("T", " ").slice(0, 19) })}
              </span>
            ) : null}
            {pub.revoked && pub.revokedAt ? (
              <span>
                {t("banner.revokedAt", { t: new Date(pub.revokedAt).toISOString().replace("T", " ").slice(0, 19) })}
              </span>
            ) : null}
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 10,
            borderRadius: 12,
            width: 180,
            height: 180,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
      </div>

      {pub.revoked && pub.revocationReason ? (
        <div
          style={{
            ...card,
            borderColor: "rgba(180,83,9,0.25)",
            background: "rgba(254,243,199,0.35)",
            marginBottom: 18,
          }}
        >
          <div style={label}>{t("revocation.reason")}</div>
          <div style={{ fontSize: 14, color: "#78350f", fontWeight: 600 }}>
            {pub.revocationReason}
          </div>
        </div>
      ) : null}

      {/* cryptographic checks grid */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: pub.ed25519 ? "1fr 1fr" : "1fr",
          marginBottom: 18,
        }}
      >
        <CheckCard
          title="HMAC-SHA256"
          lang={lang}
          kid={pub.hmac.kid}
          valid={pub.hmac.valid}
          signature={pub.hmac.signature}
          publicKey={null}
        />
        {pub.ed25519 ? (
          <CheckCard
            title="Ed25519"
            lang={lang}
            kid={pub.ed25519.kid}
            valid={pub.ed25519.valid}
            signature={pub.ed25519.signature}
            publicKey={pub.ed25519.publicKey}
          />
        ) : null}
      </div>

      {/* payload card */}
      <div style={{ ...card, marginBottom: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 15 }}>{t("payload.title")}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <CopyButton value={payloadPretty} label={t("payload.copy")} />
            <CopyButton value={pub.payloadCanonical} label={t("payload.copyCanonical")} />
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>{t("payload.canonicalization")}</div>
          <div style={{ fontSize: 13, color: "#334155" }}>
            {t("payload.canonicalizationNote", { scheme: pub.canonicalization })}
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={label}>{t("payload.hash")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ ...mono, wordBreak: "break-all", flex: 1 }}>
              {pub.payloadHash}
            </code>
            <CopyButton value={pub.payloadHash} label={t("payload.copyHash")} />
          </div>
        </div>

        <pre
          style={{
            ...mono,
            background: "#0f172a",
            color: "#e2e8f0",
            padding: 14,
            borderRadius: 10,
            overflow: "auto",
            maxHeight: 360,
            margin: 0,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {payloadPretty}
        </pre>
      </div>

      {/* issuer + geo */}
      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "1fr 1fr",
          marginBottom: 18,
        }}
      >
        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>{t("issuer.title")}</div>
          <div style={{ fontSize: 13, lineHeight: 1.7 }}>
            {pub.issuer.email ? (
              <>
                <div style={label}>{t("issuer.email")}</div>
                <div style={{ marginBottom: 8, color: "#0f172a", fontWeight: 600 }}>
                  {pub.issuer.email}
                </div>
              </>
            ) : null}
            {/*
              * Внутренний идентификатор подписанта наружу больше не уходит
              * (08.09.2026: он позволял связать подписи одного человека между
              * собой). «Anonymous issuer» теперь пишем только когда о
              * подписанте не известно НИЧЕГО — иначе строка говорила бы
              * «аноним» под маской адреса, то есть противоречила соседней.
              */}
            {pub.issuer.email ? null : (
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{t("issuer.anonymous")}</div>
            )}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>
            {t("geo.title")}
          </div>
          {pub.geo ? (
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div style={label}>{t("geo.source")}</div>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                {pub.geo.source || "—"}
              </div>
              {(pub.geo.country || pub.geo.city) && (
                <>
                  <div style={label}>{t("geo.location")}</div>
                  <div style={{ marginBottom: 8 }}>
                    {[pub.geo.city, pub.geo.country].filter(Boolean).join(", ") || "—"}
                  </div>
                </>
              )}
              {/*
                * Сравнение `!= null`, а не `!== null`, и это не косметика.
                * 08.09.2026 публичный ответ перестал отдавать координаты
                * подписания — их публиковать нельзя. Со строгим сравнением
                * ОТСУТСТВУЮЩЕЕ поле (`undefined !== null` истинно) провело бы
                * страницу в блок и уронило её на `.toFixed` — и уронило бы
                * именно ту страницу, куда ведёт публичная ссылка проверки.
                * Мягкое сравнение переживает оба вида «нет значения».
                */}
              {pub.geo.lat != null && pub.geo.lng != null ? (
                <>
                  <div style={label}>{t("geo.coords")}</div>
                  <code style={mono}>
                    {pub.geo.lat.toFixed(4)}, {pub.geo.lng.toFixed(4)}
                  </code>
                </>
              ) : null}
            </div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 12 }}>
              {t("geo.none")}
            </div>
          )}
        </div>
      </div>

      {/* footer / how-to-verify */}
      <div
        style={{
          border: "1px solid rgba(15,23,42,0.08)",
          borderRadius: 14,
          padding: 18,
          background: "rgba(15,23,42,0.02)",
          fontSize: 13,
          color: "#475569",
          lineHeight: 1.7,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: "#0f172a" }}>
          {t("how.title")}
        </div>
        <ol style={{ margin: "0 0 8px", paddingLeft: 20 }}>
          <li>
            {t("how.1a")} <strong>RFC 8785 (JCS)</strong> {t("how.1b")}
          </li>
          <li>
            {t("how.2")}{" "}
            <code style={mono}>{pub.payloadHash}</code>.
          </li>
          <li>
            {t("how.3")}{" "}
            <code style={mono}>{pub.hmac.kid}</code>.
          </li>
          {pub.ed25519 && pub.ed25519.publicKey ? (
            <li>
              {t("how.4")}{" "}
              <code style={{ ...mono, wordBreak: "break-all" }}>
                {pub.ed25519.publicKey}
              </code>
              .
            </li>
          ) : null}
        </ol>
        <div>
          {t("how.machine")}{" "}
          <Link
            href={`/api-backend/api/qsign/v2/${id}/public`}
            style={{ color: "#0f766e", fontWeight: 700, textDecoration: "none" }}
          >
            /api/qsign/v2/{id}/public
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ───────── sub-components (server) ───────── */

function CheckCard({
  title,
  lang,
  kid,
  valid,
  signature,
  publicKey,
}: {
  title: string;
  lang: string;
  kid: string;
  valid: boolean | null;
  signature: string;
  publicKey: string | null;
}) {
  const color =
    valid === null ? "#64748b" : valid ? "#047857" : "#b91c1c";
  const bg =
    valid === null
      ? "rgba(100,116,139,0.08)"
      : valid
      ? "rgba(16,185,129,0.08)"
      : "rgba(239,68,68,0.08)";
  const statusText =
    valid === null ? tVerify(lang, "check.notChecked") : valid ? tVerify(lang, "check.valid") : tVerify(lang, "check.invalid");
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>{title}</div>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            background: bg,
            color,
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {statusText}
        </span>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={label}>{tVerify(lang, "check.keyId")}</div>
        <code style={mono}>{kid}</code>
      </div>
      <div style={{ marginBottom: publicKey ? 10 : 0 }}>
        <div style={label}>{tVerify(lang, "check.signature")}</div>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <code
            style={{
              ...mono,
              wordBreak: "break-all",
              flex: 1,
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            {signature}
          </code>
          <CopyButton value={signature} label={tVerify(lang, "copy.copy")} />
        </div>
      </div>
      {publicKey ? (
        <div>
          <div style={label}>{tVerify(lang, "check.publicKey")}</div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <code
              style={{
                ...mono,
                wordBreak: "break-all",
                flex: 1,
                fontSize: 11,
                lineHeight: 1.5,
              }}
            >
              {publicKey}
            </code>
            <CopyButton value={publicKey} label={tVerify(lang, "copy.copy")} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
