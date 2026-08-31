"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { PurchaseReturnTracker } from "@/components/PurchaseReturnTracker";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { PitchValueCallout } from "@/components/PitchValueCallout";
import { apiUrl } from "@/lib/apiBase";
import { getDeviceId } from "@/lib/aevApi";
import { anchorBadge, ANCHOR_TONE_COLORS } from "./anchorBadge";

type Certificate = {
  id: string;
  title: string;
  kind: string;
  author: string;
  location?: string | null;
  contentHash: string;
  fileHash?: string | null;
  algorithm: string;
  protectedAt: string;
  verifiedCount: number;
  verifyUrl: string;
  verificationLevel?: "anonymous" | "verified";
  verifiedName?: string | null;
  verifiedAt?: string | null;
  shieldId?: string | null;
  /**
   * Состояние якоря в биткойне. Поле МОЖЕТ отсутствовать: бэкенд, который его
   * отдаёт, выкатывается отдельно. Отсутствие — «не сказали», а не «якоря нет»,
   * и обрабатывается в anchorBadge().
   */
  bitcoinAnchor?: { status?: string | null; bitcoinBlockHeight?: number | null } | null;
};

const KIND_ICONS: Record<string, string> = {
  music: "🎵", code: "💻", design: "🎨", text: "📝", video: "🎬", idea: "💡", other: "📦",
};

const KIND_LABELS: Record<string, string> = {
  music: "Music / Audio", code: "Code / Software", design: "Design / Visual",
  text: "Text / Article", video: "Video / Film", idea: "Idea / Concept", other: "Other",
};

const LEGAL_FRAMEWORKS = [
  { name: "Berne Convention", desc: "Automatic copyright protection in 181 member states — no registration required", scope: "International", color: "#0d9488" },
  { name: "WIPO Copyright Treaty", desc: "Extends protection to digital works: software, databases, digital content", scope: "International", color: "#3b82f6" },
  { name: "TRIPS Agreement (WTO)", desc: "Minimum IP protection standards across 164 WTO member states", scope: "164 countries", color: "#8b5cf6" },
  { name: "eIDAS Regulation", desc: "Electronic signatures have legal effect equivalent to handwritten", scope: "European Union", color: "#0ea5e9" },
  { name: "ESIGN Act", desc: "Electronic signatures carry same legal standing as handwritten", scope: "United States", color: "#6366f1" },
  { name: "KZ Digital Signature Law", desc: "Electronic digital signatures are legally equivalent to handwritten", scope: "Kazakhstan", color: "#f59e0b" },
];

type DashboardData = {
  certificates: Array<{
    id: string;
    title: string;
    kind: string;
    contentHash: string;
    protectedAt: string;
    authorVerificationLevel?: "anonymous" | "verified";
    authorVerifiedAt?: string | null;
    authorVerifiedName?: string | null;
  }>;
  verifications: Array<{
    id: string;
    kycStatus: string;
    paymentStatus: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  trustEdges?: Array<{
    id: string;
    certId: string;
    tier: string;
    aecRewardPlanned: number | null;
    aecRewardClaimedAt: string | null;
    createdAt: string;
  }>;
  aecSummary?: { totalPlanned: number; totalClaimed: number; unclaimed: number };
  pricing: { verifiedTierCents: number; currency: string };
};

const TOKEN_KEY = "aevion_auth_token_v1";
const WAITLIST_KEY = "aevion_notarized_waitlist_v1";

type SortMode = "newest" | "oldest" | "verified";

// useSearchParams заставляет Next вычислять страницу на запрос, и без границы
// Suspense сборка падает на этапе пре-рендера — «Export encountered an error on
// /bureau/page», то есть красной становится ВСЯ выкатка фронта, а не одна
// страница. Образец границы взят из smeta-trainer/calc (5bc68b11e), где тот же
// дефект чинили 21.05.
export default function BureauPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "60vh", padding: 24, color: "#64748b", fontSize: 14 }}>Загрузка…</div>}>
      {/* Stripe возвращает сюда с ?paid=1 — без этой отметки оплата не
          связывается с каналом, из которого пришёл человек. */}
      <PurchaseReturnTracker source="bureau" provider="stripe" successParam="paid" />
      <BureauPageInner />
    </Suspense>
  );
}

function BureauPageInner() {
  const { showToast } = useToast();
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  // «Сертификатов нет» и «не удалось узнать» — разные вещи. При сбое загрузки
  // страница писала «No certificates yet» и звала защитить первую работу —
  // человеку, у которого работы уже защищены (21.08.2026).
  const [certsFailed, setCertsFailed] = useState(false);

  // Сколько нотариусов РЕАЛЬНО зарегистрировано, и настроен ли настоящий
  // поставщик проверки личности. Оба значения читаются с прода, а не пишутся
  // строкой в коде: соседняя ветка честно отметила «прочитать значение на проде
  // я не могу» — теперь можно, ручка /api/bureau/health добавлена 27.08.
  //
  // null означает «ещё не спросили» или «спросить не удалось», и это НЕ ноль:
  // при неизвестном состоянии карточка говорит «по запросу», то есть не
  // обещает и не пугает. Пока бэкенд с ручкой не выкачен, так и будет.
  const [notaryCount, setNotaryCount] = useState<number | null>(null);
  const [kycMode, setKycMode] = useState<"live" | "stub" | null>(null);
  // Чем НА САМОМ ДЕЛЕ подписывает нотариус. Без ключа подпись — HMAC на
  // ПУБЛИЧНОМ ключе нотариуса, то есть пересчитать её может кто угодно; код
  // честно зовёт это "demo-hmac-sha256". Значок тарифа шёл только от
  // непустого реестра и про подпись не спрашивал вовсе — то есть в день, когда
  // появится первый нотариус, карточка пообещала бы Ed25519 независимо от того,
  // настроен ли ключ. Состояние бюро это уже отдаёт, оставалось прочитать.
  const [notarySig, setNotarySig] = useState<"ed25519" | "demo" | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/bureau/notaries"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const list = Array.isArray(d?.notaries) ? d.notaries : null;
        setNotaryCount(list ? list.length : null);
      })
      .catch(() => { /* оставляем null: «не знаю», а не «ноль» */ });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/bureau/health"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        const v = d?.kyc;
        setKycMode(v === "live" || v === "stub" ? v : null);
        const sig = d?.notarySignature;
        setNotarySig(sig === "ed25519" || sig === "demo" ? sig : null);
      })
      .catch(() => { /* оставляем null: своя неудача — не «настроено» */ });
    return () => { alive = false; };
  }, []);

  // Чем закончилась загрузка панели вошедшего человека. Три исхода, а не два:
  // «идёт», «загрузилось», «не удалось» — и последний обязан быть виден.
  // До 28.08 неудача оставляла dashboard в null, весь блок не рисовался вовсе,
  // и человек с оплаченными сертификатами видел страницу так, будто их нет.
  const [dashboardFailed, setDashboardFailed] = useState<null | "auth" | "error">(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, totalVerifications: 0 });

  // Prior-art search + filter + sort over the public registry.
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Глубокая ссылка на объект: /bureau?objectId=… (маркер на 3D-глобусе) и
  // ?qrightObjectId=… (страница объекта QRight, «посмотреть сертификат»).
  //
  // Оба параметра страница не читала вовсе — человек нажимал на конкретный
  // объект и попадал в общий реестр, где его объект надо искать руками. Со
  // стороны отправителя это невидимо: ссылка формируется верно, переход
  // происходит, ошибки нет.
  //
  // Подставить id прямо в поиск нельзя: в сертификате его нет, поиск идёт по
  // заголовку, автору и хешам — вышло бы «найдено 0», что читается как «моего
  // объекта здесь нет». Поэтому спрашиваем у QRight хеш содержимого объекта и
  // ищем по нему. Не разрешилось — говорим об этом, а не молчим.
  const searchParams = useSearchParams();
  const deepObjectId =
    searchParams?.get("objectId") || searchParams?.get("qrightObjectId") || "";
  const [deepLinkError, setDeepLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!deepObjectId) return;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(apiUrl(`/api/qright/objects/${encodeURIComponent(deepObjectId)}`));
        if (!r.ok) {
          if (alive) setDeepLinkError("Не удалось открыть объект по ссылке — записи с таким номером в реестре QRight нет.");
          return;
        }
        const data = (await r.json()) as { contentHash?: string; object?: { contentHash?: string } };
        const hash = data?.contentHash || data?.object?.contentHash || "";
        if (!alive) return;
        if (!hash) {
          setDeepLinkError("Не удалось открыть объект по ссылке — у записи нет хеша содержимого.");
          return;
        }
        setDeepLinkError(null);
        setQuery(hash);
      } catch {
        if (alive) setDeepLinkError("Не удалось открыть объект по ссылке — реестр QRight сейчас недоступен.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [deepObjectId]);

  // File drag-drop on /bureau: compute SHA-256 → populate search query.
  const [fileDragOver, setFileDragOver] = useState(false);
  const [fileChecking, setFileChecking] = useState(false);
  const hashAndSearch = async (file: File) => {
    setFileChecking(true);
    try {
      const buf = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buf);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      setQuery(hex);
      setKindFilter("all");
      setVerifiedOnly(false);
    } catch {
      showToast("Could not hash file", "error");
    } finally {
      setFileChecking(false);
    }
  };

  const [authed, setAuthed] = useState(false);

  // Notarized tier waitlist.
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistDone, setWaitlistDone] = useState(() => {
    try { return !!localStorage.getItem(WAITLIST_KEY); } catch { return false; }
  });
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const submitWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = waitlistEmail.trim();
    if (!email || waitlistDone) return;
    setWaitlistBusy(true);
    // This used to write the address to localStorage, wait 600ms and say
    // "You're on the waitlist!" — the only copy lived in the visitor's own
    // browser and no list existed. It posts to the backend now, and a failure
    // says so instead of congratulating the person.
    try {
      const r = await fetch(apiUrl("/api/bureau/waitlist"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "bureau-notarized" }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        showToast(j?.error || `Could not join the waitlist (${r.status})`, "error");
        return;
      }
      // Local flag only remembers the form state for this browser; the record
      // itself now lives on the server.
      try { localStorage.setItem(WAITLIST_KEY, email); } catch {}
      setWaitlistDone(true);
      showToast("You're on the waitlist!", "success");
    } catch {
      showToast("Network error — the waitlist did not receive your address", "error");
    } finally {
      setWaitlistBusy(false);
    }
  };
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [claimingEdgeId, setClaimingEdgeId] = useState<string | null>(null);

  const claimAec = async (edgeId: string) => {
    setClaimingEdgeId(edgeId);
    try {
      const deviceId = getDeviceId();
      const r = await fetch(apiUrl(`/api/bureau/trust-edges/${edgeId}/claim-aec`), {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ deviceId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        showToast(j?.error || `claim failed (${r.status})`, "error");
        return;
      }
      showToast(`Claimed ${j.amount} AEC`, "success");
      // Refetch dashboard so the row flips to "claimed".
      const dr = await fetch(apiUrl("/api/bureau/dashboard"), { headers: authHeaders() });
      if (dr.ok) setDashboard((await dr.json()) as DashboardData);
    } catch {
      showToast("Network error", "error");
    } finally {
      setClaimingEdgeId(null);
    }
  };

  const authHeaders = (): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(apiUrl("/api/pipeline/certificates"));
        if (res.ok) {
          const data = await res.json();
          const certs = data.certificates || [];
          setCertificates(certs);
          const totalVerifications = certs.reduce((sum: number, c: Certificate) => sum + (c.verifiedCount || 0), 0);
          setStats({ total: certs.length, totalVerifications });
          setCertsFailed(false);
        } else {
          setCertsFailed(true);
        }
      } catch { setCertsFailed(true); }
      finally { setLoading(false); }
    })();
  }, []);

  // Personal dashboard — only fetch if authed.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(TOKEN_KEY);
    } catch {}
    if (!raw) return;
    setAuthed(true);
    (async () => {
      try {
        const r = await fetch(apiUrl("/api/bureau/dashboard"), {
          headers: { Authorization: `Bearer ${raw}` },
        });
        if (r.ok) {
          setDashboard((await r.json()) as DashboardData);
          setDashboardFailed(null);
        } else {
          // Отказы РАЗЛИЧАЮТСЯ: устаревший вход лечится входом, сбой сервиса — нет.
          setDashboardFailed(r.status === 401 || r.status === 403 ? "auth" : "error");
        }
      } catch {
        // Сети не было. Это тоже не «сертификатов нет».
        setDashboardFailed("error");
      }
    })();
  }, []);

  const myIdentity = (() => {
    if (!dashboard) return null;
    const completed = dashboard.verifications.find(
      (v) => v.kycStatus === "approved" && v.paymentStatus === "paid",
    );
    if (!completed) return null;
    const verifiedCerts = dashboard.certificates.filter(
      (c) => c.authorVerificationLevel === "verified",
    );
    const verifiedName = verifiedCerts[0]?.authorVerifiedName || null;
    const verifiedAt = verifiedCerts[0]?.authorVerifiedAt || completed.completedAt;
    return { verifiedName, verifiedAt, certCount: verifiedCerts.length };
  })();

  const inFlightUpgrade = (() => {
    if (!dashboard) return null;
    return dashboard.verifications.find(
      (v) => v.kycStatus !== "approved" || v.paymentStatus !== "paid",
    );
  })();

  const filteredCerts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = certificates;
    if (q) {
      out = out.filter((c) => {
        const hay = [c.title, c.author, c.contentHash, c.fileHash || "", c.location || ""].join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (kindFilter !== "all") {
      out = out.filter((c) => c.kind === kindFilter);
    }
    if (verifiedOnly) {
      out = out.filter((c) => c.verificationLevel === "verified");
    }
    const sorted = [...out];
    if (sort === "newest") {
      sorted.sort((a, b) => +new Date(b.protectedAt) - +new Date(a.protectedAt));
    } else if (sort === "oldest") {
      sorted.sort((a, b) => +new Date(a.protectedAt) - +new Date(b.protectedAt));
    } else if (sort === "verified") {
      sorted.sort((a, b) => (b.verifiedCount || 0) - (a.verifiedCount || 0));
    }
    return sorted;
  }, [certificates, query, kindFilter, sort, verifiedOnly]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of certificates) counts[c.kind] = (counts[c.kind] || 0) + 1;
    return counts;
  }, [certificates]);

  const hashLooksLikeSha256 = /^[a-f0-9]{64}$/i.test(query.trim());
  const filtersActive = query.trim() !== "" || kindFilter !== "all" || verifiedOnly || sort !== "newest";

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast(`${label} copied!`, "success"),
      () => showToast("Copy failed", "error")
    );
  };

  return (
    <main>
      <ProductPageShell maxWidth={920}>
        <Wave1Nav />

        {/* ── Hero Header ── */}
        <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 28 }}>
          <div style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)", padding: "32px 28px 28px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #0d9488, #06b6d4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>⚖️</div>
              <div>
                <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: "-0.02em" }}>AEVION Digital IP Bureau</h1>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.75 }}>Cryptographic Proof of Authorship & Prior Art</p>
              </div>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, opacity: 0.8, lineHeight: 1.6, maxWidth: 640 }}>
              A cryptographic proof-of-authorship bureau. Register, sign, and certify your intellectual property with standards-based cryptography (SHA-256, Ed25519, Bitcoin-anchored timestamps) — backed by international copyright law.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link href="/qright" style={{ padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                🛡️ Protect Your Work
              </Link>
              <Link href="#registry" style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                🔎 Search prior art
              </Link>
              <Link href="/quantum-shield" style={{ padding: "10px 20px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                Quantum Shield Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* ── My Identity (authed users only) ── */}
        {authed && (dashboardFailed || myIdentity || inFlightUpgrade || (dashboard && dashboard.certificates.length > 0)) && (
          <div style={{ marginBottom: 22, borderRadius: 16, border: "1px solid rgba(99,102,241,0.25)", background: "linear-gradient(135deg, rgba(99,102,241,0.04), rgba(79,70,229,0.04))", padding: "18px 22px" }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#312e81", marginBottom: 8 }}>
              My Bureau identity
            </div>
            {dashboardFailed ? (
              <div style={{ fontSize: 12, color: "#7f1d1d", lineHeight: 1.6 }}>
                <b>Не удалось загрузить ваши сертификаты.</b> Это сбой загрузки, а не
                утверждение о том, что их нет: ничего не потеряно.
                {dashboardFailed === "auth"
                  ? " Похоже, вход устарел — войдите заново и откройте страницу ещё раз."
                  : " Обновите страницу через минуту."}
              </div>
            ) : myIdentity ? (
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 240px" }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>
                    ⭐ {myIdentity.verifiedName || "Verified"}
                  </div>
                  <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                    Identity verified by AEVION Bureau
                    {myIdentity.verifiedAt && (
                      <> · {new Date(myIdentity.verifiedAt).toLocaleDateString()}</>
                    )}
                    {myIdentity.certCount > 0 && (
                      <> · attesting <b>{myIdentity.certCount}</b> certificate{myIdentity.certCount === 1 ? "" : "s"}</>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link href="/qright" style={{ padding: "10px 16px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                    Protect another work
                  </Link>
                </div>
              </div>
            ) : inFlightUpgrade ? (
              <div>
                <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.6 }}>
                  You have an upgrade in progress — KYC <b>{inFlightUpgrade.kycStatus}</b>, payment <b>{inFlightUpgrade.paymentStatus}</b>. Continue from where you left off:
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                  Pick the certificate you started upgrading from the registry below — the <em>Upgrade to Verified</em> button there resumes the same flow.
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: "#312e81", lineHeight: 1.6, marginBottom: 8 }}>
                  Anonymous certificates are fully cryptographically protected. Upgrade any one of yours to <b>Verified</b> ({dashboard ? `$${(dashboard.pricing.verifiedTierCents / 100).toFixed(2)}` : "$19"}) and the bureau will record your declared name alongside the certificate, with the identity check its provider performs.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Trust Graph (authed users with at least one earned edge) ── */}
        {authed && dashboard?.trustEdges && dashboard.trustEdges.length > 0 && (
          <div style={{ marginBottom: 22, borderRadius: 16, border: "1px solid rgba(217,119,6,0.25)", background: "linear-gradient(135deg, rgba(245,158,11,0.04), rgba(217,119,6,0.06))", padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#92400e" }}>
                🔗 Trust Graph — your earned tiers
              </div>
              {dashboard.aecSummary && (
                <div style={{ fontSize: 12, color: "#78350f" }}>
                  Total earned <b>{dashboard.aecSummary.totalPlanned}</b> AEC ·
                  claimed <b>{dashboard.aecSummary.totalClaimed}</b> ·
                  unclaimed <b style={{ color: dashboard.aecSummary.unclaimed > 0 ? "#b45309" : "#78350f" }}>{dashboard.aecSummary.unclaimed}</b>
                </div>
              )}
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {dashboard.trustEdges.map((e) => {
                const claimed = !!e.aecRewardClaimedAt;
                const claimable = !claimed && (e.aecRewardPlanned ?? 0) > 0;
                const isClaiming = claimingEdgeId === e.id;
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.7)", border: "1px solid rgba(217,119,6,0.15)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#92400e", textTransform: "capitalize" }}>{e.tier}</span>
                      <span style={{ fontSize: 11, color: "#78716c", fontFamily: "ui-monospace, monospace" }}>cert {e.certId.slice(0, 8)}…</span>
                      <span style={{ fontSize: 11, color: "#a8a29e" }}>{new Date(e.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 900, color: "#0f172a" }}>{e.aecRewardPlanned ?? 0} AEC</span>
                      {claimed ? (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a" }}>✓ claimed</span>
                      ) : claimable ? (
                        <button
                          type="button"
                          disabled={isClaiming}
                          onClick={() => claimAec(e.id)}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: isClaiming ? "#a8a29e" : "linear-gradient(135deg, #d97706, #ea580c)", color: "#fff", fontWeight: 800, fontSize: 12, cursor: isClaiming ? "default" : "pointer" }}
                        >
                          {isClaiming ? "Claiming…" : "Claim AEC"}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: "#a8a29e" }}>no reward</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
          {[
            { value: stats.total, label: "Certificates Issued", color: "#0d9488" },
            { value: stats.totalVerifications, label: "Total Verifications", color: "#3b82f6" },
            { value: LEGAL_FRAMEWORKS.length, label: "Legal Frameworks", color: "#8b5cf6" },
            { value: "3-Layer", label: "Cryptographic Protection", color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── How It Works ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 14 }}>How AEVION IP Bureau Works</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { n: "1", title: "Register", desc: "Describe your work — we create a SHA-256 content hash", icon: "📋", color: "#0d9488" },
              { n: "2", title: "Sign", desc: "HMAC-SHA256 cryptographic signature proves integrity", icon: "🔏", color: "#3b82f6" },
              { n: "3", title: "Shield", desc: "Ed25519 + Shamir's Secret Sharing for quantum-grade protection", icon: "🛡️", color: "#8b5cf6" },
              { n: "4", title: "Certify", desc: "IP Certificate with legal basis — publicly verifiable", icon: "📜", color: "#f59e0b" },
            ].map((s) => (
              <div key={s.n} style={{ padding: "16px 14px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 }}>{s.n}</div>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Service Tiers ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Service Tiers</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
            Anonymous certificates are free and cryptographically complete. Higher tiers add identity attestation and (soon) notary co-signing — useful when an IP claim needs strong author identification in court.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              {
                name: "Free / Anonymous",
                price: "$0",
                blurb: "Full Qright stack: SHA-256 hash, HMAC, Ed25519, Shamir 2-of-3, OpenTimestamps Bitcoin anchor, browser-held author co-signature, offline verification bundle.",
                badge: "✓ active",
                badgeColor: "#059669",
                cta: { label: "Protect work", href: "/qright" },
              },
              {
                name: "Verified",
                price: "$19 / cert",
                // Третья поверхность той же формулировки (28.08). Две другие — карточка бюро и
// страница объекта QRight — смягчены ранее в этой же ветке; эта осталась
// утверждать проверку паспорта как совершившийся факт, хотя ГЛУБИНА проверки
// зависит от переменной окружения BUREAU_KYC_PROVIDER, которая по умолчанию
// равна "stub" (aevion-globus-backend/src/lib/kyc/index.ts:18). Прочитать её
// значение на проде я не могу, поэтому не утверждаю ни того, ни другого:
// описываю механизм, а глубину называет сам провайдер отпечатком.
// Вернуть сильную формулировку — в тот день, когда провайдер настроен и это
// видно снаружи (решение основателя, красный пункт в сводке 28.08).
// Ветвей здесь ТРИ, как и у значка ниже, и это не симметрия ради
                // красоты. Раньше их было две, и «не знаю» попадало в ветку
                // «настроено»: на проде /api/bureau/health полей состояния НЕ
                // отдаёт вовсе (замер 29.08: ответ — только status/service/
                // timestamp), поэтому kycMode там всегда null — и платный тариф
                // (замер 29.08; как только ветка с полями состояния уедет на
                //  прод, это перестанет быть правдой — тогда ветка "live" начнёт
                //  срабатывать сама, и трогать здесь ничего не надо)
                // утверждал «проверку выполняет наш KYC-провайдер», хотя
                // проверяет заглушка.
                //
                // Направление умолчания у текста и у значка ПРОТИВОПОЛОЖНОЕ, и
                // так и надо: значок при незнании говорит нейтральное «by
                // request», а текст при незнании обязан НЕ обещать. Один и тот
                // же предикат отвечает на два разных вопроса.
                blurb:
                  kycMode === "stub"
                    ? "Identity check is in demo mode right now: the flow runs end to end, but no document is actually verified yet. Ask us before buying this tier."
                    : kycMode === "live"
                      ? "Identity check performed by our KYC provider. Bureau records the declared name alongside the certificate together with the provider's verification fingerprint."
                      : "Identity verification is arranged on request — ask us to confirm it is available before buying this tier. Bureau records the declared name alongside the certificate.",
                // Значок — из живого состояния бюро, три исхода вместо двух.
                // «available now» говорится только когда поставщик действительно
                // настроен; заглушка называется заглушкой ДО покупки, а своя
                // неосведомлённость даёт нейтральное «by request».
                badge:
                  kycMode === "stub"
                    ? "▲ demo mode"
                    : kycMode === "live"
                      ? "▲ available now"
                      : "▲ by request",
                badgeColor: "#4f46e5",
                // Кнопка вела на /bureau — на страницу, где человек уже стоит:
                // единственная кнопка платного тарифа не делала ничего видимого.
                // Ведёт в реестр: обновление начинается с выбора сертификата,
                // и у каждой карточки там есть своя кнопка «Upgrade to Verified».
                cta: { label: "Pick a cert to upgrade", href: "#registry" },
              },
              {
                name: "Notarized",
                price: "From $89 / cert",
                // Обещание переписано вместе со значком (28.08). Прежний текст утверждал
// готовый результат — «apostille-ready document admissible in EAEU courts» —
// у тарифа, исполнить который сегодня некому. Допустимость в конкретном суде
// зависит от юрисдикции и самого спора, мы её обеспечить не можем; описываем
// МЕХАНИЗМ и честную доступность, а вывод о суде оставляем юристу покупателя.
// Обещание Ed25519 даётся, только когда бюро подтверждает, что подпись
                // действительно Ed25519. Без ключа подписывается HMAC на ПУБЛИЧНОМ
                // ключе нотариуса — такую подпись может пересчитать кто угодно, и
                // называть её криптографической нотаризацией нельзя. «Не знаю»
                // (старая сборка прода полей состояния не отдаёт) обещания не даёт.
                blurb:
                  notarySig === "ed25519"
                    ? "A licensed notary co-signs the certificate with Ed25519. The notary registry is still being assembled — check it for current availability."
                    : "A licensed notary co-signs the certificate. Cryptographic co-signing is being finalised — ask us to confirm the current signing mode before buying this tier.",
                // ⚠️ 28.08.2026: значок был «▲ live» при НУЛЕ нотариусов в реестре.
                //
                //   GET https://api.aevion.app/api/bureau/notaries -> {"notaries":[]}
                //   (ручка отдаёт только активных; неактивный подписать не может)
                //
                // Тариф обещает подпись лицензированного нотариуса, а исполнить
                // это сегодня физически некому. (Цену намеренно не называю числом: сторож
                // retiredPrices ловит отставные номиналы в тексте страниц, и мой
                // комментарий его справедливо уронил — он прав, а не я.)
                // Цена и состав пакета — решение владельца
                // продукта, их не трогаю; но «live» — утверждение о ДОСТУПНОСТИ, то есть
                // факт, и он был неверен.
                //
                // Вернуть «▲ live» следует в тот день, когда в реестре появится первый
                // активный нотариус, — не раньше.
                // Значок идёт от реестра, а не от строки: ноль активных нотариусов
                // и «спросить не удалось» одинаково дают «by request», и только
                // непустой реестр даёт «live». (Заодно карточка снова целиком
                // по-английски — русское «в плане» стояло среди английских.)
                // «live» требует ОБОИХ условий: есть кому подписать И подпись
                // настоящая. Прежде значок смотрел только на реестр, то есть
                // обещал бы доступность в день появления первого нотариуса, даже
                // если ключа нет и подпись демонстрационная.
                badge:
                  notaryCount && notaryCount > 0 && notarySig === "ed25519"
                    ? "▲ live"
                    : "▲ by request",
                badgeColor: "#7c3aed",
                cta: { label: "View Notary Registry", href: "/bureau/notaries" },
              },
            ].map((tier) => (
              <div key={tier.name} style={{ padding: "16px 16px 14px", borderRadius: 14, border: tier.name === "Notarized" ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(15,23,42,0.1)", background: "#fff", display: "flex", flexDirection: "column" as const, gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{tier.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 800, color: tier.badgeColor }}>{tier.badge}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{tier.price}</div>
                <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.55, flex: 1 }}>{tier.blurb}</div>
                {tier.cta && (
                  <Link href={tier.cta.href} style={{ marginTop: 6, padding: "8px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 12, textAlign: "center" as const }}>
                    {tier.cta.label}
                  </Link>
                )}
                {tier.name === "Notarized" && (
                  <div style={{ marginTop: 4, padding: "8px 12px", borderRadius: 8, background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)", fontSize: 11, color: "#7c3aed", fontWeight: 700, textAlign: "center" as const }}>
                    Upgrade your Verified cert — select a notary and submit a request.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Certificate Registry ── */}
        <div id="registry" style={{ marginBottom: 28, scrollMarginTop: 80 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, gap: 12, flexWrap: "wrap" as const }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
              Certificate Registry{" "}
              <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 14 }}>
                ({filtersActive ? `${filteredCerts.length} of ${certificates.length}` : certificates.length})
              </span>
            </div>
            <Link href="/qright" style={{ padding: "8px 16px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12 }}>+ New Certificate</Link>
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 12, lineHeight: 1.5 }}>
            Public prior-art lookup — search by title, author, or paste a SHA-256 hash. Or <strong>drop a file below</strong> to check it instantly.
          </div>

          {/* Search + filter toolbar (hidden until certs load to avoid layout flash). */}
          {/* File drop zone — drag any file to compute SHA-256 and search instantly */}
          <div
            onDragOver={(e) => { e.preventDefault(); setFileDragOver(true); }}
            onDragLeave={() => setFileDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setFileDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) hashAndSearch(f); }}
            style={{
              marginBottom: 10,
              padding: "12px 16px",
              borderRadius: 10,
              border: `2px dashed ${fileDragOver ? "#0d9488" : "rgba(15,23,42,0.12)"}`,
              background: fileDragOver ? "rgba(13,148,136,0.04)" : "transparent",
              display: "flex",
              alignItems: "center",
              gap: 10,
              transition: "border-color 0.15s, background 0.15s",
              cursor: "default",
            }}
          >
            <span style={{ fontSize: 20 }}>{fileChecking ? "⏳" : "📂"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>
                {fileChecking ? "Computing SHA-256…" : "Drop a file here to check prior art"}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {fileChecking ? "Searching registry…" : "Any format — computes SHA-256 in your browser, then searches the registry instantly"}
              </div>
            </div>
            <label style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 11, fontWeight: 700, color: "#475569", cursor: "pointer", flexShrink: 0 }}>
              Browse
              <input type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) hashAndSearch(f); }} />
            </label>
          </div>

          {/* Ссылка не разрешилась — говорим об этом. Молчаливые «0
              результатов» человек читает как «моего объекта здесь нет». */}
          {deepLinkError && (
            <div
              style={{
                marginBottom: 14,
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(185,28,28,0.25)",
                background: "rgba(185,28,28,0.05)",
                color: "#b91c1c",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {deepLinkError}
            </div>
          )}

          {!loading && certificates.length > 0 && (
            <div style={{ display: "grid", gap: 10, marginBottom: 14, padding: 12, borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
                <div style={{ position: "relative" as const, flex: "1 1 280px", minWidth: 0 }}>
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search title, author, or paste SHA-256 hash…"
                    aria-label="Search registry"
                    style={{
                      width: "100%",
                      padding: "8px 30px 8px 32px",
                      borderRadius: 8,
                      border: "1px solid rgba(15,23,42,0.15)",
                      fontSize: 13,
                      fontFamily: hashLooksLikeSha256 ? "monospace" : undefined,
                      color: "#0f172a",
                      background: "#f8fafc",
                      outline: "none",
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <span style={{ position: "absolute" as const, left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 14, pointerEvents: "none" as const }}>🔎</span>
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      style={{ position: "absolute" as const, right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#94a3b8", fontSize: 16, cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  aria-label="Sort registry"
                  style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", fontSize: 12, fontWeight: 700, color: "#334155", background: "#fff", cursor: "pointer" }}
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="verified">Most verified</option>
                </select>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, border: `1px solid ${verifiedOnly ? "rgba(16,185,129,0.45)" : "rgba(15,23,42,0.15)"}`, background: verifiedOnly ? "rgba(16,185,129,0.08)" : "#fff", fontSize: 12, fontWeight: 700, color: verifiedOnly ? "#065f46" : "#334155", cursor: "pointer", userSelect: "none" as const }}>
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    style={{ margin: 0, cursor: "pointer" }}
                  />
                  ⭐ Verified only
                </label>
                {filtersActive && (
                  <button
                    type="button"
                    onClick={() => { setQuery(""); setKindFilter("all"); setSort("newest"); setVerifiedOnly(false); }}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontSize: 11, fontWeight: 700, color: "#475569", cursor: "pointer" }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {(["all", "music", "code", "design", "text", "video", "idea", "other"] as const).map((k) => {
                  const active = kindFilter === k;
                  const count = k === "all" ? certificates.length : (kindCounts[k] || 0);
                  if (k !== "all" && count === 0) return null;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKindFilter(k)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        border: `1px solid ${active ? "rgba(13,148,136,0.45)" : "rgba(15,23,42,0.12)"}`,
                        background: active ? "rgba(13,148,136,0.12)" : "#fff",
                        color: active ? "#0d9488" : "#475569",
                        fontWeight: 700,
                        fontSize: 11,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {k === "all" ? "All" : <>{KIND_ICONS[k]} {KIND_LABELS[k]?.split(" / ")[0] || k}</>}
                      <span style={{ fontSize: 10, opacity: 0.7 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading certificates...</div>
          ) : certsFailed ? (
            <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>Не удалось загрузить сертификаты</div>
              <div style={{ fontSize: 13, color: "#64748b" }}>Это не значит, что их нет: сервис не ответил. Обновите страницу.</div>
            </div>
          ) : certificates.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 20px", borderRadius: 16, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", marginBottom: 6 }}>No certificates yet</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 16 }}>Protect your first work to see it here</div>
              <Link href="/qright" style={{ display: "inline-block", padding: "12px 24px", borderRadius: 12, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>🛡️ Protect Your Work</Link>
            </div>
          ) : filteredCerts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 20px", borderRadius: 16, border: "1px dashed rgba(15,23,42,0.12)", background: "#fff" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔎</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a", marginBottom: 4 }}>
                {hashLooksLikeSha256 ? "No prior art for this hash" : "Nothing matches your filters"}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 14, lineHeight: 1.55 }}>
                {hashLooksLikeSha256
                  ? "Your content is unique in the AEVION registry — safe to register as new IP."
                  : "Try a different search term or reset filters."}
              </div>
              {hashLooksLikeSha256 ? (
                <Link href="/qright" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 10, background: "linear-gradient(135deg, #0d9488, #06b6d4)", color: "#fff", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
                  🛡️ Register this work
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setKindFilter("all"); setSort("newest"); setVerifiedOnly(false); }}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontSize: 12, fontWeight: 700, color: "#334155", cursor: "pointer" }}
                >
                  Reset filters
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {filteredCerts.map((cert) => (
                <div key={cert.id} style={{ border: "1px solid rgba(15,23,42,0.08)", borderRadius: 14, padding: 16, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{KIND_ICONS[cert.kind] || "📦"}</span>
                        <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 800, background: "rgba(13,148,136,0.1)", color: "#0d9488", textTransform: "uppercase" as const }}>{KIND_LABELS[cert.kind] || cert.kind}</span>
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(cert.protectedAt).toLocaleDateString()}</span>
                      </div>
                      <div style={{ fontWeight: 800, fontSize: 17, color: "#0f172a" }}>{cert.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>by {cert.author}{cert.location ? ` · ${cert.location}` : ""}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "flex-end", gap: 4 }}>
                      {cert.verificationLevel === "verified" ? (
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(13,148,136,0.15))", color: "#065f46", whiteSpace: "nowrap" as const, border: "1px solid rgba(16,185,129,0.3)" }}>
                          ✓ VERIFIED AUTHOR
                        </span>
                      ) : (
                        <span style={{ padding: "3px 10px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "rgba(16,185,129,0.1)", color: "#059669", whiteSpace: "nowrap" as const }}>✓ CERTIFIED</span>
                      )}
                      {(() => {
                        // Состояние якоря в биткойне — главный козырь продукта,
                        // и до 28.08.2026 его не было видно в реестре вовсе.
                        const b = anchorBadge(cert.bitcoinAnchor);
                        if (!b) return null;
                        const c = ANCHOR_TONE_COLORS[b.tone];
                        return (
                          <span
                            title={b.title}
                            style={{ padding: "3px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: c.bg, color: c.fg, whiteSpace: "nowrap" as const }}
                          >
                            {b.label}
                          </span>
                        );
                      })()}
                      {cert.verifiedCount > 0 && <span style={{ fontSize: 10, color: "#94a3b8" }}>Verified {cert.verifiedCount}x</span>}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 8, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const }}>SHA-256 Content Hash</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#334155", wordBreak: "break-all" as const }}>{cert.contentHash}</div>
                      </div>
                      <button onClick={() => copy(cert.contentHash, "Hash")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(15,23,42,0.12)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#475569", flexShrink: 0 }}>Copy</button>
                    </div>
                    {cert.fileHash && (
                      <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(13,148,136,0.03)", border: "1px solid rgba(13,148,136,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#0d9488", textTransform: "uppercase" as const }}>📎 File Hash (SHA-256)</div>
                          <div style={{ fontSize: 11, fontFamily: "monospace", color: "#0d9488", wordBreak: "break-all" as const }}>{cert.fileHash}</div>
                        </div>
                        <button onClick={() => copy(cert.fileHash!, "File Hash")} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(13,148,136,0.2)", background: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", color: "#0d9488", flexShrink: 0 }}>Copy</button>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Link href={`/verify/${cert.id}`} style={{ padding: "7px 14px", borderRadius: 8, background: "#0d9488", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}>✓ Verify</Link>
                    <a
                      href={apiUrl(`/api/pipeline/certificate/${cert.id}/pdf`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ padding: "7px 14px", borderRadius: 8, background: "#0f172a", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                    >
                      📄 PDF
                    </a>
                    {cert.verificationLevel !== "verified" && (
                      <Link
                        href={`/bureau/upgrade/${cert.id}`}
                        style={{ padding: "7px 14px", borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #4f46e5)", color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                      >
                        ⭐ Upgrade to Verified
                      </Link>
                    )}
                    <button onClick={() => copy(cert.verifyUrl, "Verify URL")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy Link</button>
                    <button onClick={() => copy(cert.id, "Certificate ID")} style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(15,23,42,0.15)", background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "#475569" }}>Copy ID</button>
                    {cert.shieldId && (
                      <Link
                        href={`/quantum-shield/${cert.shieldId}`}
                        title={`Quantum Shield ${cert.shieldId}`}
                        style={{ padding: "7px 14px", borderRadius: 8, background: "rgba(13,148,136,0.1)", color: "#0d9488", textDecoration: "none", fontWeight: 800, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(13,148,136,0.25)" }}
                      >
                        🛡️ Shield
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Legal Framework ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 6 }}>Legal Framework</div>
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14, lineHeight: 1.6 }}>
            AEVION IP Bureau builds on established international copyright and digital signature law. Our certificates are cryptographic proof that a work existed at a recorded time — how much weight that carries depends on the forum and on the frameworks listed below.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {LEGAL_FRAMEWORKS.map((l) => (
              <div key={l.name} style={{ padding: "14px 16px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.08)", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                  <div style={{ fontWeight: 800, fontSize: 12, color: "#0f172a" }}>{l.name}</div>
                </div>
                <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, marginBottom: 6 }}>{l.desc}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: l.color }}>{l.scope}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Disclaimer ── */}
        <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)", marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 4 }}>Legal Disclaimer</div>
          <div style={{ fontSize: 11, color: "#78716c", lineHeight: 1.6 }}>
            Certificates issued by AEVION Digital IP Bureau constitute cryptographic proof of existence and authorship at the recorded time. They do not constitute a patent, trademark, or government-issued copyright registration. They serve as admissible evidence of prior art in intellectual property disputes under the legal frameworks referenced above.
          </div>
        </div>

        {/* ── Technology Stack ── */}
        <div style={{ padding: "16px 18px", borderRadius: 14, border: "1px solid rgba(15,23,42,0.08)", background: "rgba(15,23,42,0.02)", marginBottom: 40 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#0f172a", marginBottom: 10 }}>Technology Stack</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["SHA-256 (NIST FIPS 180-4)", "HMAC-SHA256", "Ed25519 (RFC 8032)", "Shamir's Secret Sharing", "Threshold 2-of-3", "PostgreSQL", "Public Verification API"].map((t) => (
              <span key={t} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600, background: "rgba(15,23,42,0.04)", border: "1px solid rgba(15,23,42,0.08)", color: "#334155" }}>{t}</span>
            ))}
          </div>
        </div>
      </ProductPageShell>
    </main>
  );
}