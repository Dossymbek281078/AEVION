"use client";

import React, { useState } from "react";
import { Wave1Nav } from "@/components/Wave1Nav";
import { ProductPageShell } from "@/components/ProductPageShell";
import { apiUrl } from "@/lib/apiBase";

/**
 * Публичная проверка сертификата QLearn — страница для того, кому сертификат
 * ПОКАЗАЛИ: работодателя, заказчика, приёмной комиссии.
 *
 * Две ручки проверки (по одному номеру и пачкой до 50) существовали с 19.08 и
 * не имели ни одного вызывающего: проверить сертификат было негде. Сам по себе
 * сертификат без проверки — картинка, поэтому экран важнее, чем кажется.
 *
 * Страница намеренно не требует входа: проверяющий — посторонний человек.
 *
 * Что НЕ показываем: ручка отдаёт ещё и внутренний идентификатор владельца.
 * Показывать его постороннему незачем — по номеру сертификата он не нужен ни
 * для чего, а утечка внутренних идентификаторов бесплатной не бывает.
 */

interface Verdict {
  valid: boolean;
  courseTitle?: string;
  completedAt?: string;
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 22,
  maxWidth: 560,
};

const noticeStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 8,
  background: "#fef3c7",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 13,
  marginBottom: 14,
};

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function VerifyCertificatePage() {
  const [number, setNumber] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    const n = number.trim();
    if (!n) {
      setError("Введите номер сертификата.");
      return;
    }
    setBusy(true);
    setError(null);
    setVerdict(null);
    try {
      const res = await fetch(apiUrl(`/api/qlearn/certificates/${encodeURIComponent(n)}`));
      let data: Record<string, unknown> = {};
      try {
        data = (await res.json()) as Record<string, unknown>;
      } catch {
        data = {};
      }
      if (!res.ok) {
        // «Недействителен» и «проверить не удалось» — разные ответы. Назвать
        // сбой хранилища подделкой значит оболгать человека с настоящим
        // сертификатом, и заметить это будет некому.
        const w = typeof data.warning === "string" ? data.warning : null;
        const e = typeof data.error === "string" ? data.error : null;
        setError(w ?? e ?? "Проверить не удалось. Попробуйте позже.");
        return;
      }
      setVerdict({
        valid: Boolean(data.valid),
        courseTitle: typeof data.courseTitle === "string" ? data.courseTitle : undefined,
        completedAt: typeof data.completedAt === "string" ? data.completedAt : undefined,
      });
    } catch {
      setError("Сеть недоступна. Проверить не удалось.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 16px 80px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>
            Проверка сертификата
          </h1>
          <p style={{ color: "#64748b", margin: "0 0 22px", fontSize: 15 }}>
            Введите номер с сертификата AEVION QLearn — покажем, настоящий ли он.
          </p>

          <div style={cardStyle}>
            {error && <div style={noticeStyle}>{error}</div>}

            <label
              htmlFor="cert-number"
              style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#334155", marginBottom: 6 }}
            >
              Номер сертификата
            </label>
            <input
              id="cert-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void check();
              }}
              placeholder="AEVION-…"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: 15,
                marginBottom: 12,
              }}
            />
            <button
              onClick={() => void check()}
              disabled={busy || !number.trim()}
              style={{
                padding: "9px 18px",
                borderRadius: 8,
                border: "none",
                background: "linear-gradient(135deg, #0d9488 0%, #7c3aed 100%)",
                color: "#fff",
                fontWeight: 700,
                fontSize: 14,
                cursor: busy || !number.trim() ? "default" : "pointer",
                opacity: busy || !number.trim() ? 0.5 : 1,
              }}
            >
              {busy ? "Проверяем…" : "Проверить"}
            </button>

            {verdict && (
              <div
                style={{
                  marginTop: 18,
                  padding: "14px 16px",
                  borderRadius: 10,
                  background: verdict.valid ? "#f0fdfa" : "#fef2f2",
                  border: `1px solid ${verdict.valid ? "#ccfbf1" : "#fecaca"}`,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: 15,
                    color: verdict.valid ? "#0f766e" : "#b91c1c",
                  }}
                >
                  {verdict.valid ? "Сертификат настоящий" : "Такого сертификата у нас нет"}
                </div>
                {verdict.valid && (
                  <div style={{ fontSize: 14, color: "#334155", marginTop: 6, lineHeight: 1.6 }}>
                    {verdict.courseTitle && <div>Курс: {verdict.courseTitle}</div>}
                    {formatDate(verdict.completedAt) && (
                      <div>Завершён: {formatDate(verdict.completedAt)}</div>
                    )}
                  </div>
                )}
                {!verdict.valid && (
                  <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 6 }}>
                    Проверьте номер: он мог быть введён с опечаткой.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ProductPageShell>
    </>
  );
}
