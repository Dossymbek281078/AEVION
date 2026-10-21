"use client";

/**
 * Ручная проверка личности для бюро «Проверено» (21.10.2026).
 *
 * Сюда ведёт redirectUrl поставщика manual (бэк: lib/kyc/manualProvider.ts),
 * когда BUREAU_KYC_PROVIDER=manual. Человек выбирает тип документа, даёт фото
 * или PDF документа и селфи с ним; фото сжимаются до 3,5 МБ (prepareFile.ts).
 * После подачи — статус и дата удаления файлов. Решение принимает сотрудник
 * в /admin/bureau, а вкладка сертификата (/bureau/upgrade/[certId]) сама
 * опрашивает /verify/status и двигается дальше.
 *
 * Обещание ровно одно: документ смотрит сотрудник AEVION вручную. Никакой
 * «юридически значимой идентификации» — до заключения юриста её нет.
 */
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ProductPageShell } from "@/components/ProductPageShell";
import { Wave1Nav } from "@/components/Wave1Nav";
import { apiUrl } from "@/lib/apiBase";
import { useI18nOptional } from "@/lib/i18n";
import { подготовитьФайл } from "../prepareFile";

type Статус = "pending" | "review" | "approved" | "rejected" | "expired";
type Сессия = {
  sessionId: string;
  status: Статус;
  reason: string | null;
  filesDeleteAfter: string | null;
};

const DOC_TYPES = ["passport", "id_card", "driver_license", "residence_permit"] as const;

const card = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  background: "#fff",
  padding: "18px 20px",
  marginBottom: 16,
} as const;
const label = { display: "block", fontWeight: 800, fontSize: 15, color: "#0f172a", margin: "0 0 6px" } as const;
const field = {
  width: "100%",
  fontSize: 15,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  marginBottom: 14,
  background: "#fff",
  boxSizing: "border-box",
} as const;

export default function KycManualPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? "");
  const i18n = useI18nOptional();
  const lang = i18n?.lang ?? "en";
  const t = i18n?.t ?? ((k: string) => k);

  const [сессия, setСессия] = useState<Сессия | null>(null);
  const [загрузка, setЗагрузка] = useState<"loading" | "ok" | "notFound" | "disabled" | "error">("loading");
  const [docType, setDocType] = useState<string>("passport");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [отправка, setОтправка] = useState(false);
  const [ошибка, setОшибка] = useState<string | null>(null);

  const загрузить = useCallback(async () => {
    try {
      const r = await fetch(apiUrl(`/api/bureau/kyc-manual/${encodeURIComponent(id)}`), { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setСессия(j as Сессия);
        setЗагрузка("ok");
      } else if (j?.error === "kyc_manual_disabled") setЗагрузка("disabled");
      else if (r.status === 404 || r.status === 400) setЗагрузка("notFound");
      else setЗагрузка("error");
    } catch {
      setЗагрузка("error");
    }
  }, [id]);

  useEffect(() => {
    void загрузить();
  }, [загрузить]);

  const дата = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-US");
  };

  const готово = Boolean(docFile && selfie) && !отправка;

  async function отправить(e: FormEvent) {
    e.preventDefault();
    if (!docFile || !selfie || отправка) return;
    setОшибка(null);
    setОтправка(true);
    try {
      const [d, s] = await Promise.all([подготовитьФайл(docFile, true), подготовитьФайл(selfie, false)]);
      if (!d.ok || !s.ok) {
        const tooBig = (!d.ok && d.error === "tooBig") || (!s.ok && s.error === "tooBig");
        setОшибка(t(tooBig ? "bureau.kycm.err.tooBig" : "bureau.kycm.err.type"));
        return;
      }
      const r = await fetch(apiUrl(`/api/bureau/kyc-manual/${encodeURIComponent(id)}/submit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docType, docMime: d.mime, docBase64: d.base64, selfieMime: s.mime, selfieBase64: s.base64 }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setСессия(j as Сессия);
        return;
      }
      if (r.status === 409) {
        // Уже подано или истекло — показываем то, что знает сервер.
        await загрузить();
        return;
      }
      setОшибка(t("bureau.kycm.err.generic", { code: String(j?.error || r.status) }));
    } catch (err) {
      setОшибка(t("bureau.kycm.err.generic", { code: (err as Error).message || "network" }));
    } finally {
      setОтправка(false);
    }
  }

  const st = сессия?.status;
  return (
    <main style={{ minHeight: "100vh", background: "#f7f8fa" }}>
      <Wave1Nav />
      <ProductPageShell>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px 48px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#0f172a", margin: "0 0 10px" }}>{t("bureau.kycm.title")}</h1>
          <p data-kycm-manual style={{ fontSize: 16, color: "#0f172a", margin: "0 0 6px", fontWeight: 700 }}>
            {t("bureau.kycm.manual")}
          </p>
          <p style={{ fontSize: 14, color: "#475569", margin: "0 0 18px" }}>{t("bureau.kycm.privacy")}</p>

          {загрузка === "loading" && <div style={card}>{t("bureau.kycm.loading")}</div>}
          {загрузка === "notFound" && (
            <div data-kycm-state="notFound" style={card}>
              {t("bureau.kycm.notFound")}
            </div>
          )}
          {загрузка === "disabled" && (
            <div data-kycm-state="disabled" style={card}>
              {t("bureau.kycm.disabled")}
            </div>
          )}
          {загрузка === "error" && (
            <div data-kycm-state="error" style={{ ...card, color: "#b91c1c" }}>
              {t("bureau.kycm.err.generic", { code: "network" })}
            </div>
          )}

          {загрузка === "ok" && st === "pending" && (
            <form data-kycm-form onSubmit={отправить} style={card}>
              <label style={label} htmlFor="kycm-doctype">
                {t("bureau.kycm.docType")}
              </label>
              <select id="kycm-doctype" value={docType} onChange={(e) => setDocType(e.target.value)} style={field}>
                {DOC_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`bureau.kycm.docType.${d}`)}
                  </option>
                ))}
              </select>

              <label style={label} htmlFor="kycm-doc">
                {t("bureau.kycm.docFile")}
              </label>
              <input
                id="kycm-doc"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                style={field}
              />

              <label style={label} htmlFor="kycm-selfie">
                {t("bureau.kycm.selfie")}
              </label>
              <input
                id="kycm-selfie"
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
                style={field}
              />

              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>{t("bureau.kycm.sizeNote")}</p>
              {ошибка && (
                <p data-kycm-error role="alert" style={{ fontSize: 14, color: "#b91c1c", margin: "0 0 12px" }}>
                  {ошибка}
                </p>
              )}
              <button
                type="submit"
                data-kycm-submit
                disabled={!готово}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "none",
                  background: готово ? "linear-gradient(135deg, #0d9488, #06b6d4)" : "#94a3b8",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: готово ? "pointer" : "not-allowed",
                }}
              >
                {отправка ? t("bureau.kycm.sending") : t("bureau.kycm.submit")}
              </button>
            </form>
          )}

          {загрузка === "ok" && st && st !== "pending" && (
            <div data-kycm-state={st} style={card}>
              <p
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: st === "rejected" || st === "expired" ? "#b91c1c" : "#0f172a",
                  margin: "0 0 8px",
                }}
              >
                {t(`bureau.kycm.status.${st}`, { reason: сессия?.reason ?? "" })}
              </p>
              {сессия?.filesDeleteAfter && st !== "expired" && (
                <p data-kycm-delete style={{ fontSize: 14, color: "#475569", margin: "0 0 8px" }}>
                  {t("bureau.kycm.filesDelete", { date: дата(сессия.filesDeleteAfter) })}
                </p>
              )}
              {st !== "expired" && <p style={{ fontSize: 14, color: "#475569", margin: 0 }}>{t("bureau.kycm.backToCert")}</p>}
            </div>
          )}
        </div>
      </ProductPageShell>
    </main>
  );
}
