"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ProductPageShell } from "@/components/ProductPageShell";
import { useToast } from "@/components/ToastProvider";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { titleForAppSlug } from "@/lib/appSlugTitle";

const TOKEN_KEY = "aevion_auth_token_v1";

type Me = {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  emailVerifiedAt: string | null;
};

type Session = {
  id: string;
  createdAt: string;
  lastActiveAt: string;
  ip: string | null;
  userAgent: string | null;
  revokedAt: string | null;
  isCurrent: boolean;
};

type AuditEntry = {
  id: string;
  action: string;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  at: string;
};

const card: CSSProperties = {
  border: "1px solid rgba(15,23,42,0.1)",
  borderRadius: 16,
  padding: 20,
  background: "#fff",
  marginBottom: 16,
};
const labelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 6,
};
const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  fontSize: 13,
  marginBottom: 10,
};
const btnPrimary: CSSProperties = {
  padding: "8px 18px",
  borderRadius: 8,
  border: "none",
  background: "#0d9488",
  color: "#fff",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const btnSecondary: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(15,23,42,0.15)",
  background: "#fff",
  color: "#0f172a",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
const btnDanger: CSSProperties = {
  padding: "8px 14px",
  borderRadius: 8,
  border: "1px solid rgba(220,38,38,0.4)",
  background: "#fff",
  color: "#dc2626",
  fontWeight: 800,
  fontSize: 12,
  cursor: "pointer",
};

export default function AccountPage() {
  const { showToast } = useToast();
  const [hasToken, setHasToken] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyToken, setVerifyToken] = useState("");
  const [verifyDevToken, setVerifyDevToken] = useState<string | null>(null);
  const [confirmingVerify, setConfirmingVerify] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [revokingAll, setRevokingAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sub, setSub] = useState<{
    tierId: string; period: string; seats: number;
    validUntil: string | null; trialDays: number; amountUsd: number | null;
    source: string | null; createdAt: string; modules: string[];
  } | null>(null);
  // Модули, купленные ОТДЕЛЬНОЙ подпиской. Без них страница говорила
  // «Free plan — no active subscription» человеку, который платит $29/мес за
  // QVenture: тариф у него действительно free, а покупка живёт в другой
  // таблице, и кабинет её не читал.
  const [ownedApps, setOwnedApps] = useState<string[]>([]);
  // Метка возврата из кассы. Замер 29.08.2026: после оплаты человек НИКУДА не
  // возвращался — в ссылках кассы нет адреса возврата, а страниц «спасибо» нет
  // вовсе (/thanks, /thank-you, /success дают 404). Договор простой: касса
  // возвращает на /account?purchased=<слаг права>, и здесь это подтверждается
  // явно. Без метки страница ведёт себя как раньше.
  //
  // ⚠️ Именно СЛАГ ПРАВА, а не имя товара в каталоге: у части модулей это
  // разные строки (каталог bureau -> модуль aevion-ip-bureau -> право
  // ip_bureau). Поставь в кассе имя товара — и заплативший за Бюро увидит
  // «ждём подтверждения» навсегда: право придёт под другим именем, а сравнение
  // здесь буквальное. Договор закреплён тестом
  // aevion-globus-backend/tests/returnUrlMarkerMatchesEntitlementSlug.test.ts.
  const [justPurchased, setJustPurchased] = useState<string | null>(null);
  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get("purchased");
      setJustPurchased(v && v.length <= 64 ? v : null);
    } catch {
      setJustPurchased(null);
    }
  }, []);
  // «Список пуст» и «узнать не удалось» — РАЗНЫЕ вещи, и на денежном пути
  // разница дороже всего (21.08.2026).
  const [ownedUnknown, setOwnedUnknown] = useState(false);
  // Lite = 1 продукт на выбор: список доступных модулей + выбор + busy
  const [allModules, setAllModules] = useState<{ id: string; name: string }[]>([]);
  const [liteChoice, setLiteChoice] = useState<string>("");
  const [liteBusy, setLiteBusy] = useState(false);

  const authHeaders = useCallback((): HeadersInit => {
    try {
      const raw = localStorage.getItem(TOKEN_KEY);
      return raw ? { Authorization: `Bearer ${raw}` } : {};
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    try {
      setHasToken(!!localStorage.getItem(TOKEN_KEY));
    } catch {}
  }, []);

  const loadAll = useCallback(async () => {
    if (!hasToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [meRes, sessRes, auditRes, subRes] = await Promise.all([
        fetch(apiUrl("/api/auth/me"), { headers: authHeaders() }),
        fetch(apiUrl("/api/auth/sessions"), { headers: authHeaders() }),
        fetch(apiUrl("/api/auth/me/audit?limit=50"), { headers: authHeaders() }),
        fetch(apiUrl("/api/pricing/subscription/me"), { headers: authHeaders() }),
      ]);
      if (meRes.ok) {
        const d = await meRes.json();
        setMe(d.user || null);
        setName(d.user?.name || "");
        // Купленные поштучно модули лежат отдельно от тарифа. Ручка тепеличная и
        // работает по почте, поэтому спрашиваем сразу, как почта стала известна.
        const email = d.user?.email;
        if (email) {
          try {
            const ar = await fetch(apiUrl("/api/apps/access"), { headers: authHeaders() });
            if (ar.ok) {
              const aj = await ar.json();
              setOwnedApps(Array.isArray(aj.apps) ? aj.apps : []);
              setOwnedUnknown(false);
            } else {
              // Ручка честно отвечает 500 при недоступной базе. Не притворяемся,
              // что покупок нет: пустой список читается как «вы ничего не купили»,
              // и заплативший увидит предложение купить ещё раз.
              setOwnedUnknown(true);
            }
          } catch {
            setOwnedUnknown(true);
          }
        }
      } else if (meRes.status === 401) {
        setMe(null);
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {}
        setHasToken(false);
      }
      if (sessRes.ok) {
        const d = await sessRes.json();
        setSessions(d.items || []);
      }
      if (auditRes.ok) {
        const d = await auditRes.json();
        setAudit(d.items || []);
      }
      if (subRes.ok) {
        const d = await subRes.json();
        setSub(d.subscription ?? null);
        setLiteChoice(d.subscription?.modules?.[0] ?? "");
      }
      // список продуктов для выбора Lite (публичный)
      try {
        const pr = await fetch(apiUrl("/api/pricing"));
        if (pr.ok) {
          const pj = await pr.json();
          setAllModules((pj.modules ?? []).map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })));
        }
      } catch { /* ignore */ }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [authHeaders, hasToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveName = async () => {
    setSavingName(true);
    try {
      const r = await fetch(apiUrl("/api/auth/me"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name }),
      });
      if (r.ok) {
        showToast("Name updated", "success");
        setEditingName(false);
        loadAll();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(`Update failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Update failed: ${(e as Error).message}`, "error");
    } finally {
      setSavingName(false);
    }
  };

  const changePwd = async () => {
    if (newPwd.length < 6) {
      showToast("New password must be ≥ 6 characters", "error");
      return;
    }
    setPwdBusy(true);
    try {
      const r = await fetch(apiUrl("/api/auth/password/change"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ currentPassword: currentPwd, newPassword: newPwd }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Password changed. Other sessions revoked.", "success");
        setCurrentPwd("");
        setNewPwd("");
        loadAll();
      } else {
        showToast(`Change failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Change failed: ${(e as Error).message}`, "error");
    } finally {
      setPwdBusy(false);
    }
  };

  const requestVerify = async () => {
    setVerifyBusy(true);
    try {
      const r = await fetch(apiUrl("/api/auth/email/verify/request"), {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (d.alreadyVerified) {
          showToast("Email already verified", "info");
        } else {
          if (d.devToken) {
            setVerifyDevToken(d.devToken);
            showToast("Dev token shown — paste below to verify", "success");
          } else if (d.emailSent) {
            showToast("Verification email sent", "success");
          } else {
            // Сервер создал токен, но письмо не ушло. До 19.08.2026 здесь в
            // любом случае показывали «sent», и человек ждал письма, которого
            // не было. Говорим правду: действие не состоялось наполовину.
            showToast("Токен создан, но письмо отправить не удалось — напишите нам", "error");
          }
        }
      } else {
        showToast(`Request failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Request failed: ${(e as Error).message}`, "error");
    } finally {
      setVerifyBusy(false);
    }
  };

  const completeVerify = async () => {
    if (!verifyToken.trim()) {
      showToast("Token required", "error");
      return;
    }
    setConfirmingVerify(true);
    try {
      const r = await fetch(apiUrl("/api/auth/email/verify/complete"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ token: verifyToken.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Email verified", "success");
        setVerifyToken("");
        setVerifyDevToken(null);
        loadAll();
      } else {
        showToast(`Verify failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Verify failed: ${(e as Error).message}`, "error");
    } finally {
      setConfirmingVerify(false);
    }
  };

  const revokeSession = async (sid: string) => {
    if (!confirm("Revoke this session?")) return;
    try {
      const r = await fetch(apiUrl(`/api/auth/sessions/${encodeURIComponent(sid)}`), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) {
        showToast("Session revoked", "success");
        loadAll();
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(`Revoke failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Revoke failed: ${(e as Error).message}`, "error");
    }
  };

  const revokeAll = async () => {
    if (!confirm("Revoke all OTHER sessions? Current session stays signed in.")) return;
    setRevokingAll(true);
    try {
      const r = await fetch(apiUrl("/api/auth/logout-all"), {
        method: "POST",
        headers: authHeaders(),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast(`Revoked ${d.revokedCount || 0} session(s)`, "success");
        loadAll();
      } else {
        showToast(`Revoke failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Revoke failed: ${(e as Error).message}`, "error");
    } finally {
      setRevokingAll(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(apiUrl("/api/auth/logout"), {
        method: "POST",
        headers: authHeaders(),
      });
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
    showToast("Signed out", "success");
    setHasToken(false);
    setMe(null);
    setSessions([]);
    setAudit([]);
  };

  const deleteAccount = async () => {
    setDeleteBusy(true);
    try {
      const r = await fetch(apiUrl("/api/auth/account"), {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (r.ok) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {}
        showToast("Account deleted", "success");
        setHasToken(false);
        setMe(null);
        setConfirmDelete(false);
      } else {
        const d = await r.json().catch(() => ({}));
        showToast(`Delete failed: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Delete failed: ${(e as Error).message}`, "error");
    } finally {
      setDeleteBusy(false);
    }
  };

  const changeLiteModule = async () => {
    if (!liteChoice) {
      showToast("Выберите продукт", "error");
      return;
    }
    setLiteBusy(true);
    try {
      const r = await fetch(apiUrl("/api/pricing/subscription/lite-module"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ moduleId: liteChoice }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        showToast("Продукт обновлён", "success");
        loadAll();
      } else {
        showToast(`Не удалось: ${d.error || r.status}`, "error");
      }
    } catch (e) {
      showToast(`Ошибка: ${(e as Error).message}`, "error");
    } finally {
      setLiteBusy(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
          {/*
            Подтверждение возврата из кассы. Текст зависит от того, ПОДТВЕРДИЛИ
            ли мы покупку у себя, а не от того, что написано в адресе.

            Первая версия говорила «Оплата принята» всякому, у кого в адресе
            стоит ?purchased=<что угодно>. Это ровно тот класс, который мы
            вычищаем по всей платформе: утверждение об успехе, ничем не
            проверенное. Метку в адрес кладёт касса, но переписать её может
            кто угодно, а страница отвечала за кассу.

            Теперь: право нашлось — говорим уверенно; ещё не пришло — говорим,
            что ждём подтверждения, и это правда в обоих случаях (вебхук
            приходит с задержкой). Про «оплата принята» молчим, пока не знаем.
          */}
          {justPurchased && (() => {
            const confirmed = ownedApps.some(
              (slug) => slug.toLowerCase() === justPurchased.toLowerCase(),
            );
            return (
              <div
                role="status"
                style={{
                  marginBottom: 20, padding: "14px 16px", borderRadius: 12,
                  background: confirmed ? "#ecfdf5" : "#f8fafc",
                  border: `1px solid ${confirmed ? "#a7f3d0" : "#cbd5e1"}`,
                  color: confirmed ? "#065f46" : "#334155",
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {confirmed ? "Спасибо за покупку" : "Возвращаемся из кассы"}
                </div>
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {confirmed
                    ? "Доступ открыт — купленное в списке ниже."
                    : ownedUnknown
                      ? "Подтверждение пока не удалось проверить: список покупок не загрузился. Обновите страницу через минуту."
                      : "Ждём подтверждения от кассы — оно приходит в течение минуты. Обновите страницу, и покупка появится в списке ниже."}
                </div>
              </div>
            );
          })()}
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            Account
          </h1>
          <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 24 }}>
            Profile, security, sessions, and audit log.
          </p>

          {!hasToken ? (
            <div style={{ ...card, color: "#854d0e", borderColor: "rgba(234,179,8,0.4)" }}>
              You are not signed in.{" "}
              <Link href="/auth" style={{ color: "#0d9488", fontWeight: 700 }}>
                Go to Auth →
              </Link>
            </div>
          ) : loading ? (
            <div style={{ ...card, color: "#64748b" }}>Loading…</div>
          ) : !me ? (
            <div style={{ ...card, color: "#b91c1c", borderColor: "rgba(185,28,28,0.2)" }}>
              Token invalid or expired. Sign in again.
            </div>
          ) : (
            <>
              {/* Profile */}
              <div style={card}>
                <h2 style={{ margin: 0, marginBottom: 14, fontSize: 16, fontWeight: 800 }}>
                  Profile
                </h2>
                <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
                  <div>
                    <div style={labelStyle}>Email</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{me.email}</span>
                      {me.emailVerifiedAt ? (
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontSize: 10, fontWeight: 800 }}>
                          ✓ VERIFIED
                        </span>
                      ) : (
                        <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(234,179,8,0.15)", color: "#854d0e", fontSize: 10, fontWeight: 800 }}>
                          UNVERIFIED
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Name</div>
                    {editingName ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 0 }}
                          maxLength={200}
                        />
                        <button onClick={saveName} disabled={savingName} style={btnPrimary}>
                          {savingName ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingName(false);
                            setName(me.name);
                          }}
                          style={btnSecondary}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 700 }}>{me.name}</span>
                        <button onClick={() => setEditingName(true)} style={btnSecondary}>
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={labelStyle}>Role</div>
                    <span style={{ fontFamily: "monospace" }}>{me.role}</span>
                  </div>
                  <div>
                    <div style={labelStyle}>Member since</div>
                    <span>{formatDate(me.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Email verify */}
              {!me.emailVerifiedAt && (
                <div style={card}>
                  <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 800 }}>
                    Verify email
                  </h2>
                  <p style={{ fontSize: 12, color: "#475569", marginTop: 0, marginBottom: 12 }}>
                    Confirms ownership of <strong>{me.email}</strong>. Required for password reset.
                  </p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <button onClick={requestVerify} disabled={verifyBusy} style={btnPrimary}>
                      {verifyBusy ? "…" : "Send verify link"}
                    </button>
                  </div>
                  {(verifyDevToken || verifyToken) && (
                    <div style={{ marginTop: 12 }}>
                      {verifyDevToken && (
                        <div style={{ marginBottom: 8, padding: 8, background: "rgba(13,148,136,0.06)", borderRadius: 6, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
                          <strong>Dev token:</strong> {verifyDevToken}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={verifyToken}
                          onChange={(e) => setVerifyToken(e.target.value)}
                          placeholder="Paste verification token"
                          style={{ ...inputStyle, marginBottom: 0, fontFamily: "monospace", fontSize: 11 }}
                        />
                        <button onClick={completeVerify} disabled={confirmingVerify} style={btnPrimary}>
                          {confirmingVerify ? "…" : "Verify"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Password */}
              <div style={card}>
                <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 800 }}>
                  Change password
                </h2>
                <p style={{ fontSize: 12, color: "#475569", marginTop: 0, marginBottom: 12 }}>
                  All other sessions are revoked on success.
                </p>
                <input
                  type="password"
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Current password"
                  style={inputStyle}
                />
                <input
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="New password (≥ 6 chars)"
                  style={inputStyle}
                />
                <button
                  onClick={changePwd}
                  disabled={pwdBusy || !currentPwd || !newPwd}
                  style={btnPrimary}
                >
                  {pwdBusy ? "Changing…" : "Change password"}
                </button>
              </div>

              {/* Subscription */}
              <div style={card}>
                <h2 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 800 }}>Subscription</h2>
                {sub ? (
                  <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <div style={labelStyle}>Plan</div>
                      <span style={{ fontWeight: 800, textTransform: "capitalize", color: "#0d9488" }}>
                        {sub.tierId}
                      </span>
                    </div>
                    <div>
                      <div style={labelStyle}>Billing</div>
                      <span style={{ textTransform: "capitalize" }}>{sub.period}</span>
                    </div>
                    {sub.seats > 1 && (
                      <div>
                        <div style={labelStyle}>Seats</div>
                        <span>{sub.seats}</span>
                      </div>
                    )}
                    {sub.amountUsd !== null && (
                      <div>
                        <div style={labelStyle}>Amount</div>
                        <span>${sub.amountUsd.toLocaleString("en-US")}</span>
                      </div>
                    )}
                    {sub.validUntil && (
                      <div>
                        <div style={labelStyle}>Valid until</div>
                        <span>{formatDate(sub.validUntil)}</span>
                      </div>
                    )}
                    <div>
                      <div style={labelStyle}>Since</div>
                      <span>{formatDate(sub.createdAt)}</span>
                    </div>
                  </div>
                  {(sub.tierId === "lite" || sub.tierId === "free") && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
                      <div style={labelStyle}>Продукт {sub.tierId === "lite" ? "(Lite — 1 на выбор)" : "(Free — 1 на выбор)"}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <select
                          value={liteChoice}
                          onChange={(e) => setLiteChoice(e.target.value)}
                          style={{ ...inputStyle, marginBottom: 0, maxWidth: 320 }}
                        >
                          <option value="">— выберите продукт —</option>
                          {allModules.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                        <button onClick={changeLiteModule} disabled={liteBusy || !liteChoice} style={btnPrimary}>
                          {liteBusy ? "…" : "Сохранить"}
                        </button>
                      </div>
                      {sub.modules?.[0] && (
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
                          Текущий: <strong>{allModules.find((m) => m.id === sub.modules[0])?.name ?? sub.modules[0]}</strong>
                        </div>
                      )}
                    </div>
                  )}
                  </>
                ) : ownedUnknown ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 13, color: "#b45309" }}>
                      Не удалось узнать ваши подписки — сервис не ответил. Это не значит,
                      что их нет: обновите страницу через минуту.
                    </span>
                  </div>
                ) : ownedApps.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 13, color: "#64748b" }}>Free plan — no active subscription.</span>
                    <Link
                      href="/pricing"
                      style={{ padding: "6px 16px", background: "#0d9488", color: "#fff", borderRadius: 8, textDecoration: "none", fontWeight: 800, fontSize: 13 }}
                    >
                      Upgrade
                    </Link>
                  </div>
                ) : null}

                {/* Модули, купленные отдельной подпиской. Показываются и при
                    тарифе free: без этого блока страница сообщала «нет активной
                    подписки» человеку, который платит за модуль каждый месяц. */}
                {ownedApps.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                      Оплачено отдельно — доступ активен:
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {ownedApps.map((slug) => (
                        <span
                          key={slug}
                          style={{
                            padding: "4px 12px", background: "#ecfdf5", color: "#065f46",
                            border: "1px solid #a7f3d0", borderRadius: 999, fontSize: 13, fontWeight: 700,
                          }}
                        >
                          {titleForAppSlug(slug)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sessions */}
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Active sessions</h2>
                  <span style={{ marginLeft: 10, fontSize: 11, color: "#94a3b8" }}>
                    {sessions.filter((s) => !s.revokedAt).length} active
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={revokeAll} disabled={revokingAll} style={btnDanger}>
                    {revokingAll ? "…" : "Sign out all others"}
                  </button>
                </div>
                {sessions.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>No sessions tracked.</div>
                ) : (
                  <div style={{ display: "grid", gap: 6 }}>
                    {sessions.map((s) => {
                      const revoked = !!s.revokedAt;
                      return (
                        <div
                          key={s.id}
                          style={{
                            padding: "10px 12px",
                            border: "1px solid rgba(15,23,42,0.08)",
                            borderRadius: 10,
                            background: revoked ? "rgba(241,245,249,0.5)" : "#fff",
                            opacity: revoked ? 0.55 : 1,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 10, color: "#94a3b8" }}>
                              {s.id.slice(0, 8)}…
                            </span>
                            {s.isCurrent && (
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(13,148,136,0.12)", color: "#0d9488", fontSize: 10, fontWeight: 800 }}>
                                CURRENT
                              </span>
                            )}
                            {revoked && (
                              <span style={{ padding: "2px 6px", borderRadius: 4, background: "rgba(220,38,38,0.12)", color: "#dc2626", fontSize: 10, fontWeight: 800 }}>
                                REVOKED
                              </span>
                            )}
                            <span style={{ marginLeft: "auto", color: "#64748b" }}>
                              {formatDateTime(s.lastActiveAt)}
                            </span>
                            {!revoked && !s.isCurrent && (
                              <button onClick={() => revokeSession(s.id)} style={btnDanger}>
                                Revoke
                              </button>
                            )}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b", marginTop: 4 }}>
                            {s.ip || "—"} · {s.userAgent ? s.userAgent.slice(0, 80) : "(no UA)"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Audit */}
              <div style={card}>
                <h2 style={{ margin: 0, marginBottom: 12, fontSize: 16, fontWeight: 800 }}>
                  Audit log
                </h2>
                {audit.length === 0 ? (
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>No events yet.</div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    {audit.map((a) => {
                      const failed = a.action.includes("failed");
                      return (
                        <div
                          key={a.id}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            background: failed ? "rgba(254,242,242,0.5)" : "#f8fafc",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 4,
                              background: failed ? "rgba(220,38,38,0.12)" : "rgba(13,148,136,0.12)",
                              color: failed ? "#dc2626" : "#0d9488",
                              fontFamily: "monospace",
                              fontWeight: 800,
                              fontSize: 10,
                            }}
                          >
                            {a.action}
                          </span>
                          <span style={{ color: "#64748b", fontSize: 10 }}>
                            {a.ip || "—"}
                          </span>
                          <span style={{ marginLeft: "auto", color: "#94a3b8", fontSize: 10 }}>
                            {formatDateTime(a.at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Sign out */}
              <div style={card}>
                <button onClick={logout} style={btnSecondary}>
                  Sign out
                </button>
              </div>

              {/* Danger zone */}
              <div style={{ ...card, borderColor: "rgba(220,38,38,0.3)" }}>
                <h2 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 800, color: "#7f1d1d" }}>
                  Danger zone
                </h2>
                <p style={{ fontSize: 12, color: "#475569", marginTop: 0, marginBottom: 12 }}>
                  Delete account anonymizes your profile and revokes every session.
                  <br />
                  <strong>This cannot be undone.</strong> Your QRight registrations and Planet certificates remain in the registry but become unowned.
                </p>
                {!confirmDelete ? (
                  <button onClick={() => setConfirmDelete(true)} style={btnDanger}>
                    Delete account
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={deleteAccount} disabled={deleteBusy} style={{ ...btnDanger, background: "#dc2626", color: "#fff", border: "none" }}>
                      {deleteBusy ? "Deleting…" : "Yes, delete forever"}
                    </button>
                    <button onClick={() => setConfirmDelete(false)} disabled={deleteBusy} style={btnSecondary}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}
